// Tests for scripts/agent-audit.mjs -- the agent definitions check themselves.
//
// Fixture-driven on purpose. Crafted agent files, not the real ones, so these
// tests do not break every time an agent is edited. The one exception is the
// final acceptance test, which runs against the real agents/ and asserts the
// two known defects are found -- see specs/2026-08-29-agent-audit-script.md
// section 7, case 13.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  auditAgents, parseAgent, expandGrants,
  classifyCommands, subcommandOf, forbiddenTokens,
} from './agent-audit.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REAL_AGENTS = join(HERE, '..', 'agents')

/** Write agent files into a throwaway directory and audit it. */
function auditFixture(files) {
  const dir = mkdtempSync(join(tmpdir(), 'agent-audit-'))
  try {
    mkdirSync(dir, { recursive: true })
    for (const [name, body] of Object.entries(files)) {
      writeFileSync(join(dir, name), body, 'utf8')
    }
    return auditAgents(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const ALLOWLIST_BLOCK = `
Allowed, and the only commands you may run unprompted:

    git status --short
    git rev-parse HEAD
    git log --oneline -10

Forbidden, without exception: \`cat\`, \`head\`, \`grep\`, and any pipe
or redirect whose effect is to print file contents.
`

function agent(name, tools, body) {
  return `---\nname: ${name}\ntools: ${tools}\n---\n\n${body}\n`
}

const findingsOfKind = (r, kind) => r.findings.filter((f) => f.kind === kind)

// ---------------------------------------------------------------- commands

test('case 1: an instructed command using a forbidden token fails', () => {
  const r = auditFixture({
    'a.md': agent('a', 'Bash', `${ALLOWLIST_BLOCK}\nRun this:\n\n    head -1 <path> | grep -c "marker"\n`),
  })
  const f = findingsOfKind(r, 'forbidden-token')
  assert.equal(f.length, 1, 'expected exactly one forbidden-token finding')
  assert.equal(f[0].severity, 'fail')
  assert.ok(f[0].tokens.includes('head'), 'names head')
  assert.ok(f[0].tokens.includes('grep'), 'names grep')
  assert.ok(f[0].tokens.includes('pipe'), 'names the pipe')
})

test('case 2: an instructed git subcommand absent from the allow-list fails', () => {
  const r = auditFixture({
    'a.md': agent('a', 'Bash', `${ALLOWLIST_BLOCK}\nRun this:\n\n    git hash-object <path>\n`),
  })
  const f = findingsOfKind(r, 'unlisted-subcommand')
  assert.equal(f.length, 1)
  assert.equal(f[0].severity, 'fail')
  assert.equal(f[0].subcommand, 'hash-object')
})

test('case 3: an instructed command exactly matching an allow-list entry passes', () => {
  const r = auditFixture({
    'a.md': agent('a', 'Bash', `${ALLOWLIST_BLOCK}\nRun this:\n\n    git rev-parse HEAD\n`),
  })
  assert.equal(findingsOfKind(r, 'unlisted-subcommand').length, 0)
  assert.equal(findingsOfKind(r, 'form-differs').length, 0)
})

test('case 4: an allowed subcommand with different flags warns, never fails', () => {
  const r = auditFixture({
    'a.md': agent('a', 'Bash', `${ALLOWLIST_BLOCK}\nRun this:\n\n    git log -1 --format='%h' -- <path>\n`),
  })
  const f = findingsOfKind(r, 'form-differs')
  assert.equal(f.length, 1)
  assert.equal(f[0].severity, 'warn', 'a differing form is a judgement, not a violation')
  assert.equal(findingsOfKind(r, 'unlisted-subcommand').length, 0, 'log IS in the allow-list')
})

test('case 5: an allowed form plus a trailing pathspec passes', () => {
  const r = auditFixture({
    'a.md': agent('a', 'Bash', `${ALLOWLIST_BLOCK}\nRun this:\n\n    git status --short -- <path>\n`),
  })
  assert.equal(r.findings.filter((f) => f.severity === 'fail').length, 0)
  assert.equal(findingsOfKind(r, 'form-differs').length, 0, 'a pathspec is not a different form')
})

// ------------------------------------------------------------------ grants

test('case 6: a granted tool never mentioned in the body warns', () => {
  const r = auditFixture({ 'a.md': agent('a', 'Read, TodoWrite', 'You use Read on files.\n') })
  const f = findingsOfKind(r, 'ungrounded-grant')
  assert.equal(f.length, 1, 'Read is mentioned; TodoWrite is not')
  assert.equal(f[0].severity, 'warn')
  assert.equal(f[0].grant, 'TodoWrite')
})

test('case 7: an Agent(a, b) grant is satisfied by the body naming its members', () => {
  const r = auditFixture({
    'a.md': agent('a', 'Agent(synapse-coder, synapse-reviewer)',
      'Dispatch synapse-coder, then synapse-reviewer.\n'),
  })
  assert.equal(findingsOfKind(r, 'ungrounded-grant').length, 0)
})

test('case 8: an Agent(a, b) grant naming neither member warns per member', () => {
  const r = auditFixture({
    'a.md': agent('a', 'Agent(synapse-coder, synapse-reviewer)', 'You do nothing.\n'),
  })
  const f = findingsOfKind(r, 'ungrounded-grant')
  assert.equal(f.length, 2, 'one finding per unmentioned member, not one for the whole grant')
  assert.deepEqual(f.map((x) => x.grant).sort(), ['synapse-coder', 'synapse-reviewer'])
})

test('an MCP grant is grounded by its server name, not each tool name', () => {
  const r = auditFixture({
    'a.md': agent('a', 'mcp__pixellab__create_character, mcp__pixellab__get_image',
      'You generate assets using the PixelLab MCP server.\n'),
  })
  assert.equal(findingsOfKind(r, 'ungrounded-grant').length, 0,
    'naming PixelLab once grounds every pixellab tool -- enumerating 34 of them is not the ask')
})

test('an MCP grant whose server is never named still warns', () => {
  const r = auditFixture({
    'a.md': agent('a', 'mcp__pixellab__create_character', 'You write documents.\n'),
  })
  const f = findingsOfKind(r, 'ungrounded-grant')
  assert.equal(f.length, 1)
  assert.match(f[0].detail, /never mentions pixellab/)
})

test('grant matching is case-insensitive: prose "read the plan" grounds Read', () => {
  const r = auditFixture({ 'a.md': agent('a', 'Read', 'Always read the plan first.\n') })
  assert.equal(findingsOfKind(r, 'ungrounded-grant').length, 0)
})

test('expandGrants splits Agent(...) into members and leaves plain tools alone', () => {
  assert.deepEqual(
    expandGrants('Read, Agent(a, b), Bash'),
    ['Read', 'a', 'b', 'Bash'],
  )
})

// ------------------------------------------------------------- structure

test('case 9: an agent with no allow-list gets grant checks only', () => {
  const r = auditFixture({
    'a.md': agent('a', 'Bash', 'You run Bash.\n\n    git hash-object <path>\n'),
  })
  assert.equal(findingsOfKind(r, 'unlisted-subcommand').length, 0,
    'no allow-list means nothing to contradict')
  assert.equal(findingsOfKind(r, 'forbidden-token').length, 0)
})

test('case 10: the consent-gated push block is not read as an instruction', () => {
  const r = auditFixture({
    'a.md': agent('a', 'Bash', `${ALLOWLIST_BLOCK}
Allowed only after the user explicitly says yes, in this session, to
this specific push:

    git push
`),
  })
  assert.equal(findingsOfKind(r, 'unlisted-subcommand').length, 0,
    'push sits under its own permission heading, not as an instruction')
})

test('case 11: an empty agents directory exits clean rather than crashing', () => {
  const r = auditFixture({})
  assert.equal(r.findings.length, 0)
  assert.equal(r.agents.length, 0)
  assert.equal(r.failed, 0)
})

test('case 12: an agent file with no tools line is reported, not fatal', () => {
  const r = auditFixture({ 'a.md': '---\nname: a\n---\n\nNo tools line here.\n' })
  const f = findingsOfKind(r, 'no-tools-line')
  assert.equal(f.length, 1)
  assert.equal(f[0].severity, 'warn')
})

test('parseAgent reads the name and tools out of frontmatter', () => {
  const a = parseAgent('x.md', agent('synapse-x', 'Read, Bash', 'body'))
  assert.equal(a.name, 'synapse-x')
  assert.deepEqual(a.grants, ['Read', 'Bash'])
})

// ------------------------------------------------- classifier, positively
//
// An audit on 2026-08-29 mutated classifyCommands to return everything as
// instructions and 15 of 19 tests still passed -- they asserted the ABSENCE of
// findings, and absence is exactly what a gutted classifier produces. These
// assert the buckets directly, so the mutant cannot survive.

test('classifyCommands puts allow-list entries in allowed, not instructed', () => {
  const { instructed, allowed } = classifyCommands(ALLOWLIST_BLOCK)
  assert.deepEqual(allowed, ['git status --short', 'git rev-parse HEAD', 'git log --oneline -10'])
  assert.deepEqual(instructed, [], 'nothing here is an instruction')
})

test('classifyCommands keeps consent-gated commands out of BOTH buckets', () => {
  const body = ALLOWLIST_BLOCK + `
Allowed only after the user explicitly says yes, in this session, to
this specific push:

    git push
`
  const { instructed, allowed, consent } = classifyCommands(body)
  assert.deepEqual(consent, ['git push'])
  assert.ok(!instructed.includes('git push'), 'not an instruction')
  assert.ok(!allowed.includes('git push'), 'not an unconditional allow-list entry')
})

test('a SECOND allow-list block after prose is still the allow-list', () => {
  const body = ALLOWLIST_BLOCK + `
Some prose in between that ends the first block.

Also allowed, and the only commands you may run unprompted:

    git show --stat
`
  const { allowed, instructed } = classifyCommands(body)
  assert.ok(allowed.includes('git show --stat'), 'a later allow-list block is allow-list')
  assert.ok(!instructed.includes('git show --stat'), 'and is NOT audited as an instruction')
})

test('an instruction between an intro and its block is not absorbed as allow-list', () => {
  const body = `
Allowed, and the only commands you may run unprompted:

Some prose that separates the intro from a DIFFERENT block.

    head -1 <path> | grep -c x

Forbidden, without exception: \`head\`, \`grep\`, and any pipe.
`
  const { allowed } = classifyCommands(body)
  assert.ok(!allowed.includes('head -1 <path> | grep -c x'),
    'a forbidden command must never be absorbed as the allow-list -- that inverts the audit')
})

// ------------------------------------------------------------ fail-open

test('a reworded allow-list intro FAILS loudly rather than silently passing', () => {
  const r = auditFixture({
    'a.md': agent('a', 'Bash', `
**Allowed**, and the only commands you may run unprompted:

    git status --short

Run this:

    git hash-object <path>
`),
  })
  assert.ok(r.failed > 0, 'an unrecognised allow-list must never exit clean')
})

test('a missing agents directory fails rather than reporting zero agents clean', () => {
  const r = auditAgents(join(tmpdir(), 'agent-audit-no-such-dir-xyz'))
  assert.equal(r.failed, 1)
  assert.equal(r.findings[0].kind, 'unreadable-directory')
})

// --------------------------------------------------------- parsing edges

test('subcommandOf skips global git flags and their values', () => {
  assert.equal(subcommandOf('git -C <dir> status --short'), 'status')
  assert.equal(subcommandOf('git --no-pager log --oneline'), 'log')
  assert.equal(subcommandOf('npm test'), null)
})

test('forbiddenTokens extracts multi-word entries such as `git show`', () => {
  const { words, phrases, pipe, redirect } = forbiddenTokens(
    'Forbidden, without exception: `cat`, `head`, `git show`, any pipe or redirect.')
  assert.ok(words.includes('head'))
  assert.ok(phrases.includes('git show'), 'a two-word forbidden entry must be extracted')
  assert.equal(pipe, true)
  assert.equal(redirect, true)
})

test('a forbidden command is caught even when quoted or redirected', () => {
  const r = auditFixture({
    'a.md': agent('a', 'Bash', `${ALLOWLIST_BLOCK}
Run:

    git status --short > /tmp/out
`),
  })
  const f = findingsOfKind(r, 'forbidden-token')
  assert.equal(f.length, 1)
  assert.ok(f[0].tokens.includes('redirect'), 'the forbidden list says "or redirect"')
})

// ---------------------------------------------------------- acceptance

// Case 13 previously asserted the real directory STILL CARRIED both defects --
// `git hash-object` instructed but unlisted, and `head -1 | grep -c` using three
// forbidden tokens. Both were fixed on 2026-08-29 when Manager took the commit
// gate and the worktree step, so the assertion inverts. It is kept as an
// acceptance test rather than deleted: what it guards is that those two
// specific defects do not come back.
test('case 13: the real agents/ directory carries neither of the two fixed defects', () => {
  const r = auditAgents(REAL_AGENTS)
  const manager = r.findings.filter((f) => f.agent === 'synapse-manager')

  const hashObject = manager.find(
    (f) => f.kind === 'unlisted-subcommand' && f.subcommand === 'hash-object')
  assert.equal(hashObject, undefined,
    'git hash-object is now in Manager\'s allow-list, named to the fingerprint step')

  const piped = manager.find((f) => f.kind === 'forbidden-token')
  assert.equal(piped, undefined,
    'the marker check is listed verbatim in the allow-list, so it is a carve-out not a contradiction')

  assert.equal(manager.filter((f) => f.severity === 'fail').length, 0,
    'Manager no longer contradicts itself')
})

// ------------------------------------------------- the named carve-out

test('a forbidden-token command listed VERBATIM in the allow-list is exempt', () => {
  const marker = 'head -1 <path> | grep -c "synapse-pipeline-artifact"'
  const r = auditFixture({
    'a.md': agent('a', 'Bash', `
Allowed, and the only commands you may run unprompted:

    git status --short
    ${marker}

Forbidden, without exception: \`cat\`, \`head\`, \`grep\`, and any pipe
or redirect whose effect is to print file contents.

Run this:

    ${marker}
`),
  })
  assert.equal(findingsOfKind(r, 'forbidden-token').length, 0,
    'listing it in the allow-list is a deliberate permission, not a contradiction')
  assert.equal(findingsOfKind(r, 'non-git-instruction').length, 0,
    'an exact allow-list match also settles the not-a-git-command question')
  assert.equal(r.failed, 0)
})

test('the carve-out matches through whitespace differences only', () => {
  const r = auditFixture({
    'a.md': agent('a', 'Bash', `
Allowed, and the only commands you may run unprompted:

    git status --short
    head -1 <path> | grep -c "marker"

Forbidden, without exception: \`cat\`, \`head\`, \`grep\`, and any pipe
or redirect whose effect is to print file contents.

Run this:

    head  -1   <path>  |  grep -c "marker"
`),
  })
  assert.equal(findingsOfKind(r, 'forbidden-token').length, 0,
    'spacing is not a semantic difference')
})

test('the carve-out does NOT excuse a similar command -- it is exact, not a family', () => {
  const r = auditFixture({
    'a.md': agent('a', 'Bash', `
Allowed, and the only commands you may run unprompted:

    git status --short
    head -1 <path> | grep -c "marker"

Forbidden, without exception: \`cat\`, \`head\`, \`grep\`, and any pipe
or redirect whose effect is to print file contents.

Run this:

    head -20 <path> | grep "marker"
`),
  })
  const f = findingsOfKind(r, 'forbidden-token')
  assert.equal(f.length, 1,
    'dropping -c and widening to 20 lines prints content -- exactly what the rule forbids')
  assert.equal(f[0].severity, 'fail')
  assert.ok(f[0].tokens.includes('head'))
  assert.ok(f[0].tokens.includes('grep'))
  assert.ok(f[0].tokens.includes('pipe'))
})

test('an unlisted forbidden-token command still fails when a carve-out exists elsewhere', () => {
  const r = auditFixture({
    'a.md': agent('a', 'Bash', `
Allowed, and the only commands you may run unprompted:

    git status --short
    head -1 <path> | grep -c "marker"

Forbidden, without exception: \`cat\`, \`head\`, \`grep\`, and any pipe
or redirect whose effect is to print file contents.

Run this:

    cat <path> | grep "something"
`),
  })
  const f = findingsOfKind(r, 'forbidden-token')
  assert.equal(f.length, 1, 'one carve-out does not open the forbidden list')
  assert.ok(f[0].tokens.includes('cat'))
})

test('every agent definition parses and yields a name', () => {
  const r = auditAgents(REAL_AGENTS)
  assert.equal(r.agents.length, 7, 'seven agents ship today')
  for (const a of r.agents) assert.ok(a.name, `${a.file} has a name`)
})
