#!/usr/bin/env node
// Composition-root detector.
//
// Implements the "Detect it mechanically, not by collision" section of
// specs/composition-root-seams-pattern.md.
//
// A composition root is not merely a file that changes often — it is a file
// that changes *alongside everything else*. Two signals identify one:
//
//   commits  — how many commits in the window touched it
//   partners — how many DISTINCT other files it has co-changed with
//
// A busy leaf file scores high on commits and low on partners (it moves with
// its own test and nothing else). A composition root scores high on both.
// Results are ranked by partners, because breadth is what separates them.
//
// A third number, `coupled`, is reported but NOT ranked on: how many partners
// recur across 2+ shared commits. Breadth alone cannot tell co-evolution from
// commit size — a file sitting in two 20-file commits shows ~38 partners it
// will never move with again. Such a file has high partners and near-zero
// coupled, and the gap says so on the face of the table.
//
// Why report it rather than rank on it: a composition root's partners are
// often one-shot by nature (feature X touches the root and X's files, once),
// so ranking on `coupled` would demote real roots and promote a leaf that
// always moves with its own test. Breadth stays the signal; `coupled` is the
// confidence reader. See specs/composition-root-seams-pattern.md.
//
// Portable by design: git history is the only input. No project knowledge, no
// declared footprints, no orchestration layer, no dependencies.
//
// Documentation and lockfiles are filtered out of the ranking by default. Such
// a file moving with every feature is NOT a false positive — it genuinely is a
// collision point for parallel work — but it wants a different remedy than a
// registry, so it is reported separately rather than dropped. Filtering affects
// ranking eligibility only, never partner counts, so --exclude can never
// reorder the files that remain.

import { execFileSync } from 'node:child_process'

// Files that co-change with everything but are never seam targets.
const DEFAULT_EXCLUDES = [
  /\.(md|rst|adoc|txt)$/i, // docs and coordination notes
  /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|npm-shrinkwrap\.json)$/,
  /(^|\/)(Cargo\.lock|poetry\.lock|Gemfile\.lock|composer\.lock|go\.sum)$/,
]

const DEFAULTS = {
  window: 200, // commits to look back over
  minCommits: 3, // the spec's threshold: 3+ commits makes a candidate
  minSharedCommits: 2, // a partner counts as coupled once it recurs — see `coupled`
  maxCommitSize: 50, // above this a commit is bulk work, not feature work
  top: 20,
}

/**
 * Parse `git log --name-only --format=%x00%H` output into per-commit file lists.
 * @param {string} raw
 * @returns {string[][]} one array of changed paths per commit
 */
export function parseGitLog(raw) {
  return raw
    .split('\0')
    .filter((chunk) => chunk.trim() !== '')
    .map((chunk) => {
      const [, ...rest] = chunk.split('\n') // first line is the hash
      return rest.filter((line) => line !== '')
    })
}

/**
 * Rank files by how broadly they co-change.
 * @param {string[][]} commits
 * @param {{minCommits?: number, minSharedCommits?: number, maxCommitSize?: number,
 *          exclude?: RegExp[]}} [options]
 */
export function analyze(commits, options = {}) {
  const {
    minCommits = DEFAULTS.minCommits,
    minSharedCommits = DEFAULTS.minSharedCommits,
    maxCommitSize = DEFAULTS.maxCommitSize,
    exclude = DEFAULT_EXCLUDES,
  } = options

  const counts = new Map()
  const shared = new Map() // file -> Map(partner -> commits they share)
  let commitsAnalyzed = 0
  let commitsSkipped = 0

  for (const files of commits) {
    if (files.length > maxCommitSize) {
      commitsSkipped += 1
      continue
    }
    commitsAnalyzed += 1

    const unique = [...new Set(files)]
    for (const file of unique) {
      counts.set(file, (counts.get(file) ?? 0) + 1)
      if (!shared.has(file)) shared.set(file, new Map())
      const withFile = shared.get(file)
      for (const other of unique) {
        if (other !== file) withFile.set(other, (withFile.get(other) ?? 0) + 1)
      }
    }
  }

  // Partner counts are computed over every file, so filtering below cannot
  // change the breadth of anything that survives it.
  const ranked = [...counts.entries()]
    .filter(([, n]) => n >= minCommits)
    .map(([file, n]) => {
      const sharedCounts = [...shared.get(file).values()]
      return {
        file,
        commits: n,
        partners: sharedCounts.length,
        coupled: sharedCounts.filter((c) => c >= minSharedCommits).length,
      }
    })
    .sort(
      (a, b) => b.partners - a.partners || b.commits - a.commits || a.file.localeCompare(b.file),
    )

  const isExcluded = (file) => exclude.some((pattern) => pattern.test(file))
  const candidates = ranked.filter((c) => !isExcluded(c.file))
  const excluded = ranked.filter((c) => isExcluded(c.file))

  return { commitsAnalyzed, commitsSkipped, candidates, excluded }
}

function readHistory(repo, window) {
  const raw = execFileSync(
    'git',
    ['-C', repo, 'log', '-n', String(window), '--no-merges', '--name-only', '--format=%x00%H'],
    { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
  )
  return parseGitLog(raw)
}

function parseArgs(argv) {
  const opts = { repo: process.cwd(), ...DEFAULTS, json: false }
  const custom = []
  let useDefaultExcludes = true
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = () => {
      const value = argv[i + 1]
      if (value === undefined) throw new Error(`${arg} needs a value`)
      i += 1
      return value
    }
    switch (arg) {
      case '--repo': opts.repo = next(); break
      case '--window': opts.window = Number(next()); break
      case '--min': opts.minCommits = Number(next()); break
      case '--min-shared': opts.minSharedCommits = Number(next()); break
      case '--max-commit-size': opts.maxCommitSize = Number(next()); break
      case '--top': opts.top = Number(next()); break
      case '--exclude': {
        const source = next()
        try {
          custom.push(new RegExp(source))
        } catch {
          throw new Error(`--exclude ${source} is not a valid regular expression`)
        }
        break
      }
      case '--no-default-excludes': useDefaultExcludes = false; break
      case '--json': opts.json = true; break
      case '--help': case '-h': opts.help = true; break
      default: throw new Error(`unknown argument: ${arg}`)
    }
  }
  opts.exclude = [...(useDefaultExcludes ? DEFAULT_EXCLUDES : []), ...custom]
  return opts
}

const USAGE = `hot-files — find files that are becoming composition roots

  node scripts/hot-files.mjs [options]

  --repo <path>            repository to analyse (default: cwd)
  --window <n>             commits to look back over (default: ${DEFAULTS.window})
  --min <n>                minimum commits to be a candidate (default: ${DEFAULTS.minCommits})
  --min-shared <n>         commits a partner must share to count as coupled
                           (default: ${DEFAULTS.minSharedCommits})
  --max-commit-size <n>    ignore commits touching more files (default: ${DEFAULTS.maxCommitSize})
  --top <n>                rows to print (default: ${DEFAULTS.top})
  --exclude <regex>        drop matching paths from the ranking (repeatable).
                           Matched against the repo-relative path, e.g.
                           --exclude '^vendor/' --exclude '\\.snap$'
  --no-default-excludes    rank docs and lockfiles too
  --json                   emit JSON instead of a table

Docs (.md/.rst/.adoc/.txt) and lockfiles are excluded from the ranking by
default. They are still reported below the table: a file that moves with every
feature IS a collision point, it just wants a different remedy than a registry.
`

export function report(result, opts) {
  const { commitsAnalyzed, commitsSkipped, candidates, excluded } = result
  const shown = candidates.slice(0, opts.top)

  // Count files, not candidates. Set-aside rows cleared the same threshold,
  // and reporting only the rankable ones understates the history itself.
  console.log(
    `\n${commitsAnalyzed} commits analysed` +
      (commitsSkipped ? `, ${commitsSkipped} skipped as bulk (>${opts.maxCommitSize} files)` : '') +
      `\n${candidates.length + excluded.length} files reached ${opts.minCommits}+ commits` +
      (excluded.length
        ? ` (${candidates.length} rankable, ${excluded.length} set aside)`
        : '') +
      '\n',
  )

  // No rankable candidates is not the same finding as nothing to report. A
  // file set aside from the ranking is still a collision point, and this is
  // the run where saying so matters most — never return before showing them.
  if (shown.length === 0) {
    console.log(
      excluded.length > 0
        ? 'No seam candidates, but the collision points below were set aside from\nthe ranking rather than absent — they want a different remedy.\n'
        : 'No candidates. Either the history is short or the work is already disjoint.\n',
    )
  } else {
    const width = Math.max(...shown.map((c) => c.file.length), 4)
    console.log(`${'file'.padEnd(width)}  commits  partners  coupled`)
    console.log(`${'-'.repeat(width)}  -------  --------  -------`)
    for (const c of shown) {
      console.log(
        `${c.file.padEnd(width)}  ${String(c.commits).padStart(7)}  ` +
          `${String(c.partners).padStart(8)}  ${String(c.coupled).padStart(7)}`,
      )
    }

    if (candidates.length > shown.length) {
      console.log(`\n(${candidates.length - shown.length} more; raise --top to see them)`)
    }
  }

  if (excluded.length > 0) {
    console.log('\nAlso collision points, but not seam candidates — these want a')
    console.log('different remedy (--no-default-excludes to rank them anyway):')
    for (const c of excluded.slice(0, 5)) {
      console.log(
        `  ${c.file}  (${c.commits} commits, ${c.partners} partners, ${c.coupled} coupled)`,
      )
    }
    if (excluded.length > 5) console.log(`  ...and ${excluded.length - 5} more`)
  }

  // The legend explains columns carried by both the table and the set-aside
  // rows, so it earns its place whenever either printed — and only then.
  if (shown.length === 0 && excluded.length === 0) return

  console.log('\nRanked by partners — breadth is what makes a file a composition root.')
  console.log(
    `coupled = partners sharing ${opts.minSharedCommits}+ commits. A wide partners/coupled gap`,
  )
  console.log('means the breadth came from a few big commits, not from co-evolution.')
  console.log('Not every hit wants a seam; 3+ CONCURRENT streams is the trigger.\n')
}

function main() {
  let opts
  try {
    opts = parseArgs(process.argv.slice(2))
  } catch (error) {
    console.error(`${error.message}\n\n${USAGE}`)
    process.exit(2)
  }

  if (opts.help) {
    console.log(USAGE)
    return
  }

  let commits
  try {
    commits = readHistory(opts.repo, opts.window)
  } catch (error) {
    console.error(`Could not read git history from ${opts.repo}: ${error.message}`)
    process.exit(1)
  }

  const result = analyze(commits, opts)
  if (opts.json) {
    console.log(JSON.stringify({ ...result, options: opts }, null, 2))
  } else {
    report(result, opts)
  }
}

// Only run the CLI when invoked directly, so the test can import the module.
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('hot-files.mjs')) {
  main()
}
