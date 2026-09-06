#!/usr/bin/env node
// Commit one completed task.
//
// WHY THIS EXISTS
//
// Synapse's commit rules were prose in four places and enforced in none. The
// result, measured: 28 commits trailered `[manager]` in a repository where no
// Manager pipeline session had ever run, because `synapse-coder.md` hardcoded
// the value; and a documented silent failure where a blank line between
// `Co-Authored-By:` and `Session:` splits the trailer block so git parses
// neither, leaving a commit that looks correct and records nothing.
//
// Prose decides WHEN to commit -- that rule lives in `synapse-coder.md`, and it
// is now "after each task whose tests pass". This script decides nothing about
// timing. It exists so the mechanical half stops being re-derived by a model on
// every invocation:
//
//   - It CANNOT sweep the tree. It only ever stages the paths handed to it, and
//     refuses any argument that would expand to more than it names.
//   - It refuses a named path with no changes, which is what a typo looks like.
//   - It reports modified files it was NOT given and leaves them alone -- the
//     concurrent-session rule, enforced rather than requested.
//   - It never invents a `Session:` value. The dispatcher supplies it or the
//     run stops.
//   - It reads the trailer back out of git after committing, because "the text
//     is in the message" and "git parsed a trailer" are different claims and
//     only the second one matters.
//
// USAGE
//
//   node scripts/commit-task.mjs \
//     --session <value> \
//     --subject "<conventional commit subject>" \
//     [--body "<body text>"] \
//     [--co-author "Name <email>"] \
//     <path> [<path>...]

import { execFileSync } from 'node:child_process'
import { resolve, relative, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const FLAGS = {
  '--session': 'session',
  '--subject': 'subject',
  '--body': 'body',
  '--co-author': 'coAuthor',
}

// Arguments that stage more than they name. `.` is the whole tree; a leading
// `-` is a flag pretending to be a path; `*` and `?` are globs the shell may
// not have expanded; a leading `:` is git pathspec magic.
const SWEEP_TOKENS = new Set(['.', './', '.\\', '*', ':/', ':', '-A', '-a', '--all', '-u', '--update'])

/**
 * Would this argument stage more than the file it appears to name?
 * @param {string} p
 * @returns {boolean}
 */
export function isDangerousPath(p) {
  if (typeof p !== 'string') return true
  const t = p.trim()
  if (t === '') return true
  if (SWEEP_TOKENS.has(t)) return true
  if (t.startsWith('-')) return true
  if (t.startsWith(':')) return true
  return t.includes('*') || t.includes('?')
}

/**
 * A trailer value must survive git's own trailer parser: one token, no colon
 * (which would read as a second key), no whitespace, no newline.
 * @param {string} v
 * @returns {boolean}
 */
export function validateSessionValue(v) {
  if (typeof v !== 'string') return false
  const t = v.trim()
  if (t === '' || t.length > 40) return false
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(t)
}

/**
 * Assemble the commit message with every trailer in ONE unbroken block.
 * A blank line anywhere inside that block makes git parse none of it.
 * @param {{subject: string, body?: string, coAuthor?: string, session: string}} parts
 * @returns {string}
 */
export function buildMessage({ subject, body, coAuthor, session, trailers = [] }) {
  const blocks = [subject.trim()]
  if (body && body.trim()) blocks.push(body.trim())

  // `Session:` leads, matching the convention already in the history. That
  // makes it the trailer a split block would destroy first -- see the test
  // proving git drops whatever sits above a blank line -- which is precisely
  // why the whole block is assembled here and joined with single newlines
  // rather than being formatted by a caller each time.
  const block = [`Session: ${session.trim()}`]
  if (coAuthor && coAuthor.trim()) block.push(`Co-Authored-By: ${coAuthor.trim()}`)
  for (const t of trailers) {
    if (t && t.trim()) block.push(t.trim())
  }
  blocks.push(block.join('\n'))

  return blocks.join('\n\n') + '\n'
}

/** @param {string[]} argv */
export function parseArgs(argv) {
  const opts = { session: null, subject: null, body: null, coAuthor: null, trailers: [], paths: [] }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--') {
      opts.paths.push(...argv.slice(i + 1))
      break
    }
    if (arg === '--trailer') {
      const value = argv[++i]
      if (value === undefined) throw new Error('--trailer requires a "Key: value" argument')
      opts.trailers.push(value)
      continue
    }
    const key = FLAGS[arg]
    if (key) {
      const value = argv[++i]
      if (value === undefined) throw new Error(`${arg} requires a value`)
      opts[key] = value
      continue
    }
    opts.paths.push(arg)
  }
  return opts
}

const slash = (p) => p.split(sep).join('/').replace(/^\.\//, '')

/**
 * Parse `git status` into the set of changed repo-relative paths.
 *
 * `--untracked-files=all` is load-bearing. Without it git collapses an
 * untracked directory to a single entry -- `?? .claude/` rather than
 * `?? .claude/settings.json` -- and a brand-new file inside a brand-new
 * directory then looks like a path with no changes, so this script would refuse
 * to commit it. Found by using this script to commit itself.
 */
function changedPaths(git) {
  return git(['status', '--porcelain', '--untracked-files=all'])
    .split('\n')
    .map((line) => line.slice(3).trim())
    .filter(Boolean)
    .map((p) => {
      const unquoted = p.startsWith('"') && p.endsWith('"') ? p.slice(1, -1) : p
      // Renames arrive as `old -> new`; the new path is the one that has changes.
      const arrow = unquoted.lastIndexOf(' -> ')
      return slash(arrow === -1 ? unquoted : unquoted.slice(arrow + 4))
    })
}

function fail(message) {
  process.stderr.write(message + '\n')
  process.exit(1)
}

function main(argv) {
  let opts
  try {
    opts = parseArgs(argv)
  } catch (err) {
    return fail(err.message)
  }

  if (!opts.session) {
    return fail(
      'Refusing: no --session value given.\n' +
        'This script never invents one. Whoever dispatched you knows which kind of\n' +
        'session this is; ask them for the value rather than guessing.',
    )
  }
  if (!validateSessionValue(opts.session)) {
    return fail(
      `Refusing: --session "${opts.session}" is not a usable trailer value.\n` +
        'It must be a single token: letters, digits, dot, dash or underscore.',
    )
  }
  if (!opts.subject || !opts.subject.trim()) {
    return fail('Refusing: --subject is required and must be a conventional-commit subject.')
  }
  if (opts.paths.length === 0) {
    return fail(
      'Refusing: no path given.\n' +
        'Name every path this commit should contain. This script has no "everything"\n' +
        'mode by design -- a sweep captures another session\'s work under your name.',
    )
  }

  const sweeps = opts.paths.filter(isDangerousPath)
  if (sweeps.length > 0) {
    return fail(
      `Refusing: ${sweeps.map((s) => JSON.stringify(s)).join(', ')} would stage more than it names.\n` +
        'Pass explicit file paths only.',
    )
  }

  const git = (args, extra = {}) =>
    execFileSync('git', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...extra })

  let root
  try {
    root = git(['rev-parse', '--show-toplevel']).trim()
  } catch {
    return fail('Refusing: not inside a git repository.')
  }

  // Everything must live under the repository root. A path that escapes it is
  // either a mistake or an attempt to commit somebody else's tree.
  const rels = []
  for (const p of opts.paths) {
    const rel = slash(relative(resolve(root), resolve(process.cwd(), p)))
    if (rel === '' || rel.startsWith('../')) {
      return fail(`Refusing: "${p}" resolves outside the repository (${rel || '.'}).`)
    }
    rels.push(rel)
  }

  const changed = new Set(changedPaths(git))
  const isChanged = (rel) => changed.has(rel) || [...changed].some((c) => c.startsWith(rel + '/'))

  const inert = rels.filter((rel) => !isChanged(rel))
  if (inert.length > 0) {
    return fail(
      `Refusing: ${inert.join(', ')} ${inert.length === 1 ? 'has' : 'have'} no changes to commit.\n` +
        'A named path with nothing to stage is usually a typo, and committing the rest\n' +
        'quietly would hide it.',
    )
  }

  const named = new Set(rels)
  const untouched = [...changed].filter(
    (c) => !named.has(c) && !rels.some((rel) => c.startsWith(rel + '/')),
  )

  try {
    git(['add', '--', ...rels])
  } catch (err) {
    return fail(`Refusing: git add failed.\n${err.stderr || err.message}`)
  }

  const message = buildMessage({
    subject: opts.subject,
    body: opts.body,
    coAuthor: opts.coAuthor,
    session: opts.session,
    trailers: opts.trailers,
  })

  try {
    git(['commit', '-F', '-'], { input: message })
  } catch (err) {
    return fail(`Commit failed.\n${err.stdout || ''}${err.stderr || err.message}`)
  }

  // "The text is in the message" and "git parsed a trailer" are different
  // claims. Only the second one puts an entry in the ledger.
  const parsed = git([
    'log', '-1', '--format=%(trailers:key=Session,valueonly,separator=|)',
  ]).trim()

  const sha = git(['rev-parse', '--short', 'HEAD']).trim()

  if (parsed !== opts.session.trim()) {
    return fail(
      `Committed ${sha}, but git did not parse the Session trailer back out of it.\n` +
        `Expected "${opts.session.trim()}", got "${parsed}".\n` +
        'The commit exists and its content is correct; only its attribution is missing.\n' +
        'Report this rather than fixing it silently -- it means the message format regressed.',
    )
  }

  const lines = [`${sha}  ${opts.subject.trim()}`, `  staged: ${rels.join(', ')}`, `  Session: ${parsed}`]
  if (untouched.length > 0) {
    lines.push(
      `  left alone (${untouched.length}): ${untouched.join(', ')}`,
      '  ^ not staged. Either yours for a later commit, or another session work in',
      '    progress. If you did not change them, leave them alone and say so.',
    )
  }
  process.stdout.write(lines.join('\n') + '\n')
}

// Only run when invoked as a script. Without this guard, importing the module
// to test its pure functions executes main() against the test runner's argv.
// `pathToFileURL` is the spelling that matches `import.meta.url` on Windows --
// a hand-built `file://` string does not, and fails silently.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2))
}
