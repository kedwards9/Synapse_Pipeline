#!/usr/bin/env node
// Deploys agent definitions from this repo into ~/.claude/agents/.
//
// This repo is the source of truth for agent definitions. Claude Code loads
// them from ~/.claude/agents/, so they must be copied there to take effect.
// Run this after editing anything in agents/.
//
// Agent definitions load at SESSION START. A deploy does not affect a session
// that is already running -- restart it. A test that appears to show an agent
// ignoring a new rule is more likely a stale definition than a bad rule.
//
// Portable by design: no dependencies, and Node is already required by this
// repo for hot-files.mjs. This replaced a PowerShell-only script that left
// macOS and Linux with no deployment path at all -- blocker 5 of
// specs/2026-08-25-public-ship-boundary.md. It is deliberately ONE
// implementation rather than a .ps1 and a .sh kept in step by hand: that
// blocker existed precisely because a second platform was forgotten, and two
// copies of one algorithm is the cheapest way to guarantee it happens again.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))

export const DEFAULT_SOURCE = resolve(SCRIPT_DIR, '..', 'agents')
export const DEFAULT_TARGET = join(homedir(), '.claude', 'agents')

// The boundary hook's source lives in scripts/, not in a dedicated hooks/
// directory -- see plan decision A. An explicit source->target table, rather
// than globbing *.mjs the way agents/ globs *.md, is deliberate: this
// directory also holds orchestrator-boundary.test.mjs, and a glob-based
// lister would deploy a test file into the user's live hooks directory.
export const DEFAULT_HOOKS_SOURCE = SCRIPT_DIR
export const DEFAULT_HOOKS_TARGET = join(homedir(), '.claude', 'hooks')
export const HOOKS = [
  { source: 'orchestrator-boundary.mjs', target: 'synapse-orchestrator-boundary.mjs' },
]

// Ownership record: which files in the target this repo put there.
//
// Without it, deploy cannot tell its own older copy from a file somebody else
// wrote, so it overwrote both. That destroyed work and reported it as
// "updated: coder.md" -- output indistinguishable from a normal deploy. Agent
// names here are generic enough that a collision was likely rather than
// hypothetical, which is why the definitions are also namespaced.
//
// It lives BESIDE the agents directory, not inside it. Nothing that is not a
// deliberate agent definition goes in there; a stray file that Claude Code
// decides to parse is exactly the class of problem the no-subdirectories rule
// exists for, and there is no upside to finding out.
//
// `manifestPath()` derives from the target's PARENT, so ~/.claude/agents and
// ~/.claude/hooks both resolve to the same ~/.claude/.synapse-deployed.json.
// That is deliberate: it is one shared ownership record for the one shared
// ~/.claude/ directory. The two artifact kinds get separate lists inside it
// (`deployed` for agents, `hooks` for hooks) precisely so a deployed hook is
// never read as an orphaned agent, or vice versa.
export function manifestPath(targetDir) {
  return join(dirname(targetDir), '.synapse-deployed.json')
}

export function readManifest(targetDir) {
  const path = manifestPath(targetDir)
  if (!existsSync(path)) return { version: 1, deployed: [], hooks: [] }
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'))
    return {
      // A v1 manifest on disk has no `hooks` key at all -- that must read as
      // "owns no hooks", not as "owns no agents either". Each list defaults
      // independently.
      version: parsed.version ?? 1,
      deployed: Array.isArray(parsed.deployed) ? parsed.deployed : [],
      hooks: Array.isArray(parsed.hooks) ? parsed.hooks : [],
    }
  } catch {
    // A corrupt manifest must not be read as "we own nothing" -- that would
    // silently re-enable clobbering. Treat it as unreadable and refuse, for
    // both lists.
    return { version: 1, deployed: [], hooks: [], corrupt: true }
  }
}

function writeManifest(targetDir, agentNames, hookNames) {
  writeFileSync(
    manifestPath(targetDir),
    `${JSON.stringify(
      { version: 2, deployed: [...agentNames].sort(), hooks: [...hookNames].sort() },
      null,
      2,
    )}\n`,
  )
}

// A subdirectory under ~/.claude/agents registers duplicate agent names and
// SHADOWS the real definitions -- edits then silently do nothing. This cost
// hours once already. Never place backups or docs there.
export function findShadowingDirs(targetDir) {
  if (!existsSync(targetDir)) return []
  return readdirSync(targetDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
}

export function listAgentFiles(sourceDir) {
  return readdirSync(sourceDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name)
    .sort()
}

// Byte-for-byte comparison rather than a hash: agent definitions are small,
// and an exact compare cannot collide or disagree with itself across platforms
// the way two different hash implementations might.
function isIdentical(sourcePath, targetPath) {
  if (!existsSync(targetPath)) return false
  return readFileSync(sourcePath).equals(readFileSync(targetPath))
}

// Shared by both artifact kinds so there is exactly one comparison, whether
// the entries come from globbing agents/*.md or from the explicit HOOKS
// table.
function classifyEntries(entries) {
  const changed = []
  const same = []
  for (const { sourcePath, targetPath, targetName } of entries) {
    const bucket = isIdentical(sourcePath, targetPath) ? same : changed
    bucket.push(targetName)
  }
  return { changed, same }
}

export function classify(sourceDir, targetDir) {
  const entries = listAgentFiles(sourceDir).map((name) => ({
    sourcePath: join(sourceDir, name),
    targetPath: join(targetDir, name),
    targetName: name,
  }))
  return classifyEntries(entries)
}

// Same byte-for-byte comparison as classify(), against the explicit HOOKS
// table rather than a directory glob. verify-install.mjs uses this rather
// than inventing a second comparison for the one artifact kind that is not
// agents.
export function classifyHooks(hooksSourceDir, hooksTargetDir) {
  const entries = HOOKS.map(({ source, target }) => ({
    sourcePath: join(hooksSourceDir, source),
    targetPath: join(hooksTargetDir, target),
    targetName: target,
  }))
  return classifyEntries(entries)
}

// The ownership guard, in one place. A name that is about to be written,
// already exists at the target, and is not in the owning manifest belongs to
// somebody else -- refuse it by default. This is the whole guard; agents and
// hooks both go through it rather than each keeping their own copy.
function resolveOwnership(changed, targetDir, owned, force) {
  const foreign = changed.filter((name) => existsSync(join(targetDir, name)) && !owned.has(name))
  const writable = force ? changed : changed.filter((name) => !foreign.includes(name))
  return { foreign, writable }
}

export function deploy({
  sourceDir = DEFAULT_SOURCE,
  targetDir = DEFAULT_TARGET,
  hooksSourceDir = DEFAULT_HOOKS_SOURCE,
  hooksTargetDir = DEFAULT_HOOKS_TARGET,
  check = false,
  force = false,
  prune = false,
} = {}) {
  if (!existsSync(sourceDir)) {
    throw new Error(`Missing source directory: ${sourceDir}`)
  }

  // Anyone who has never created a subagent has no ~/.claude/agents/ directory,
  // so this used to throw on the very first command a new adopter ran. Create
  // it instead. Whether Claude Code makes it on a fresh install is then a
  // question nobody has to answer. The hooks target gets the same treatment --
  // ~/.claude/hooks/ may not exist either.
  const targetExisted = existsSync(targetDir)
  if (!targetExisted && !check) mkdirSync(targetDir, { recursive: true })

  const hooksTargetExisted = existsSync(hooksTargetDir)
  if (!hooksTargetExisted && !check) mkdirSync(hooksTargetDir, { recursive: true })

  const shadowing = findShadowingDirs(targetDir)
  const manifest = readManifest(targetDir)
  const owned = new Set(manifest.deployed)
  const hooksOwned = new Set(manifest.hooks)

  const { changed, same } = classify(sourceDir, targetDir)
  const { foreign, writable } = resolveOwnership(changed, targetDir, owned, force)

  const { changed: hookChanged, same: hookSame } = classifyHooks(hooksSourceDir, hooksTargetDir)
  const { foreign: hookForeign, writable: hookWritable } = resolveOwnership(
    hookChanged, hooksTargetDir, hooksOwned, force,
  )

  // Files we deployed under a name the repo no longer uses -- left behind by a
  // rename. They still load, so they are not inert: they are stale duplicates
  // sitting in the directory Claude Code reads.
  const sourceNames = new Set(listAgentFiles(sourceDir))
  const orphans = manifest.deployed.filter((name) => !sourceNames.has(name))

  const hookTargetNames = new Set(HOOKS.map((h) => h.target))
  const hookOrphans = manifest.hooks.filter((name) => !hookTargetNames.has(name))

  if (!check) {
    for (const name of writable) {
      writeFileSync(join(targetDir, name), readFileSync(join(sourceDir, name)))
    }
    for (const { source, target } of HOOKS) {
      if (hookWritable.includes(target)) {
        writeFileSync(join(hooksTargetDir, target), readFileSync(join(hooksSourceDir, source)))
      }
    }
    if (prune) {
      for (const name of orphans) {
        const path = join(targetDir, name)
        if (existsSync(path)) rmSync(path)
      }
      for (const name of hookOrphans) {
        const path = join(hooksTargetDir, name)
        if (existsSync(path)) rmSync(path)
      }
    }
    const stillOwned = [...owned].filter((n) => !(prune && orphans.includes(n)))
    const stillHooksOwned = [...hooksOwned].filter((n) => !(prune && hookOrphans.includes(n)))
    writeManifest(
      targetDir,
      new Set([...stillOwned, ...writable, ...same]),
      new Set([...stillHooksOwned, ...hookWritable, ...hookSame]),
    )
  }

  return {
    changed, same, shadowing, targetDir, targetExisted, check,
    foreign, writable, orphans, pruned: !check && prune ? orphans : [],
    corruptManifest: manifest.corrupt === true,
    hookChanged, hookSame, hooksTargetDir, hooksTargetExisted,
    hookForeign, hookWritable, hookOrphans, hookPruned: !check && prune ? hookOrphans : [],
  }
}

const USAGE = `Deploy agent definitions from agents/ into ~/.claude/agents/, and the
boundary hook from scripts/ into ~/.claude/hooks/.

  node scripts/deploy-agents.mjs            deploy both
  node scripts/deploy-agents.mjs --check    report drift, write nothing

Options:
  --check              Report what would change without writing.
  --force              Overwrite files this repo did not deploy. Destructive.
  --prune              Delete files we deployed under names no longer in agents/.
  --target <dir>       Override the agents destination (default: ~/.claude/agents).
  --hooks-target <dir> Override the hooks destination (default: ~/.claude/hooks).
  --help               Show this message.

Deploy will not overwrite an agent or hook it did not put there. Agent names
are generic and somebody else's "coder.md" is a real possibility; ~/.claude/hooks/
already holds the user's own hooks. Losing either is worse than a deploy that
stops and says why.

Agent definitions load at session start. Restart any running Claude Code
session after deploying, or it keeps using the old text.

Deploying the boundary hook does not register it. This script prints the
settings fragment; you paste it into ~/.claude/settings.json by hand -- Synapse
does not write that file. See adoption/boundary-hook.md.`

export function parseArgs(argv) {
  const opts = {
    check: false, help: false, force: false, prune: false,
    targetDir: DEFAULT_TARGET, hooksTargetDir: DEFAULT_HOOKS_TARGET,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--check' || arg === '-Check') opts.check = true
    else if (arg === '--force') opts.force = true
    else if (arg === '--prune') opts.prune = true
    else if (arg === '--help' || arg === '-h') opts.help = true
    else if (arg === '--target') {
      const value = argv[++i]
      if (!value) throw new Error('--target needs a directory')
      opts.targetDir = value
    } else if (arg === '--hooks-target') {
      const value = argv[++i]
      if (!value) throw new Error('--hooks-target needs a directory')
      opts.hooksTargetDir = value
    } else throw new Error(`Unknown argument: ${arg}`)
  }
  return opts
}

function reportHazards(result) {
  for (const name of result.shadowing) {
    console.warn(`WARNING: ${join(result.targetDir, name)} is a subdirectory -- it shadows real agents and must be removed.`)
  }

  if (result.corruptManifest) {
    console.warn(`WARNING: ${manifestPath(result.targetDir)} is unreadable. Treating every existing file as not ours, which is the safe reading.`)
  }

  if (result.foreign.length) {
    console.warn('')
    console.warn('REFUSED -- these already exist and this repo did not deploy them:')
    for (const name of result.foreign) console.warn(`    ${join(result.targetDir, name)}`)
    console.warn('')
    console.warn('  They are somebody else\'s agents, or yours from before you used Synapse.')
    console.warn('  Nothing was written to them. Rename or move them, or re-run with')
    console.warn('  --force to overwrite. --force destroys their current contents.')
  }

  if (result.orphans.length && !result.pruned.length) {
    console.warn('')
    console.warn('Left behind by an earlier deploy, under names agents/ no longer uses:')
    for (const name of result.orphans) console.warn(`    ${join(result.targetDir, name)}`)
    console.warn('  These still load. Remove them with --prune.')
  }

  if (result.hookForeign.length) {
    console.warn('')
    console.warn('REFUSED -- these already exist in the hooks directory and this repo did not deploy them:')
    for (const name of result.hookForeign) console.warn(`    ${join(result.hooksTargetDir, name)}`)
    console.warn('')
    console.warn('  They are somebody else\'s hooks -- ~/.claude/hooks/ is shared with the')
    console.warn('  user\'s own. Nothing was written to them. Rename or move them, or re-run')
    console.warn('  with --force to overwrite. --force destroys their current contents.')
  }

  if (result.hookOrphans.length && !result.hookPruned.length) {
    console.warn('')
    console.warn('Left behind by an earlier deploy, under names the HOOKS table no longer uses:')
    for (const name of result.hookOrphans) console.warn(`    ${join(result.hooksTargetDir, name)}`)
    console.warn('  These still run. Remove them with --prune.')
  }
}

// The single matcher object the user appends to their existing
// hooks.PreToolUse array in ~/.claude/settings.json. Kept as one function so
// the printed fragment and adoption/boundary-hook.md cannot drift apart.
export function boundaryHookFragment() {
  return {
    matcher: '*',
    hooks: [
      {
        type: 'command',
        command: 'node "$HOME/.claude/hooks/synapse-orchestrator-boundary.mjs"',
        timeout: 10,
      },
    ],
  }
}

export const DEFAULT_USER_SETTINGS = join(homedir(), '.claude', 'settings.json')

/**
 * Is the boundary hook registered in the user's settings?
 *
 * THIS EXISTS BECAUSE THE FRAGMENT USED TO PRINT UNCONDITIONALLY. The banner
 * asserted "deployed but NOT registered" whenever the hook FILE was in place,
 * having never looked at settings.json -- so once the user had pasted it in, the
 * next deploy told them to paste it again. Following that instruction appends a
 * SECOND PreToolUse entry and every tool call is logged twice, which is the exact
 * failure that removing the project-scope registration existed to prevent (see
 * the $comment in .claude/settings.json). A prompt whose remedy corrupts a
 * correct config is worse than no prompt.
 *
 * Caught 2026-08-29 by deploy and verify-install disagreeing out loud about the
 * same fact, on the same machine, seconds apart. Both now read this one function.
 *
 * Unreadable, missing, or malformed settings read as NOT registered -- the same
 * way verify-install has always treated them. This never throws.
 */
export function isBoundaryHookRegistered(settingsPath = DEFAULT_USER_SETTINGS) {
  try {
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8'))
    const entries = settings?.hooks?.PreToolUse ?? []
    return entries.some((entry) =>
      (entry.hooks ?? []).some(
        (h) => typeof h.command === 'string' && h.command.includes('synapse-orchestrator-boundary'),
      ),
    )
  } catch {
    return false
  }
}

function printBoundaryHookRegistered(settingsPath) {
  console.log('')
  console.log(`The boundary hook is deployed and already registered in ${settingsPath}.`)
  console.log('Nothing to paste. Do NOT add the fragment again -- a second PreToolUse')
  console.log('entry logs every tool call twice.')
}

function printBoundaryHookFragment() {
  console.log('')
  console.log('The boundary hook is deployed but NOT registered. Synapse deliberately does')
  console.log('not write ~/.claude/settings.json -- that file is your whole machine')
  console.log('configuration. Append the object below as a NEW element of the existing')
  console.log('hooks.PreToolUse array in ~/.claude/settings.json. Do not replace the array --')
  console.log('you have other hooks in it.')
  console.log('')
  console.log(JSON.stringify(boundaryHookFragment(), null, 2))
  console.log('')
  console.log('Until this is pasted in, nothing is logged anywhere -- not by this hook, not')
  console.log('by any project-scope registration, because this deploy removed the old one.')
}

function report(result) {
  reportHazards(result)

  if (result.check) {
    console.log(`Drift check against ${result.targetDir}`)
    if (!result.targetExisted) {
      console.log('  target does not exist yet; a real run would create it.')
    }
    if (result.changed.length === 0) {
      console.log(`  in sync (${result.same.length} files)`)
    } else {
      if (result.writable.length) {
        console.log('  WOULD UPDATE:')
        for (const name of result.writable) console.log(`    ${name}`)
      }
      if (result.foreign.length) {
        console.log('  WOULD REFUSE (not ours):')
        for (const name of result.foreign) console.log(`    ${name}`)
      }
      console.log(`  in sync: ${result.same.length}`)
    }

    console.log(`\nDrift check against ${result.hooksTargetDir}`)
    if (!result.hooksTargetExisted) {
      console.log('  target does not exist yet; a real run would create it.')
    }
    if (result.hookChanged.length === 0) {
      console.log(`  in sync (${result.hookSame.length} files)`)
    } else {
      if (result.hookWritable.length) {
        console.log('  WOULD UPDATE:')
        for (const name of result.hookWritable) console.log(`    ${name}`)
      }
      if (result.hookForeign.length) {
        console.log('  WOULD REFUSE (not ours):')
        for (const name of result.hookForeign) console.log(`    ${name}`)
      }
      console.log(`  in sync: ${result.hookSame.length}`)
    }
    return
  }

  if (!result.targetExisted) console.log(`Created ${result.targetDir}`)

  for (const name of result.pruned) console.log(`  removed orphan: ${name}`)

  if (result.writable.length === 0) {
    if (result.foreign.length === 0 && result.pruned.length === 0) {
      console.log(`Already up to date (${result.same.length} files).`)
    }
  } else {
    console.log(`Deployed to ${result.targetDir}`)
    for (const name of result.writable) console.log(`  updated: ${name}`)
    console.log('\nRestart any running Claude Code session for these to take effect.')
  }

  if (!result.hooksTargetExisted) console.log(`Created ${result.hooksTargetDir}`)

  for (const name of result.hookPruned) console.log(`  removed orphan hook: ${name}`)

  if (result.hookWritable.length === 0) {
    if (result.hookForeign.length === 0 && result.hookPruned.length === 0) {
      console.log(`Hooks already up to date (${result.hookSame.length} files).`)
    }
  } else {
    console.log(`Deployed to ${result.hooksTargetDir}`)
    for (const name of result.hookWritable) console.log(`  updated: ${name}`)
  }

  // Speak about the hook whenever it is in place -- just deployed or already in
  // sync from a previous run -- but not when it was refused as foreign, since in
  // that case there is nothing of ours to register.
  //
  // WHICH message depends on settings.json, and that is the fix: the fragment
  // used to print here unconditionally, telling a correctly-configured user to
  // paste a duplicate. See isBoundaryHookRegistered.
  const hookInPlace = result.hookWritable.length > 0 || result.hookSame.length > 0
  if (hookInPlace) {
    const settingsPath = result.userSettingsPath ?? DEFAULT_USER_SETTINGS
    if (isBoundaryHookRegistered(settingsPath)) printBoundaryHookRegistered(settingsPath)
    else printBoundaryHookFragment()
  }
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

  try {
    const result = deploy({
      targetDir: opts.targetDir,
      hooksTargetDir: opts.hooksTargetDir,
      check: opts.check,
      force: opts.force,
      prune: opts.prune,
    })
    report(result)
    // Refusing work and exiting 0 is its own silent failure -- a caller that
    // checks the exit code would read "nothing to do" from a deploy that
    // declined to write half the agents or the hook.
    if (result.foreign.length || result.hookForeign.length) process.exit(3)
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}

// Only run the CLI when invoked directly, so the test can import the module.
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('deploy-agents.mjs')) {
  main()
}
