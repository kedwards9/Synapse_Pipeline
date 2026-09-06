// Tests for commit-task.mjs.
//
// These run against real temporary git repositories rather than a mocked git,
// because the two failures this script exists to prevent are both *git*
// behaviours, not logic branches:
//
//   1. A blank line between `Co-Authored-By:` and `Session:` splits the trailer
//      block, and git then parses NO trailers at all. Nothing errors. The
//      commit looks fine and the ledger silently loses an entry. Handoff #17
//      recorded this; only asking git itself can prove it is handled.
//   2. Staging a path that sweeps more than it names. `git add .` and friends
//      capture a concurrent session's half-finished work under the wrong
//      author and the wrong trailer.
//
// A mock would happily agree with whatever we assumed about both.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { buildMessage, isDangerousPath, validateSessionValue } from './commit-task.mjs'

const SCRIPT = fileURLToPath(new URL('./commit-task.mjs', import.meta.url))

function repo() {
  const root = mkdtempSync(join(tmpdir(), 'commit-task-test-'))
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' })
  git('init', '-b', 'main')
  git('config', 'user.email', 'test@example.com')
  git('config', 'user.name', 'Test User')
  git('config', 'commit.gpgsign', 'false')
  writeFileSync(join(root, 'seed.txt'), 'seed\n')
  git('add', '--', 'seed.txt')
  git('commit', '-m', 'chore: seed')
  const write = (rel, text) => {
    const abs = join(root, rel)
    mkdirSync(join(abs, '..'), { recursive: true })
    writeFileSync(abs, text)
  }
  return { root, git, write, cleanup: () => rmSync(root, { recursive: true, force: true }) }
}

const run = (root, args) =>
  spawnSync(process.execPath, [SCRIPT, ...args], { cwd: root, encoding: 'utf8' })

const trailerOf = (git, key) =>
  git('log', '-1', `--format=%(trailers:key=${key},valueonly,separator=|)`).trim()

// ---------------------------------------------------------------------------
// Refusals. Each of these must fail LOUDLY rather than commit something wrong.
// ---------------------------------------------------------------------------

test('refuses to stage a path that sweeps the tree', () => {
  for (const p of ['.', '-A', '--all', '-a', ':/', '*', './']) {
    assert.equal(isDangerousPath(p), true, `${p} should be refused`)
  }
})

test('ordinary paths are not mistaken for sweeps', () => {
  for (const p of ['src/a.mjs', 'a.txt', 'docs/x/y.md', '.gitignore', '.claude/settings.json']) {
    assert.equal(isDangerousPath(p), false, `${p} should be allowed`)
  }
})

test('a session value must be a single clean token', () => {
  for (const v of ['manager', 'brainstorm', 'direct']) {
    assert.equal(validateSessionValue(v), true, `${v} should be valid`)
  }
  for (const v of ['', '  ', 'two words', 'has:colon', 'has\nnewline', 'a'.repeat(200)]) {
    assert.equal(validateSessionValue(v), false, `${JSON.stringify(v)} should be rejected`)
  }
})

test('refuses when no paths are given', () => {
  const r = repo()
  try {
    const out = run(r.root, ['--session', 'direct', '--subject', 'feat: x'])
    assert.notEqual(out.status, 0)
    assert.match(out.stderr, /path/i)
    assert.equal(r.git('log', '--oneline').trim().split('\n').length, 1, 'must not have committed')
  } finally {
    r.cleanup()
  }
})

test('refuses when --session is missing -- it never guesses a value', () => {
  const r = repo()
  try {
    r.write('a.txt', 'changed\n')
    const out = run(r.root, ['--subject', 'feat: x', 'a.txt'])
    assert.notEqual(out.status, 0)
    assert.match(out.stderr, /session/i)
  } finally {
    r.cleanup()
  }
})

test('refuses a named path that has no changes -- catches a typo', () => {
  const r = repo()
  try {
    r.write('real.txt', 'changed\n')
    const out = run(r.root, ['--session', 'direct', '--subject', 'feat: x', 'real.txt', 'typo.txt'])
    assert.notEqual(out.status, 0)
    assert.match(out.stderr, /typo\.txt/)
    assert.equal(r.git('log', '--oneline').trim().split('\n').length, 1, 'must not have committed')
  } finally {
    r.cleanup()
  }
})

test('refuses a path outside the repository', () => {
  const r = repo()
  try {
    const out = run(r.root, ['--session', 'direct', '--subject', 'feat: x', '../escape.txt'])
    assert.notEqual(out.status, 0)
    assert.match(out.stderr, /outside|escape/i)
  } finally {
    r.cleanup()
  }
})

// ---------------------------------------------------------------------------
// Staging discipline -- the concurrent-session rule, enforced not requested
// ---------------------------------------------------------------------------

test('commits ONLY the named paths and leaves the other session\'s work alone', () => {
  const r = repo()
  try {
    r.write('mine.txt', 'my work\n')
    r.write('theirs.txt', 'their half-finished work\n')

    const out = run(r.root, ['--session', 'direct', '--subject', 'feat: mine', 'mine.txt'])
    assert.equal(out.status, 0, out.stderr)

    const committed = r.git('show', '--name-only', '--format=', 'HEAD').trim().split('\n')
    assert.deepEqual(committed, ['mine.txt'])

    // Still sitting in the working tree, untouched and unstaged.
    assert.match(r.git('status', '--short'), /theirs\.txt/)
  } finally {
    r.cleanup()
  }
})

test('commits a new file inside a brand-new directory', () => {
  // git collapses untracked directories to `?? dir/` unless asked otherwise, so
  // a new file in a new directory reads as "no changes" and gets refused.
  // Found by using this script to commit its own introducing change.
  const r = repo()
  try {
    r.write('.claude/settings.json', '{}\n')
    const out = run(r.root, [
      '--session', 'brainstorm', '--subject', 'chore: add settings', '.claude/settings.json',
    ])
    assert.equal(out.status, 0, out.stderr)
    assert.deepEqual(
      r.git('show', '--name-only', '--format=', 'HEAD').trim().split('\n'),
      ['.claude/settings.json'],
    )
  } finally {
    r.cleanup()
  }
})

test('reports the files it deliberately did not stage', () => {
  const r = repo()
  try {
    r.write('mine.txt', 'mine\n')
    r.write('theirs.txt', 'theirs\n')
    const out = run(r.root, ['--session', 'direct', '--subject', 'feat: mine', 'mine.txt'])
    assert.equal(out.status, 0, out.stderr)
    assert.match(out.stdout, /theirs\.txt/, 'unstaged changes must be surfaced, not silently ignored')
  } finally {
    r.cleanup()
  }
})

// ---------------------------------------------------------------------------
// The trailer. This is the whole reason the script exists.
// ---------------------------------------------------------------------------

test('the Session trailer is actually parsed by git, not merely present as text', () => {
  const r = repo()
  try {
    r.write('a.txt', 'x\n')
    const out = run(r.root, ['--session', 'manager', '--subject', 'feat: a', 'a.txt'])
    assert.equal(out.status, 0, out.stderr)
    assert.equal(trailerOf(r.git, 'Session'), 'manager')
  } finally {
    r.cleanup()
  }
})

test('Session and Co-Authored-By BOTH parse when both are present', () => {
  // The #17 gotcha: these must share one paragraph. A blank line between them
  // splits the block and git returns nothing for either.
  const r = repo()
  try {
    r.write('a.txt', 'x\n')
    const out = run(r.root, [
      '--session', 'manager',
      '--subject', 'feat: a',
      '--co-author', 'Someone <someone@example.com>',
      'a.txt',
    ])
    assert.equal(out.status, 0, out.stderr)
    assert.equal(trailerOf(r.git, 'Session'), 'manager')
    assert.equal(trailerOf(r.git, 'Co-authored-by'), 'Someone <someone@example.com>')
  } finally {
    r.cleanup()
  }
})

test('a blank line silently drops whichever trailer sits above it', () => {
  // Proves the hazard is real, so the test above is not passing against a
  // format that was never at risk.
  //
  // Measured, and it corrects handoff #17's account of this gotcha. That entry
  // says a blank line means git "parses no trailers". Not so: git reads only
  // the LAST paragraph as the trailer block, so the split drops whatever is
  // ABOVE the blank line and the final trailer survives. The remedy #17
  // recorded -- keep them in one paragraph -- is right; its stated mechanism
  // is not.
  //
  // Consequence worth keeping: because `Session:` is written last, a future
  // formatting regression would eat `Co-Authored-By:` and leave attribution
  // intact. That is the safer of the two orderings, and it is not an accident.
  const r = repo()
  try {
    r.write('a.txt', 'x\n')
    r.git('add', '--', 'a.txt')
    r.git('commit', '-m', 'feat: a\n\nbody\n\nCo-Authored-By: S <s@example.com>\n\nSession: manager\n')
    assert.equal(trailerOf(r.git, 'Session'), 'manager', 'the last paragraph still parses')
    assert.equal(trailerOf(r.git, 'Co-authored-by'), '', 'the split-off trailer is silently lost')
  } finally {
    r.cleanup()
  }
})

test('a split costs the Session trailer, given the order this repo uses', () => {
  // `Session:` leads the block by convention, so it is the trailer a split
  // would destroy -- losing exactly the attribution the drift check reads.
  // That is why buildMessage owns the formatting instead of each caller.
  const r = repo()
  try {
    r.write('a.txt', 'x\n')
    r.git('add', '--', 'a.txt')
    r.git('commit', '-m', 'feat: a\n\nbody\n\nSession: manager\n\nCo-Authored-By: S <s@example.com>\n')
    assert.equal(trailerOf(r.git, 'Session'), '', 'Session would be the one lost')
  } finally {
    r.cleanup()
  }
})

test('the subject line is left exactly as given', () => {
  const r = repo()
  try {
    r.write('a.txt', 'x\n')
    const subject = 'fix(watcher): refuse --config-env and its siblings'
    const out = run(r.root, ['--session', 'manager', '--subject', subject, 'a.txt'])
    assert.equal(out.status, 0, out.stderr)
    assert.equal(r.git('log', '-1', '--format=%s').trim(), subject)
  } finally {
    r.cleanup()
  }
})

test('a body is preserved between subject and trailers', () => {
  const r = repo()
  try {
    r.write('a.txt', 'x\n')
    const out = run(r.root, [
      '--session', 'direct', '--subject', 'feat: a', '--body', 'Why this was done.', 'a.txt',
    ])
    assert.equal(out.status, 0, out.stderr)
    assert.match(r.git('log', '-1', '--format=%b'), /Why this was done\./)
    assert.equal(trailerOf(r.git, 'Session'), 'direct')
  } finally {
    r.cleanup()
  }
})

test('the message format keeps every trailer in one unbroken block', () => {
  const msg = buildMessage({
    subject: 'feat: x',
    body: 'Some body.',
    coAuthor: 'A <a@example.com>',
    session: 'manager',
    trailers: ['Claude-Session: https://example.com/s/1'],
  })
  const lines = msg.split('\n')
  const se = lines.findIndex((l) => l.startsWith('Session:'))
  const co = lines.findIndex((l) => l.startsWith('Co-Authored-By:'))
  const cs = lines.findIndex((l) => l.startsWith('Claude-Session:'))
  assert.ok(se !== -1 && co !== -1 && cs !== -1, 'all three trailers must be present')
  assert.equal(co, se + 1, 'no blank line may separate Session from Co-Authored-By')
  assert.equal(cs, co + 1, 'no blank line may separate Co-Authored-By from extra trailers')
})

test('extra --trailer values reach the commit and parse', () => {
  const r = repo()
  try {
    r.write('a.txt', 'x\n')
    const out = run(r.root, [
      '--session', 'brainstorm',
      '--subject', 'feat: a',
      '--co-author', 'Claude <noreply@anthropic.com>',
      '--trailer', 'Claude-Session: https://example.com/s/1',
      'a.txt',
    ])
    assert.equal(out.status, 0, out.stderr)
    assert.equal(trailerOf(r.git, 'Session'), 'brainstorm')
    assert.equal(trailerOf(r.git, 'Co-authored-by'), 'Claude <noreply@anthropic.com>')
    assert.equal(trailerOf(r.git, 'Claude-Session'), 'https://example.com/s/1')
  } finally {
    r.cleanup()
  }
})

test('reports the new commit so the caller can pass it on', () => {
  const r = repo()
  try {
    r.write('a.txt', 'x\n')
    const out = run(r.root, ['--session', 'direct', '--subject', 'feat: a', 'a.txt'])
    assert.equal(out.status, 0, out.stderr)
    const sha = r.git('rev-parse', '--short', 'HEAD').trim()
    assert.match(out.stdout, new RegExp(sha))
  } finally {
    r.cleanup()
  }
})
