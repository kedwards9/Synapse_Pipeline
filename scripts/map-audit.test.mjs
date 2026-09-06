import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { auditMap, backtickedTokens, COVERED_DIRS } from './map-audit.mjs'

// A throwaway tree shaped like the real one: scripts/ and watcher/src/, plus a
// MAP.md making whatever claims a test wants to check.
function fixture({ map = '', scripts = [], mainModules = [], dirs = [] } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'map-audit-'))
  mkdirSync(join(root, 'scripts'), { recursive: true })
  mkdirSync(join(root, 'watcher', 'src', 'main'), { recursive: true })
  for (const name of scripts) writeFileSync(join(root, 'scripts', name), '// x\n')
  for (const name of mainModules) writeFileSync(join(root, 'watcher', 'src', 'main', name), '// x\n')
  for (const dir of dirs) mkdirSync(join(root, dir), { recursive: true })
  const mapPath = join(root, 'MAP.md')
  writeFileSync(mapPath, map)
  return { root, mapPath, cleanup: () => rmSync(root, { recursive: true, force: true }) }
}

const run = (f) => auditMap({ root: f.root, mapPath: f.mapPath })

test('backtickedTokens pulls every citation out of the prose', () => {
  const tokens = backtickedTokens('see `a.mjs` and `scripts/` but not plain text')
  assert.deepEqual([...tokens].sort(), ['a.mjs', 'scripts/'])
})

test('a map that matches the tree passes', () => {
  const f = fixture({
    scripts: ['deploy.mjs'],
    mainModules: ['git-source.mjs'],
    map: 'The map: `deploy.mjs` and `git-source.mjs`.',
  })
  const { problems } = run(f)
  assert.deepEqual(problems, [])
  f.cleanup()
})

// Check 2 -- the hole an agent falls into by searching.
test('a module the map does not mention fails', () => {
  const f = fixture({
    mainModules: ['git-source.mjs', 'churn.mjs'],
    map: 'Only `git-source.mjs` is here.',
  })
  const { problems } = run(f)
  assert.equal(problems.length, 1)
  assert.match(problems[0], /churn\.mjs is not mentioned/)
  f.cleanup()
})

// Check 3 -- the direction that actively misleads, and the reason to run this.
test('a module the map names but the tree no longer has fails', () => {
  const f = fixture({
    mainModules: ['git-source.mjs'],
    map: '`git-source.mjs` and the long-gone `removed-thing.mjs`.',
  })
  const { problems } = run(f)
  assert.equal(problems.length, 1)
  assert.match(problems[0], /no longer exists/)
  f.cleanup()
})

// Check 1 -- directories.
test('a directory the map names but the tree does not have fails', () => {
  const f = fixture({ map: 'Records live in `specs/`.' })
  const { problems } = run(f)
  assert.equal(problems.length, 1)
  assert.match(problems[0], /names directory "specs\/"/)
  f.cleanup()
})

test('a directory that exists passes', () => {
  const f = fixture({ dirs: ['specs'], map: 'Records live in `specs/`.' })
  assert.deepEqual(run(f).problems, [])
  f.cleanup()
})

test('a home-relative or globbed path is not treated as a claim about this tree', () => {
  const f = fixture({ map: 'Deployed to `~/.claude/agents/` and matched by `src/**/*.mjs`.' })
  assert.deepEqual(run(f).problems, [])
  f.cleanup()
})

// Tests live beside the module they test. Listing thirty of them would bury
// the map, so they are out of scope in BOTH directions.
test('test files are neither required in the map nor checked when named', () => {
  const f = fixture({
    mainModules: ['git-source.mjs'],
    scripts: ['thing.test.mjs'],
    map: '`git-source.mjs`, and the suite in `gone.test.mjs`.',
  })
  assert.deepEqual(run(f).problems, [])
  f.cleanup()
})

test('the covered directories are the two the map claims to describe', () => {
  assert.deepEqual([...COVERED_DIRS], [join('watcher', 'src'), 'scripts'])
})

test('a missing MAP.md is a failure, not a silent pass', () => {
  const f = fixture({ map: '' })
  rmSync(f.mapPath)
  const { problems } = run(f)
  assert.equal(problems.length, 1)
  assert.match(problems[0], /not found/)
  f.cleanup()
})

test('every problem says what to do, not just what is wrong', () => {
  const f = fixture({
    mainModules: ['orphan.mjs'],
    map: 'Names `vanished.mjs`, which is gone.',
  })
  for (const problem of run(f).problems) {
    assert.ok(problem.length > 40, `terse problem gives the reader nothing to act on: ${problem}`)
  }
  f.cleanup()
})

// The real repository, not a fixture. This is the check that actually keeps the
// map honest day to day.
test('the real MAP.md agrees with the real tree', () => {
  const { problems, checked } = auditMap()
  assert.deepEqual(problems, [], 'run `node scripts/map-audit.mjs` to see what drifted')
  assert.ok(checked > 50, 'the audit should be checking a substantial number of claims')
})
