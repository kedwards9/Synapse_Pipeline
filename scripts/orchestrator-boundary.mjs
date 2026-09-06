#!/usr/bin/env node
// Orchestrator boundary observer -- a PreToolUse hook that measures, and does
// not enforce.
//
// WHY THIS EXISTS
//
// `agents/synapse-manager.md` says Manager never reads code, never edits files,
// and holds a Bash grant scoped to repo *state* and never repo *content*. Its
// own frontmatter appears to enforce that -- the `tools:` line grants no Read,
// Write, Edit, Grep or Glob at all.
//
// It does not. The same file documents the gap, at the bottom of its own
// historical note: that grant "only restricts which nested subagents Manager
// can spawn when Manager itself is run as the top-level `--agent
// synapse-manager` session -- it does not block Manager's own access to
// Read/Write/Edit/Bash/etc. in that mode ... The prose constraint above is the
// only real enforcement for top-level invocation."
//
// So the boundary that keeps the orchestrator from absorbing its specialists'
// work is a paragraph in a markdown file. That is the exact artifact the
// control-plane failure mode eats: rules front-of-mind at 2,000 tokens are
// background noise at 50,000. Two independent outside sources report the
// coordinator drifting into doing the work itself, and a hook is one of the
// three documented answers.
//
// WHY IT ONLY LOGS
//
// Because the discriminator is not yet known to be sufficient. `agent_type`
// arrives in the payload ONLY when the hook fires inside a subagent, so a
// dispatched specialist is identifiable and the main session is identifiable --
// but the main session running as `--agent synapse-manager` and an ordinary
// brainstorming session look *identical*. Both simply lack the field.
//
// A deny rule written on that discriminator would block Manager reading source
// (correct) and equally block a human's own session reading source (absurd).
// Whether anything in the payload separates them is an empirical question, and
// this hook is the instrument for answering it. It records what it *would* have
// done and then gets out of the way.
//
// Turning it into an enforcer later is a change to one function, `decide()`.
// Until the log says a clean rule exists, it stays out.
//
// SAFETY
//
// This runs in front of every tool call in the session. It must never throw,
// never block, and never write to stdout -- stdout from a PreToolUse hook is
// parsed for decision fields, so a stray byte could deny a call by accident.
// Every path here is wrapped, and the tests assert the invariant directly.

import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { pathToFileURL } from 'node:url'

// Kept out of the repo on purpose: it is machine-specific session data that
// churns every turn, the same reason the Watcher's config is not committed.
const DEFAULT_LOG = join(homedir(), '.claude', 'synapse-orchestrator-boundary.jsonl')

// Tools that read or change repository content. From the orchestrator seat
// every one of these is the boundary being crossed.
const FILE_TOOLS = new Set(['Read', 'Edit', 'Write', 'NotebookEdit', 'Grep', 'Glob'])

// What the seat is actually for. Dispatching, tracking, and asking.
const ORCHESTRATION_TOOLS = new Set([
  'Agent',
  'Task',
  'TodoWrite',
  'SendMessage',
  'AskUserQuestion',
  'ExitPlanMode',
  'EnterPlanMode',
])

const SHELL_TOOLS = new Set(['Bash', 'PowerShell'])

// Commands whose whole purpose is to emit file contents.
const CONTENT_COMMANDS = new Set([
  'cat', 'head', 'tail', 'less', 'more', 'nl', 'bat', 'strings', 'xxd', 'od',
  'type', 'get-content', 'gc', 'sed', 'awk',
  'grep', 'egrep', 'fgrep', 'rg', 'select-string', 'sls',
])

// `git diff` reports content unless one of these reduces it to a summary.
// `git diff --stat` is on Manager's own allowlist; bare `git diff` is not.
const GIT_DIFF_SUMMARY_FLAGS = new Set([
  '--stat', '--numstat', '--shortstat', '--name-only', '--name-status', '--dirstat',
])

const GIT_CONTENT_SUBCOMMANDS = new Set(['show', 'blame', 'cat-file', 'annotate'])

// Values that leave the hook recording. A project-scoped hook only ever saw
// one repository; this one runs machine-wide, so `detail` can carry a
// verbatim command body from client work or a private repo on every call.
// Anything not in this set disables the hook -- including "0", because that
// string is truthy in JS and typing it to mean "off" is exactly the mistake
// a bare `if (env.SYNAPSE_BOUNDARY_OFF)` would make silently.
const BOUNDARY_ON_VALUES = new Set(['', '0', 'false', 'no', 'off'])

/**
 * Is the machine-wide hook switched off for this call?
 * @param {NodeJS.ProcessEnv} env
 * @returns {boolean}
 */
export function isBoundaryOff(env = process.env) {
  const raw = env.SYNAPSE_BOUNDARY_OFF
  if (raw === undefined) return false
  const normalized = raw.trim().toLowerCase()
  return !BOUNDARY_ON_VALUES.has(normalized)
}

/** Strip a leading path and a `.exe` suffix, and lowercase. */
function commandName(token) {
  const bare = token.replace(/^.*[\\/]/, '').replace(/\.exe$/i, '')
  return bare.toLowerCase()
}

/** Does one shell segment (no operators) return the contents of a file? */
function segmentReadsContent(segment) {
  const tokens = segment.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return false

  const cmd = commandName(tokens[0])
  if (cmd !== 'git') return CONTENT_COMMANDS.has(cmd)

  const rest = tokens.slice(1)
  const sub = rest.find((t) => !t.startsWith('-'))
  if (!sub) return false
  if (GIT_CONTENT_SUBCOMMANDS.has(sub)) return true

  if (sub === 'diff') return !rest.some((t) => GIT_DIFF_SUMMARY_FLAGS.has(t))
  // `git log -p` is a diff wearing a hat.
  if (sub === 'log') return rest.some((t) => t === '-p' || t === '--patch' || t === '-u')

  return false
}

/**
 * Does a shell command line read repository content anywhere in it?
 * Split first -- a content reader hidden behind `&&` or a pipe still reads.
 * @param {string} command
 * @returns {boolean}
 */
export function readsRepoContent(command) {
  if (typeof command !== 'string' || command.trim() === '') return false
  return command
    .split(/\|\||&&|[|;\n]/)
    .some((segment) => segmentReadsContent(segment))
}

/** The most useful one-line summary of what the call was reaching for. */
function describe(payload) {
  const input = payload?.tool_input ?? {}
  if (typeof input.command === 'string') return input.command
  return String(input.file_path ?? input.path ?? input.pattern ?? '')
}

/**
 * What an enforcing version of this hook WOULD do, and why.
 * This is the single function that would change to turn the observer into a
 * gate. Nothing else here makes a decision.
 */
function decide(toolName, payload) {
  if (FILE_TOOLS.has(toolName)) return { wouldDeny: true, rule: 'file-tool' }
  if (ORCHESTRATION_TOOLS.has(toolName)) return { wouldDeny: false, rule: 'orchestration-tool' }
  if (SHELL_TOOLS.has(toolName)) {
    return readsRepoContent(payload?.tool_input?.command)
      ? { wouldDeny: true, rule: 'bash-content' }
      : { wouldDeny: false, rule: 'bash-state' }
  }
  return { wouldDeny: false, rule: 'other' }
}

/**
 * Classify one hook payload.
 * @param {object} payload parsed PreToolUse hook input
 * @returns {{seat: string, agentType: string|null, toolName: string|null,
 *            wouldDeny: boolean, rule: string, detail: string}}
 */
export function classify(payload) {
  const agentType = payload?.agent_type ?? null
  const toolName = payload?.tool_name ?? null
  const detail = describe(payload)

  // A dispatched specialist reading source is the pipeline working. The
  // boundary is about the seat, not about the tool.
  if (agentType) {
    return { seat: 'subagent', agentType, toolName, wouldDeny: false, rule: 'subagent-exempt', detail }
  }

  const { wouldDeny, rule } = decide(toolName, payload)
  return { seat: 'main', agentType: null, toolName, wouldDeny, rule, detail }
}

/**
 * Build the JSONL record for one call.
 * @param {object} payload
 * @param {() => string} clock injectable so tests are not time-dependent
 */
export function toRecord(payload, clock = () => new Date().toISOString()) {
  const v = classify(payload)
  return {
    at: clock(),
    sessionId: payload?.session_id ?? null,
    agentId: payload?.agent_id ?? null,
    agentType: v.agentType,
    seat: v.seat,
    toolName: v.toolName,
    rule: v.rule,
    wouldDeny: v.wouldDeny,
    detail: v.detail,
    cwd: payload?.cwd ?? null,
    permissionMode: payload?.permission_mode ?? null,
    // Carried because the main seat has no persona field. `agent_type` names a
    // dispatched specialist but is absent for the main session, so a session
    // running as `--agent synapse-manager` and an ordinary session are
    // identical in this payload. If any discriminator exists it is most likely
    // reachable from the transcript; capturing the path costs nothing and is
    // the difference between answering that question and re-running the whole
    // measurement to ask it.
    transcriptPath: payload?.transcript_path ?? null,
  }
}

/**
 * Run the hook over one payload. Never throws, never denies, never prints.
 * @param {string} stdinText raw hook input
 * @param {{logPath?: string, clock?: () => string, mkdir?: boolean, env?: NodeJS.ProcessEnv}} opts
 * @returns {Promise<{exitCode: number, stdout: string}>}
 */
export async function runHook(stdinText, opts = {}) {
  const { logPath = DEFAULT_LOG, clock, mkdir = true, env = process.env } = opts
  const silent = { exitCode: 0, stdout: '' }

  if (isBoundaryOff(env)) return silent

  let payload
  try {
    payload = JSON.parse(stdinText)
  } catch {
    return silent // unreadable input is not this hook's problem to report
  }
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return silent

  try {
    const record = toRecord(payload, clock)
    if (mkdir) mkdirSync(dirname(logPath), { recursive: true })
    appendFileSync(logPath, JSON.stringify(record) + '\n', 'utf8')
  } catch {
    // An unwritable log must never cost the user a tool call. Losing a
    // measurement is strictly cheaper than blocking the session.
  }
  return silent
}

/** Read all of stdin. Resolves to '' if nothing arrives. */
function readStdin() {
  return new Promise((resolve) => {
    let buf = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => { buf += chunk })
    process.stdin.on('end', () => resolve(buf))
    process.stdin.on('error', () => resolve(''))
  })
}

// Hand-building the `file://` URL gets the drive-letter case wrong on Windows
// (`file://E:/...` where Node emits `file:///E:/...`), which silently turns the
// hook into a no-op that still exits 0 -- indistinguishable from working.
// `pathToFileURL` is the only spelling that agrees with `import.meta.url` on
// both platforms.
const isEntryPoint =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isEntryPoint) {
  const logPath = process.env.SYNAPSE_BOUNDARY_LOG || DEFAULT_LOG
  readStdin()
    .then((text) => runHook(text, { logPath }))
    .catch(() => {})
    .finally(() => process.exit(0))
}
