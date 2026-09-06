#!/usr/bin/env node
// Checks MAP.md against the tree it claims to describe.
//
// WHY THIS EXISTS. The navigation map was split out of the glossary on
// 2026-08-30 and took the name MAP.md on 2026-09-02, so that a dispatched
// agent could find code by reading one file instead of grepping for it -- the
// pipeline pays orientation once per agent, five times per task, and that is
// the term that grows with a project.
//
// A map only pays if it is TRUE. A stale one is worse than none: it sends a
// cold agent confidently to a file that moved, which costs more than the search
// it replaced. Nothing about writing prose makes it stay true, so this makes
// staleness fail loudly instead.
//
// It is the same move CLAUDE.md makes about citations -- "a quoted snippet is
// self-verifying: grep finds it, or the citation has failed loudly" -- applied
// to a document rather than to one line.
//
// THREE CHECKS, and the third is the one that matters most:
//
//   1. Every directory the map names exists.
//   2. Every shipped module is mentioned. A new file nobody added to the map is
//      a hole an agent falls into by searching, which is the cost this is
//      supposed to remove.
//   3. Every module the map names still exists. This is the direction that
//      actively misleads, so it is the reason to run this at all.
//
// Deliberately NOT checked: whether a module's one-line description is still
// accurate. No script can judge that, and pretending to would be worse than
// leaving it to review.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = resolve(SCRIPT_DIR, '..')
export const MAP_PATH = join(REPO_ROOT, 'MAP.md')

// The trees the map claims to cover. Everything else -- command-center, the
// toy repos, node_modules -- is out of scope by design, so adding a file there
// does not fail this.
export const COVERED_DIRS = Object.freeze([
  join('watcher', 'src'),
  'scripts',
])

// Backticked tokens are the map's citation form. CLAUDE.md forbids line
// numbers, so a path or a symbol in backticks is what a claim looks like here.
const BACKTICKED = /`([^`\n]+)`/g

export function backtickedTokens(markdown) {
  return new Set([...markdown.matchAll(BACKTICKED)].map((m) => m[1].trim()))
}

function walkModules(dir, found = []) {
  if (!existsSync(dir)) return found
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry !== 'node_modules') walkModules(full, found)
      continue
    }
    // Tests are not part of the map. They are found beside the module they
    // test, and listing thirty of them would bury the map in noise.
    if (entry.endsWith('.mjs') && !entry.endsWith('.test.mjs')) found.push(full)
  }
  return found
}

/**
 * @returns {{problems: string[], checked: number}}
 */
export function auditMap({ root = REPO_ROOT, mapPath = MAP_PATH } = {}) {
  const problems = []

  if (!existsSync(mapPath)) {
    return { problems: [`MAP.md not found at ${mapPath}`], checked: 0 }
  }

  const markdown = readFileSync(mapPath, 'utf8')
  const tokens = backtickedTokens(markdown)
  let checked = 0

  // 1. Directories the map names must exist.
  for (const token of tokens) {
    if (!token.endsWith('/')) continue
    if (token.startsWith('~') || token.includes('*')) continue
    checked += 1
    if (!existsSync(join(root, token))) {
      problems.push(`MAP.md names directory "${token}", which does not exist`)
    }
  }

  // 2. Every shipped module must be mentioned.
  const modules = COVERED_DIRS.flatMap((dir) => walkModules(join(root, dir)))
  const mentionedNames = new Set([...tokens].map((t) => basename(t)))
  for (const module of modules) {
    checked += 1
    if (!mentionedNames.has(basename(module))) {
      const relative = module.slice(root.length + 1).replace(/\\/g, '/')
      problems.push(
        `${relative} is not mentioned in MAP.md -- an agent will have to search for it, ` +
        `which is the cost the map exists to remove`)
    }
  }

  // 3. Every module the map names must still exist. The misleading direction.
  const shippedNames = new Set(modules.map((m) => basename(m)))
  for (const token of tokens) {
    if (!token.endsWith('.mjs') || token.includes('*')) continue
    if (token.endsWith('.test.mjs')) continue
    const name = basename(token)
    checked += 1
    if (!shippedNames.has(name)) {
      problems.push(
        `MAP.md names "${token}", which no longer exists under ${COVERED_DIRS.join(' or ')} ` +
        `-- a stale entry sends a cold agent to the wrong place`)
    }
  }

  return { problems, checked }
}

function main() {
  const { problems, checked } = auditMap()
  if (problems.length === 0) {
    console.log(`MAP.md agrees with the tree. ${checked} claims checked.`)
    console.log('')
    console.log('This does NOT mean the map is USEFUL -- it checks that every')
    console.log('path resolves and every module is listed, never that a')
    console.log('description is still accurate. That is a review question.')
    return
  }
  console.error(`MAP.md disagrees with the tree. ${problems.length} of ${checked} claims failed:`)
  console.error('')
  for (const problem of problems) console.error(`  - ${problem}`)
  console.error('')
  console.error('A map that is wrong costs more than no map. Fix it in the commit that moved the code.')
  process.exit(1)
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('map-audit.mjs')) {
  main()
}
