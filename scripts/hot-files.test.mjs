// Tests for the composition-root detector.
// Run with: node --test scripts/hot-files.test.mjs
// No dependencies — node:test is built in.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { analyze, parseGitLog, report } from './hot-files.mjs'

// A file that changes alongside everything else is a composition root.
// A file that changes often but always with the same neighbours is not.
test('ranks a broadly co-changing file above an equally busy leaf', () => {
  const commits = [
    ['main.ts', 'combat/attack.ts'],
    ['main.ts', 'camera/follow.ts'],
    ['main.ts', 'ui/hud.ts'],
    ['leaf.ts', 'leaf.spec.ts'],
    ['leaf.ts', 'leaf.spec.ts'],
    ['leaf.ts', 'leaf.spec.ts'],
  ]

  const { candidates } = analyze(commits, { minCommits: 3 })

  const main = candidates.find((c) => c.file === 'main.ts')
  const leaf = candidates.find((c) => c.file === 'leaf.ts')

  assert.equal(main.commits, 3)
  assert.equal(leaf.commits, 3)
  assert.equal(main.partners, 3, 'main.ts co-changed with three distinct files')
  assert.equal(leaf.partners, 1, 'leaf.ts only ever co-changed with its spec')
  assert.equal(candidates[0].file, 'main.ts', 'breadth breaks the tie, not frequency')
})

test('excludes files below the commit threshold', () => {
  const commits = [
    ['a.ts', 'b.ts'],
    ['a.ts', 'c.ts'],
    ['b.ts', 'd.ts'],
  ]

  const { candidates } = analyze(commits, { minCommits: 3 })
  assert.deepEqual(candidates, [], 'no file reaches 3 commits')

  const relaxed = analyze(commits, { minCommits: 2 })
  assert.deepEqual(
    relaxed.candidates.map((c) => c.file),
    ['a.ts', 'b.ts'],
    'at a threshold of 2, a.ts and b.ts qualify',
  )
})

// A bulk import or a repo-wide reformat makes every file look like it
// co-changes with everything. Those commits are not feature work.
test('skips oversized commits and reports how many', () => {
  const bulk = Array.from({ length: 40 }, (_, i) => `vendor/f${i}.ts`)
  const commits = [
    bulk,
    ['main.ts', 'a.ts'],
    ['main.ts', 'b.ts'],
    ['main.ts', 'c.ts'],
  ]

  const result = analyze(commits, { minCommits: 3, maxCommitSize: 25 })

  assert.equal(result.commitsAnalyzed, 3)
  assert.equal(result.commitsSkipped, 1)
  assert.equal(
    result.candidates.filter((c) => c.file.startsWith('vendor/')).length,
    0,
    'the bulk commit contributed nothing',
  )
})

test('a file touched once never appears, whatever its breadth', () => {
  const commits = [['solo.ts', 'a.ts', 'b.ts', 'c.ts', 'd.ts']]
  const { candidates } = analyze(commits, { minCommits: 3 })
  assert.deepEqual(candidates, [])
})

test('handles empty history without throwing', () => {
  const result = analyze([], { minCommits: 3 })
  assert.deepEqual(result.candidates, [])
  assert.equal(result.commitsAnalyzed, 0)
  assert.equal(result.commitsSkipped, 0)
})

// A file is not its own co-change partner.
test('does not count a file as a partner of itself', () => {
  const commits = [['only.ts'], ['only.ts'], ['only.ts']]
  const { candidates } = analyze(commits, { minCommits: 3 })
  assert.equal(candidates[0].partners, 0)
})

test('parses git log output into commits', () => {
  // Format is: NUL, hash, newline, one file per line.
  const raw = '\0abc123\nsrc/main.ts\nsrc/a.ts\n\n\0def456\nsrc/main.ts\n\n'
  assert.deepEqual(parseGitLog(raw), [
    ['src/main.ts', 'src/a.ts'],
    ['src/main.ts'],
  ])
})

test('parses a commit with no file changes as an empty commit', () => {
  const raw = '\0abc123\n\n\0def456\nsrc/a.ts\n\n'
  assert.deepEqual(parseGitLog(raw), [[], ['src/a.ts']])
})

test('parses empty git output as no commits', () => {
  assert.deepEqual(parseGitLog(''), [])
  assert.deepEqual(parseGitLog('\n'), [])
})

// --- Path filtering -------------------------------------------------------
// A coordination doc that moves with every feature genuinely IS a collision
// point — the spec says so — it just wants a different remedy than a registry.
// So exclusion sets a file aside and reports it; it never silently drops it.

test('sets excluded files aside instead of dropping them', () => {
  const commits = [
    ['main.ts', 'NOTES.md', 'a.ts'],
    ['main.ts', 'NOTES.md', 'b.ts'],
    ['main.ts', 'NOTES.md', 'c.ts'],
  ]

  const { candidates, excluded } = analyze(commits, { minCommits: 3 })

  assert.deepEqual(
    candidates.map((c) => c.file),
    ['main.ts'],
    'the markdown file is not ranked as a seam candidate',
  )
  assert.deepEqual(
    excluded.map((c) => c.file),
    ['NOTES.md'],
    'but it is still reported — it is a real collision point',
  )
  assert.equal(excluded[0].commits, 3, 'excluded rows keep their real numbers')
})

test('exclusion changes ranking eligibility, not partner counts', () => {
  const commits = [
    ['main.ts', 'README.md', 'a.ts'],
    ['main.ts', 'README.md', 'b.ts'],
    ['main.ts', 'README.md', 'c.ts'],
  ]

  const withDefaults = analyze(commits, { minCommits: 3 })
  const withNone = analyze(commits, { minCommits: 3, exclude: [] })

  const mainFiltered = withDefaults.candidates.find((c) => c.file === 'main.ts')
  const mainUnfiltered = withNone.candidates.find((c) => c.file === 'main.ts')

  assert.equal(
    mainFiltered.partners,
    mainUnfiltered.partners,
    'excluding a file must not change any other file\'s breadth',
  )
})

test('honours custom exclude patterns', () => {
  const commits = [
    ['src/main.ts', 'vendor/lib.ts'],
    ['src/main.ts', 'vendor/lib.ts'],
    ['src/main.ts', 'vendor/lib.ts'],
  ]

  const { candidates, excluded } = analyze(commits, {
    minCommits: 3,
    exclude: [/^vendor\//],
  })

  assert.deepEqual(candidates.map((c) => c.file), ['src/main.ts'])
  assert.deepEqual(excluded.map((c) => c.file), ['vendor/lib.ts'])
})

test('excludes lockfiles by default', () => {
  const commits = [
    ['main.ts', 'package-lock.json'],
    ['main.ts', 'package-lock.json'],
    ['main.ts', 'package-lock.json'],
  ]

  const { candidates } = analyze(commits, { minCommits: 3 })
  assert.deepEqual(candidates.map((c) => c.file), ['main.ts'])
})

test('an excluded file below the threshold is not reported at all', () => {
  const commits = [['main.ts', 'NOTES.md'], ['main.ts', 'a.ts'], ['main.ts', 'b.ts']]

  const { excluded } = analyze(commits, { minCommits: 3 })
  assert.deepEqual(excluded, [], 'the threshold applies to excluded rows too')
})

// --- Coupled breadth ------------------------------------------------------
// Breadth alone cannot tell co-evolution from commit size: a file that sat in
// a few wide commits shows partners it will never move with again. `coupled`
// counts only partners that recur, so the gap between the two exposes it.

test('separates co-evolution from commit-size artefact', () => {
  const commits = [
    // Three wide commits, never the same neighbours twice.
    ['artefact.ts', 'a1.ts', 'a2.ts', 'a3.ts', 'a4.ts'],
    ['artefact.ts', 'b1.ts', 'b2.ts', 'b3.ts', 'b4.ts'],
    ['artefact.ts', 'c1.ts', 'c2.ts', 'c3.ts', 'c4.ts'],
    // A real root: fewer partners, but it keeps meeting the same ones.
    ['root.ts', 'x.ts', 'y.ts'],
    ['root.ts', 'x.ts', 'z.ts'],
    ['root.ts', 'y.ts', 'z.ts'],
  ]

  const { candidates } = analyze(commits, { minCommits: 3 })
  const artefact = candidates.find((c) => c.file === 'artefact.ts')
  const root = candidates.find((c) => c.file === 'root.ts')

  assert.equal(artefact.partners, 12, 'twelve one-shot neighbours')
  assert.equal(artefact.coupled, 0, 'none of them ever recurred')
  assert.equal(root.partners, 3)
  assert.equal(root.coupled, 3, 'every partner shared two commits')

  assert.ok(
    artefact.partners > root.partners && artefact.coupled < root.coupled,
    'the two numbers disagree — which is the whole point of reporting both',
  )
})

// This is a deliberate design decision, not an oversight. A composition root's
// partners are often one-shot by nature: feature X touches the root and X's
// own files, once. Ranking on `coupled` would demote real roots and promote a
// leaf that always moves with its own spec. So `coupled` informs, never orders.
test('coupled is reported but never changes the ranking', () => {
  const commits = [
    ['artefact.ts', 'a1.ts', 'a2.ts', 'a3.ts', 'a4.ts'],
    ['artefact.ts', 'b1.ts', 'b2.ts', 'b3.ts', 'b4.ts'],
    ['artefact.ts', 'c1.ts', 'c2.ts', 'c3.ts', 'c4.ts'],
    ['root.ts', 'x.ts', 'y.ts'],
    ['root.ts', 'x.ts', 'z.ts'],
    ['root.ts', 'y.ts', 'z.ts'],
  ]

  const order = (n) =>
    analyze(commits, { minCommits: 3, minSharedCommits: n }).candidates.map((c) => c.file)

  assert.deepEqual(order(1), order(5), 'the bar moves no rows')
  assert.equal(order(2)[0], 'artefact.ts', 'still ranked by breadth, coupled 0 and all')
})

test('honours a custom shared-commit bar', () => {
  const commits = [
    ['main.ts', 'a.ts', 'b.ts'],
    ['main.ts', 'a.ts', 'c.ts'],
    ['main.ts', 'a.ts', 'd.ts'],
  ]

  const main = (n) =>
    analyze(commits, { minCommits: 3, minSharedCommits: n }).candidates.find(
      (c) => c.file === 'main.ts',
    )

  assert.equal(main(1).coupled, 4, 'at a bar of 1, coupled is just partners')
  assert.equal(main(2).coupled, 1, 'only a.ts recurs')
  assert.equal(main(3).coupled, 1, 'a.ts shares all three commits')
  assert.equal(main(4).coupled, 0, 'nothing shares four')
})

test('coupled never exceeds partners', () => {
  const commits = [
    ['main.ts', 'a.ts', 'b.ts'],
    ['main.ts', 'a.ts'],
    ['main.ts', 'b.ts', 'c.ts'],
    ['other.ts', 'a.ts'],
  ]

  const { candidates } = analyze(commits, { minCommits: 1, minSharedCommits: 1 })
  for (const c of candidates) {
    assert.ok(c.coupled <= c.partners, `${c.file}: coupled must be a subset of partners`)
  }
})

test('excluded rows carry a coupled count too', () => {
  const commits = [
    ['main.ts', 'NOTES.md', 'a.ts'],
    ['main.ts', 'NOTES.md', 'b.ts'],
    ['main.ts', 'NOTES.md', 'c.ts'],
  ]

  const { excluded } = analyze(commits, { minCommits: 3 })
  assert.equal(excluded[0].file, 'NOTES.md')
  assert.equal(excluded[0].coupled, 1, 'it recurs with main.ts and nothing else')
})

// --- Reporting ------------------------------------------------------------
// analyze() sets excluded files aside rather than dropping them, and the test
// above pins that. But analyze() returning `excluded` is worth nothing on its
// own: report() is the only thing a human ever sees. The run with NO rankable
// candidates is exactly when the set-aside rows matter most — it is the run
// where the tool would otherwise announce that there is nothing to find.

/** Runs `fn` with console.log captured, and returns everything it printed. */
function capture(fn) {
  const lines = []
  const original = console.log
  console.log = (...args) => lines.push(args.join(' '))
  try {
    fn()
  } finally {
    console.log = original
  }
  return lines.join('\n')
}

const REPORT_OPTS = { top: 10, minCommits: 3, minSharedCommits: 2, maxCommitSize: 50 }

test('reports set-aside collision points even when nothing is rankable', () => {
  const commits = [
    ['NOTES.md', 'a.ts'],
    ['NOTES.md', 'b.ts'],
    ['NOTES.md', 'c.ts'],
  ]
  const result = analyze(commits, { minCommits: 3 })

  assert.deepEqual(result.candidates, [], 'precondition: nothing is rankable')
  assert.equal(result.excluded.length, 1, 'precondition: but a doc did collide')

  const out = capture(() => report(result, REPORT_OPTS))

  assert.match(out, /NOTES\.md/, 'the collision point must survive into the output')
})

test('does not call the work disjoint while holding evidence that it is not', () => {
  const commits = [
    ['NOTES.md', 'a.ts'],
    ['NOTES.md', 'b.ts'],
    ['NOTES.md', 'c.ts'],
  ]
  const result = analyze(commits, { minCommits: 3 })
  const out = capture(() => report(result, REPORT_OPTS))

  assert.doesNotMatch(
    out,
    /already disjoint/,
    'a file in every commit is the opposite of disjoint work',
  )
})

test('still reports genuinely disjoint work as disjoint', () => {
  const commits = [['a.ts'], ['b.ts'], ['c.ts']]
  const result = analyze(commits, { minCommits: 3 })

  assert.deepEqual(result.candidates, [], 'precondition: nothing is rankable')
  assert.deepEqual(result.excluded, [], 'precondition: and nothing was set aside')

  const out = capture(() => report(result, REPORT_OPTS))

  assert.match(out, /already disjoint/, 'the genuinely empty case keeps its message')
})

test('counts every file that met the threshold, not only the rankable ones', () => {
  const commits = [
    ['main.ts', 'NOTES.md'],
    ['main.ts', 'NOTES.md'],
    ['main.ts', 'NOTES.md'],
  ]
  const result = analyze(commits, { minCommits: 3 })

  assert.equal(result.candidates.length, 1, 'precondition: one rankable')
  assert.equal(result.excluded.length, 1, 'precondition: one set aside')

  const out = capture(() => report(result, REPORT_OPTS))

  assert.match(
    out,
    /2 files reached 3\+ commits/,
    'the summary counts files, so a set-aside file still counts',
  )
})
