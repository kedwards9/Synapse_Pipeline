#!/usr/bin/env node
// Prompt extractor.
//
// Prints, verbatim and in time order, every prompt a human typed in a date
// range. Written for reconstructing what was asked for during a piece of work
// when nobody remembers -- see docs/FINDINGS.md and docs/writing/.
//
// THREE THINGS ABOUT THE ON-DISK FORMAT, ALL MEASURED, ALL OF WHICH PRODUCED A
// PLAUSIBLE-LOOKING WRONG ANSWER FIRST:
//
// 1. A human prompt is stored with `message.content` as a plain STRING.
//    Assistant turns use an array of typed blocks, so filtering on the array
//    shape -- the obvious reading -- returns almost nothing. Measured: it
//    returned 1-4 prompts per session where the true count was 20-52. It looked
//    plausible enough to believe.
//
// 2. A message typed WHILE WORK IS ALREADY RUNNING is not a user turn at all.
//    It is a `queue-operation` record, written once on `enqueue` and again on
//    `remove` when consumed. Take `enqueue` only or every interruption appears
//    twice. These were missing entirely from the first extraction, and they are
//    the highest-signal prompts in any transcript: decisions made under time
//    pressure with incomplete information.
//
// 3. The project directory name encodes the working directory, and its case
//    follows however the path was typed that session. `E:\synapse` and
//    `<synapse>` produce two sibling directories holding overlapping files.
//    Scan both and deduplicate by filename.
//
// The `thinking` blocks in these files are empty strings carrying only a
// signature -- reasoning is not persisted. This script recovers what was asked
// and said, never what was thought.
//
// Read-only. Opens transcript files and writes nothing.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const PROJECTS_ROOT = join(homedir(), '.claude', 'projects')

// Harness-generated text that arrives in a user turn but was not typed by a
// person. ANCHORED TO THE START, not matched anywhere: a prompt that merely
// mentions one of these is still a prompt. Matching anywhere is the same
// substring-versus-position mistake that made a marker check fire on the
// sentence saying the marker was absent -- see docs/LESSONS.md.
export const SYNTHETIC_PREFIXES = Object.freeze([
  '<system-reminder',
  '<local-command-caveat',
  '<local-command-stdout',
  '<command-name',
  '<command-message',
  '<command-args',
  '<task-notification',
  'Base directory for this skill:',
  '[Request interrupted',
])

/** Default cut-off past which a prompt is recorded as a stub rather than in
 *  full. A paste is real input and belongs in the record, but one 90,000-char
 *  video transcript will bury every other prompt in the file. */
export const DEFAULT_PASTE_CHARS = 1500

export function isSynthetic(text, prefixes = SYNTHETIC_PREFIXES) {
  return prefixes.some((p) => text.startsWith(p)) ||
    /^Skill \/\S+ is already loaded/.test(text)
}

/** Parse JSONL, skipping unparseable lines rather than throwing. A live session
 *  may be appending, so a torn final line is expected, not exceptional. */
export function parseJsonl(text) {
  const records = []
  let skipped = 0
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue
    try { records.push(JSON.parse(line)) } catch { skipped += 1 }
  }
  return { records, skipped }
}

/** Pull the human-typed text out of one record, or null if it holds none.
 *  Returns `{ text, interrupted }` so callers can tell a mid-turn message from
 *  an ordinary one -- the distinction is most of this function's value. */
export function extractPrompt(record) {
  if (record?.type === 'queue-operation') {
    // `remove` is the same message being consumed. Counting it doubles every
    // interruption.
    if (record.operation !== 'enqueue') return null
    const text = (record.content ?? '').trim()
    return text ? { text, interrupted: true } : null
  }

  if (record?.type !== 'user') return null
  const content = record.message?.content

  // The string form is the one humans produce. The array form appears for tool
  // results and, rarely, a text block.
  if (typeof content === 'string') {
    const text = content.trim()
    return text ? { text, interrupted: false } : null
  }
  if (Array.isArray(content)) {
    const block = content.find((b) => b.type === 'text')
    const text = (block?.text ?? '').trim()
    return text ? { text, interrupted: false } : null
  }
  return null
}

/** Every prompt in one transcript's text, inside the window. */
export function selectPrompts(records, { from, to, pasteChars = DEFAULT_PASTE_CHARS }) {
  const out = []
  for (const record of records) {
    const at = Date.parse(record?.timestamp)
    if (Number.isNaN(at) || at < from || at > to) continue

    const got = extractPrompt(record)
    if (!got || isSynthetic(got.text)) continue

    if (got.text.length > pasteChars) {
      const opening = got.text.split('\n').find((l) => l.trim())?.trim() ?? ''
      out.push({
        at,
        interrupted: got.interrupted,
        pastedChars: got.text.length,
        text: `[PASTED — ${got.text.length.toLocaleString()} characters. Opens: "${opening.slice(0, 160)}…"]`,
      })
      continue
    }
    out.push({ at, interrupted: got.interrupted, pastedChars: null, text: got.text })
  }
  return out
}

/** Drop repeats of identical text, keeping the first. A mid-turn message is
 *  stored twice by design; this is what collapses it. */
export function dedupe(prompts) {
  const seen = new Set()
  return prompts.filter((p) => {
    const key = p.text.trim()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** The directory name a working-directory path encodes to. Each separator
 *  becomes its own dash, which is why `E:\synapse` is `E--synapse` and not
 *  `E-synapse` -- the colon and the backslash are two separators, not one. */
export function slugFor(projectPath) {
  return projectPath.replace(/[\\/:]/g, '-')
}

/** Whether a directory name is this project's, ignoring case.
 *
 *  Case is ignored rather than guessed because the directory name follows
 *  however the path was typed that session: `E--Synapse` and `E--synapse` both
 *  exist here and hold overlapping files. Enumerating spellings would mean
 *  inventing the ones nobody has typed yet; comparing case-insensitively
 *  against what is actually on disk cannot miss one. */
export function matchesSlug(dirName, slug) {
  return dirName.toLowerCase() === slug.toLowerCase()
}

/** Every project directory on disk belonging to this path. */
export function projectDirNames(projectPath, root = PROJECTS_ROOT) {
  const slug = slugFor(projectPath)
  let entries
  try { entries = readdirSync(root) } catch { return [] }
  return entries.filter((name) => matchesSlug(name, slug))
}

/** Read every transcript for a project, deduplicating files that appear under
 *  more than one directory casing. */
export function collect(projectPath, { from, to, root = PROJECTS_ROOT, pasteChars } = {}) {
  const seenFiles = new Set()
  let prompts = []
  let skipped = 0
  let files = 0

  for (const dirName of projectDirNames(projectPath, root)) {
    const dir = join(root, dirName)
    if (!existsSync(dir)) continue
    let entries
    try { if (!statSync(dir).isDirectory()) continue; entries = readdirSync(dir) } catch { continue }
    for (const name of entries) {
      if (!name.endsWith('.jsonl')) continue
      if (seenFiles.has(name)) continue
      seenFiles.add(name)
      files += 1
      let text
      try { text = readFileSync(join(dir, name), 'utf8') } catch { continue }
      const parsed = parseJsonl(text)
      skipped += parsed.skipped
      for (const p of selectPrompts(parsed.records, { from, to, pasteChars })) {
        prompts.push({ ...p, session: name.slice(0, 8) })
      }
    }
  }

  prompts.sort((a, b) => a.at - b.at)
  return { prompts: dedupe(prompts), files, skipped }
}

export function renderMarkdown(prompts) {
  if (prompts.length === 0) return '_No prompts in that range._\n'
  const out = []
  for (const p of prompts) {
    const stamp = new Date(p.at).toISOString().slice(0, 16).replace('T', ' ')
    const mark = p.interrupted ? ' *(sent mid-turn, while work was running)*' : ''
    out.push(`\n**${stamp}Z** · \`${p.session}\`${mark}\n`)
    out.push(p.text.split('\n').map((l) => `> ${l}`).join('\n'))
  }
  return `${out.join('\n')}\n`
}

export function renderPlain(prompts) {
  return prompts
    .map((p) => {
      const stamp = new Date(p.at).toISOString().slice(5, 16) + 'Z'
      return `${stamp}|${p.session}|${p.interrupted ? 'MID' : '   '}|${p.text.replace(/\s+/g, ' ')}`
    })
    .join('\n') + (prompts.length ? '\n' : '')
}

export function parseArgs(argv) {
  const opts = { project: process.cwd(), from: null, to: null, format: 'markdown' }
  const rest = []
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--project') opts.project = argv[++i] ?? opts.project
    else if (a === '--plain') opts.format = 'plain'
    else if (a === '--markdown') opts.format = 'markdown'
    else rest.push(a)
  }
  opts.from = rest[0] ?? null
  opts.to = rest[1] ?? null
  return opts
}

function usage() {
  return [
    'Usage: node scripts/prompt-record.mjs <from-ISO> [to-ISO] [options]',
    '',
    '  --project <path>   working directory whose transcripts to read',
    '                     (default: cwd; both path casings are scanned)',
    '  --plain            one line per prompt instead of markdown',
    '',
    'Prints every prompt a human typed in the range, verbatim, oldest first.',
    'Messages typed mid-turn are marked. Reasoning is NOT in these files.',
  ].join('\n')
}

function main(argv) {
  const opts = parseArgs(argv)
  const from = Date.parse(opts.from)
  const to = opts.to ? Date.parse(opts.to) : Date.now()
  if (Number.isNaN(from) || Number.isNaN(to) || to < from) {
    console.error(usage())
    process.exitCode = 1
    return
  }

  const { prompts, files, skipped } = collect(opts.project, { from, to })
  if (files === 0) {
    console.error(`No transcript directory for ${opts.project} under ${PROJECTS_ROOT}`)
    process.exitCode = 1
    return
  }
  if (skipped > 0) console.error(`(skipped ${skipped} unparseable line(s))`)
  console.error(`(${prompts.length} prompts from ${files} transcript file(s))`)
  process.stdout.write(opts.format === 'plain' ? renderPlain(prompts) : renderMarkdown(prompts))
}

const isEntryPoint =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isEntryPoint) main(process.argv.slice(2))
