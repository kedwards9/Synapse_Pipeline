#!/usr/bin/env node
// Investigation reconstructor.
//
// Prints what happened in a time window as a chronological transcript of
// ACTIONS and STATEMENTS, so a debugging story can be written from evidence
// rather than from memory.
//
// WHY THIS EXISTS, and the constraint that shapes it:
//
// A session transcript does NOT contain the model's reasoning. Measured
// 2026-08-28 against a live 912-line transcript: 70 `thinking` blocks were
// present and every one held the empty string, carrying only a `signature`.
// The deliberation is not persisted anywhere on disk.
//
// What IS persisted, and what this script reads:
//
//   - every tool call, in order, with its arguments  (the boundary log)
//   - every visible assistant statement              (the transcript)
//   - every user turn                                (the transcript)
//   - timestamps on all of it
//
// That turns out to be the better source for a written account anyway. The
// tool-call sequence IS the investigation made physical -- grep, then measure,
// then check the schema, then correct the claim -- and every statement it
// interleaves is backed by a command that ran and output that came back. An
// account written from this can be checked by a reader. One written from
// recalled reasoning cannot.
//
// WHAT IT CANNOT RECOVER: what was believed immediately BEFORE a correction.
// Nothing on disk holds that, and after the fact you cannot un-know the
// answer. That is what a one-line marker written in the moment is for; this
// script recovers everything else.
//
// The boundary log is the index: it carries `transcriptPath` on essentially
// every record (5,740 of 5,763 measured), so a time window resolves to both
// the actions and the session they happened in.
//
// Read-only. Opens two files and writes nothing.

import { readFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const DEFAULT_LOG = join(homedir(), '.claude', 'synapse-orchestrator-boundary.jsonl')

/** Parse a JSONL file into records, skipping unparseable lines rather than throwing.
 *
 * A torn line from a concurrent append must not blank the whole window -- the
 * boundary log is appended to by every live session, so a partial last line is
 * expected rather than exceptional. Skips are counted and reported so a
 * systematically broken file is visible instead of silent. */
export function parseJsonl(text) {
  const records = []
  let skipped = 0
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue
    try {
      records.push(JSON.parse(line))
    } catch {
      skipped += 1
    }
  }
  return { records, skipped }
}

/** Resolve a window spec to {from, to} epoch millis.
 *
 * Accepts `A..B` (two ISO timestamps) or `A+Nm` / `A+Nh` (a start plus a
 * duration). Returns null for anything unparseable rather than guessing --
 * a window silently defaulting to "everything" would print a whole day. */
export function parseWindow(spec) {
  if (typeof spec !== 'string' || !spec.trim()) return null

  const range = spec.split('..')
  if (range.length === 2) {
    const from = Date.parse(range[0])
    const to = Date.parse(range[1])
    if (Number.isNaN(from) || Number.isNaN(to) || to < from) return null
    return { from, to }
  }

  const plus = spec.match(/^(.+?)\+(\d+)([mh])$/)
  if (plus) {
    const from = Date.parse(plus[1])
    if (Number.isNaN(from)) return null
    const n = Number(plus[2])
    const ms = plus[3] === 'h' ? n * 3600_000 : n * 60_000
    return { from, to: from + ms }
  }

  return null
}

/** Boundary-log records inside the window, optionally narrowed to one repo.
 *
 * `cwd` matching is case-insensitive containment with a segment boundary, for
 * the reasons measured in the hook-log-adapter record: the same repository
 * appears under two cases, and `cwd` is often a subdirectory of the root. */
export function selectEvents(records, { from, to, cwd = null }) {
  const wanted = cwd === null ? null : normaliseSegments(cwd)
  return records
    .filter((r) => {
      const t = Date.parse(r.at)
      if (Number.isNaN(t) || t < from || t > to) return false
      if (wanted === null) return true
      return containsPath(normaliseSegments(r.cwd), wanted)
    })
    .map((r) => ({
      kind: 'action',
      at: Date.parse(r.at),
      tool: r.toolName,
      seat: r.seat,
      agentType: r.agentType,
      // `detail` holds verbatim command bodies. It is carried here because
      // this script's whole purpose is reconstructing what was run, and its
      // output goes to a terminal the user is already looking at -- never to
      // a renderer or a browser. See the hook-log-adapter record, decision 5.
      detail: r.detail ?? '',
      transcriptPath: r.transcriptPath ?? null,
    }))
}

/** Split a path into comparison segments. Case is folded on Windows only,
 *  matching NTFS, and left alone elsewhere, matching ext4. */
export function normaliseSegments(p, platform = process.platform) {
  if (typeof p !== 'string' || !p) return []
  const folded = platform === 'win32' ? p.toLowerCase() : p
  return folded.split(/[\\/]+/).filter(Boolean)
}

/** True when `segments` is at or below `root`. Segment-wise, so `synapseX`
 *  never matches `synapse` the way a raw startsWith would. */
export function containsPath(segments, root) {
  if (root.length === 0 || segments.length < root.length) return false
  return root.every((seg, i) => segments[i] === seg)
}

/** Visible turns from a transcript inside the window.
 *
 * Only `text` blocks survive here. `thinking` blocks are present in the file
 * but always empty -- see the header -- so including them would emit blanks
 * that read as "said nothing" rather than as "not recorded". */
export function selectTurns(records, { from, to }) {
  const turns = []
  for (const rec of records) {
    if (rec.type !== 'assistant' && rec.type !== 'user') continue
    const t = Date.parse(rec.timestamp)
    if (Number.isNaN(t) || t < from || t > to) continue
    const content = rec.message?.content
    if (!Array.isArray(content)) continue
    for (const block of content) {
      if (block.type !== 'text') continue
      const text = (block.text ?? '').trim()
      if (!text) continue
      turns.push({ kind: 'said', at: t, who: rec.type, text })
    }
  }
  return turns
}

/** Merge actions and statements into one chronological sequence.
 *
 * Ties break with the statement first: a message is what prompted the tool
 * call recorded in the same millisecond, never a reaction to it. */
export function merge(actions, turns) {
  return [...actions, ...turns].sort((a, b) => {
    if (a.at !== b.at) return a.at - b.at
    if (a.kind === b.kind) return 0
    return a.kind === 'said' ? -1 : 1
  })
}

const clip = (s, n) => (s.length <= n ? s : `${s.slice(0, n - 1)}…`)

/** Render the sequence as markdown, ready to be read and quoted from. */
export function render(sequence, { detailChars = 300, textChars = 1200 } = {}) {
  if (sequence.length === 0) return '_Nothing in that window._\n'

  const out = []
  let lastMinute = null
  for (const item of sequence) {
    const iso = new Date(item.at).toISOString()
    const minute = iso.slice(0, 16).replace('T', ' ')
    if (minute !== lastMinute) {
      out.push(`\n### ${minute}Z\n`)
      lastMinute = minute
    }
    if (item.kind === 'action') {
      const who = item.seat === 'subagent' ? `${item.agentType ?? 'subagent'}` : 'main'
      const body = clip(item.detail.replace(/\s+/g, ' ').trim(), detailChars)
      out.push(`- **${item.tool}** _(${who})_${body ? ` — \`${body}\`` : ''}`)
    } else {
      const label = item.who === 'user' ? 'USER' : 'SAID'
      out.push(`\n> **${label}.** ${clip(item.text, textChars).replace(/\n/g, '\n> ')}\n`)
    }
  }
  return `${out.join('\n')}\n`
}

export function buildReport({ logText, transcriptText, window, cwd }) {
  const log = parseJsonl(logText)
  const actions = selectEvents(log.records, { ...window, cwd })
  const turns = transcriptText
    ? selectTurns(parseJsonl(transcriptText).records, window)
    : []
  return {
    markdown: render(merge(actions, turns)),
    actionCount: actions.length,
    turnCount: turns.length,
    skipped: log.skipped,
    transcripts: [...new Set(actions.map((a) => a.transcriptPath).filter(Boolean))],
  }
}

function usage() {
  return [
    'Usage: node scripts/investigation-window.mjs <window> [options]',
    '',
    '  <window>   ISO..ISO            e.g. 2026-08-28T20:00Z..2026-08-28T21:00Z',
    '             ISO+Nm | ISO+Nh     e.g. 2026-08-28T20:00Z+45m',
    '',
    '  --cwd <path>          only actions at or below this directory',
    '  --transcript <path>   transcript to interleave; inferred from the log if omitted',
    '  --log <path>          boundary log (default $SYNAPSE_BOUNDARY_LOG or ~/.claude/...)',
    '',
    'Prints markdown. Reads two files and writes nothing.',
  ].join('\n')
}

export function parseArgs(argv) {
  const opts = { window: null, cwd: null, transcript: null, log: null }
  const rest = []
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--cwd') { opts.cwd = argv[++i] ?? null }
    else if (a === '--transcript') { opts.transcript = argv[++i] ?? null }
    else if (a === '--log') { opts.log = argv[++i] ?? null }
    else rest.push(a)
  }
  opts.window = rest[0] ?? null
  return opts
}

function main(argv) {
  const opts = parseArgs(argv)
  const window = parseWindow(opts.window)
  if (window === null) {
    console.error(usage())
    process.exitCode = 1
    return
  }

  const logPath = opts.log || process.env.SYNAPSE_BOUNDARY_LOG || DEFAULT_LOG
  if (!existsSync(logPath)) {
    console.error(`No boundary log at ${logPath}`)
    process.exitCode = 1
    return
  }
  const logText = readFileSync(logPath, 'utf8')

  // Infer the transcript from the log when not given: the log records which
  // session made each call, so the window already knows where to look.
  let transcriptPath = opts.transcript
  if (!transcriptPath) {
    const probe = buildReport({ logText, transcriptText: '', window, cwd: opts.cwd })
    if (probe.transcripts.length === 1) transcriptPath = probe.transcripts[0]
    else if (probe.transcripts.length > 1) {
      console.error(`Window spans ${probe.transcripts.length} sessions. Pass --transcript with one of:`)
      for (const t of probe.transcripts) console.error(`  ${t}`)
      process.exitCode = 1
      return
    }
  }

  const transcriptText =
    transcriptPath && existsSync(transcriptPath) ? readFileSync(transcriptPath, 'utf8') : ''

  const report = buildReport({ logText, transcriptText, window, cwd: opts.cwd })
  if (!transcriptText) {
    console.error('(no transcript resolved -- actions only, statements omitted)')
  }
  if (report.skipped > 0) {
    console.error(`(skipped ${report.skipped} unparseable log line(s))`)
  }
  process.stdout.write(report.markdown)
}

const isEntryPoint =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isEntryPoint) main(process.argv.slice(2))
