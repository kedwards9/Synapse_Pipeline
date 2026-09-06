#!/usr/bin/env node
// Confirms a Synapse install is wired correctly on this machine.
//
// Blocker 11 of specs/2026-08-25-public-ship-boundary.md was "verification does
// not transfer": an adopter could clone this repo, deploy the agents, and have
// no way to tell whether any of it worked. This script is the mechanical half
// of the answer. `docs/VERIFYING.md` is the other half.
//
// WHAT THIS CANNOT DO, stated up front because it is the important limit:
// **it does not run the pipeline and it does not grade it.** Dispatching
// manager costs real model tokens, takes minutes, and produces prose that only
// a human comparing against docs/toy-repos/gatekeeper.md can score. Everything
// here is the part a machine can settle on its own -- are the definitions
// present and valid, are they deployed, is the fixture still intact. A clean
// run means the pipeline is *ready to be tested*, not that it works.
//
// The fixture checks assert that the planted defects are STILL PRESENT. That
// reads backwards until you see why: a fixture whose bugs have been fixed is
// broken, not improved, because the answer key no longer describes it. See the
// Maintenance section of docs/toy-repos/gatekeeper.md.

import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  classify, classifyHooks, findShadowingDirs, DEFAULT_TARGET,
  DEFAULT_HOOKS_SOURCE, DEFAULT_HOOKS_TARGET, isBoundaryHookRegistered,
} from './deploy-agents.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(SCRIPT_DIR, '..')
const AGENTS_DIR = join(REPO_ROOT, 'agents')
const FIXTURE_DIR = join(REPO_ROOT, 'toy-repos', 'gatekeeper')

// Independently declared from orchestrator-boundary.mjs:57 and
// investigation-window.mjs:45 -- a real duplication, and out of scope to fix
// here (see plans/2026-08-29-boundary-hook-machine-wide.md, "What is
// deliberately not here"). The log path is not changing in this task.
const DEFAULT_SETTINGS_PATH = join(homedir(), '.claude', 'settings.json')
const DEFAULT_HOOK_LOG = join(homedir(), '.claude', 'synapse-orchestrator-boundary.jsonl')

const EXPECTED_AGENTS = [
  'synapse-architect', 'synapse-art-director', 'synapse-artist', 'synapse-coder',
  'synapse-manager', 'synapse-planner', 'synapse-reviewer',
]

const pass = (name, detail) => ({ name, status: 'pass', detail })
const fail = (name, detail) => ({ name, status: 'fail', detail })
const warn = (name, detail) => ({ name, status: 'warn', detail })

export function checkEnvironment() {
  const results = []
  const major = Number(process.versions.node.split('.')[0])
  results.push(
    major >= 18
      ? pass('Node version', `v${process.versions.node}`)
      : fail('Node version', `v${process.versions.node} -- needs 18+ for node --test`),
  )

  try {
    const version = execFileSync('git', ['--version'], { encoding: 'utf8' }).trim()
    results.push(pass('git available', version))
  } catch {
    results.push(fail('git available', 'not on PATH -- hot-files.mjs reads git history'))
  }
  return results
}

// Frontmatter is what Claude Code actually parses. A definition with a broken
// or missing block does not half-load; the agent simply does not exist.
export function parseFrontmatter(text) {
  if (!text.startsWith('---')) return null
  const end = text.indexOf('\n---', 3)
  if (end === -1) return null
  const fields = {}
  for (const line of text.slice(4, end).split('\n')) {
    const match = /^([a-zA-Z_-]+):\s*(.*)$/.exec(line)
    if (match) fields[match[1]] = match[2].trim()
  }
  return fields
}

export function checkAgentDefinitions(agentsDir = AGENTS_DIR) {
  if (!existsSync(agentsDir)) {
    return [fail('Agent definitions', `missing directory: ${agentsDir}`)]
  }

  const files = readdirSync(agentsDir).filter((f) => f.endsWith('.md')).sort()
  const results = []
  const found = files.map((f) => f.replace(/\.md$/, ''))
  const missing = EXPECTED_AGENTS.filter((a) => !found.includes(a))

  results.push(
    missing.length === 0
      ? pass('Agent definitions present', `${files.length} found`)
      : fail('Agent definitions present', `missing: ${missing.join(', ')}`),
  )

  for (const file of files) {
    const name = file.replace(/\.md$/, '')
    const fields = parseFrontmatter(readFileSync(join(agentsDir, file), 'utf8'))
    if (!fields) {
      results.push(fail(`  ${name}`, 'no parseable frontmatter -- this agent will not load'))
      continue
    }
    const required = ['name', 'description', 'tools']
    const absent = required.filter((key) => !fields[key])
    if (absent.length) {
      results.push(fail(`  ${name}`, `frontmatter missing: ${absent.join(', ')}`))
    } else if (fields.name !== name) {
      results.push(fail(`  ${name}`, `frontmatter name is "${fields.name}" -- must match the filename`))
    } else {
      results.push(pass(`  ${name}`, fields.model || 'inherits model'))
    }
  }
  return results
}

export function checkDeployment(agentsDir = AGENTS_DIR, targetDir = DEFAULT_TARGET) {
  if (!existsSync(targetDir)) {
    return [fail('Agents deployed', `${targetDir} does not exist -- run: node scripts/deploy-agents.mjs`)]
  }

  const results = []
  const { changed, same } = classify(agentsDir, targetDir)
  results.push(
    changed.length === 0
      ? pass('Agents deployed', `${same.length} in sync with ${targetDir}`)
      : fail('Agents deployed', `out of date: ${changed.join(', ')} -- run: node scripts/deploy-agents.mjs`),
  )

  const shadowing = findShadowingDirs(targetDir)
  results.push(
    shadowing.length === 0
      ? pass('No shadowing subdirectories', 'none found')
      : fail('No shadowing subdirectories', `${shadowing.join(', ')} -- these register duplicate agent names and silently shadow the real definitions`),
  )
  return results
}

// Three checks for the machine-wide boundary hook: is it deployed, is it
// registered, is it recording. This function READS ~/.claude/settings.json
// and must NEVER write it -- that file is the user's whole machine
// configuration and Synapse does not own it (constraint 1).
export function checkHookDeployment(
  hooksSourceDir = DEFAULT_HOOKS_SOURCE,
  hooksTargetDir = DEFAULT_HOOKS_TARGET,
  settingsPath = DEFAULT_SETTINGS_PATH,
) {
  const results = []

  const { changed, same } = classifyHooks(hooksSourceDir, hooksTargetDir)
  results.push(
    changed.length === 0
      ? pass('Boundary hook deployed', `${same.length} in sync with ${hooksTargetDir}`)
      : fail('Boundary hook deployed', `out of date or missing: ${changed.join(', ')} -- run: node scripts/deploy-agents.mjs`),
  )

  // A deliberate human step (Decision 3): Synapse prints the fragment, the
  // user pastes it. A machine that has just deployed has legitimately not
  // done that yet, so absence is a warn, never a fail, and never an
  // exception -- unreadable or missing settings read the same way.
  //
  // The detection itself lives in deploy-agents.mjs and is imported rather than
  // repeated. It was duplicated here until 2026-08-29, and the copies disagreed
  // in production: deploy printed "NOT registered" for a hook this check was
  // reporting as registered, seconds apart on the same machine. One
  // implementation is the fix; two implementations was the defect.
  const registered = isBoundaryHookRegistered(settingsPath)
  results.push(
    registered
      ? pass('Boundary hook registered', settingsPath)
      : warn('Boundary hook registered', `not found in ${settingsPath} -- paste the fragment node scripts/deploy-agents.mjs printed`),
  )

  const logPath = process.env.SYNAPSE_BOUNDARY_LOG || DEFAULT_HOOK_LOG
  results.push(
    existsSync(logPath)
      ? pass('Boundary hook recording', logPath)
      : warn('Boundary hook recording', `${logPath} does not exist yet -- if this persists after tool calls, check that $HOME expanded`),
  )

  return results
}

// Each probe asserts a planted defect is still reachable. The expected strings
// come straight from docs/toy-repos/gatekeeper.md, so if a probe fails, either
// the fixture was "helpfully" repaired or the key has drifted from it.
export async function checkFixtureIntegrity(fixtureDir = FIXTURE_DIR) {
  if (!existsSync(fixtureDir)) {
    return [fail('Fixture present', `missing: ${fixtureDir}`)]
  }

  const load = (file) => import(pathToFileURL(join(fixtureDir, 'src', file)).href)
  const results = [pass('Fixture present', fixtureDir)]

  try {
    const { hasPermission } = await load('permissions.mjs')
    const { ROLES } = await load('roles.mjs')
    const escalated = hasPermission(ROLES.auditor, 'audit-config:write')
    results.push(
      escalated
        ? pass('Defect A still planted', 'wildcard grant crosses the ":" delimiter')
        : fail('Defect A missing', 'the wildcard escalation was fixed -- the fixture no longer matches its answer key'),
    )
  } catch (error) {
    results.push(fail('Defect A probe', error.message))
  }

  try {
    const audit = await load('audit.mjs')
    audit.reset()
    audit.record('alice', 'billing:write', { allowed: false })
    audit.record('bob', 'billing:read', { allowed: true })
    const principals = audit.history().map((e) => e.principal)
    results.push(
      !principals.includes('alice')
        ? pass('Defect B still planted', 'denied decisions are discarded')
        : fail('Defect B missing', 'denials are now recorded -- the fixture no longer matches its answer key'),
    )

    audit.reset()
    audit.record('carol', 'billing:read', { allowed: true })
    const copy = audit.history()
    copy[0].principal = 'mallory'
    const mutated = audit.history()[0].principal === 'mallory'
    results.push(
      mutated
        ? pass('Defect E still planted', 'history() hands out live references')
        : fail('Defect E missing', 'history() now returns copies -- the fixture no longer matches its answer key'),
    )
    audit.reset()
  } catch (error) {
    results.push(fail('Defect B/E probe', error.message))
  }

  try {
    const registry = await load('registry.mjs')
    registry.reset()
    registry.register('audit', () => {})
    registry.register('authenticate', () => {})
    const order = registry.registered()
    results.push(
      order[0] === 'audit'
        ? pass('Defect C still planted', 'documented ordering constraint is unenforced')
        : fail('Defect C missing', 'registration order is now enforced -- the fixture no longer matches its answer key'),
    )
    registry.reset()
  } catch (error) {
    results.push(fail('Defect C probe', error.message))
  }

  return results
}

// The fixture's own suite passing is not evidence the pipeline works. It is
// evidence of the opposite point: these tests pass with every defect above
// still live, which is exactly why a green suite cannot be the acceptance
// signal and why the answer key exists.
export function checkFixtureSuite(fixtureDir = FIXTURE_DIR) {
  try {
    const output = execFileSync(process.execPath, ['--test'], {
      cwd: fixtureDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const passed = /^# pass (\d+)$/m.exec(output) || /pass (\d+)/.exec(output)
    return [pass('Fixture suite green (and that proves nothing)', `${passed ? passed[1] : '?'} passing, with every planted defect still live`)]
  } catch (error) {
    return [warn('Fixture suite', `did not pass cleanly: ${(error.stderr || error.message).toString().slice(0, 200)}`)]
  }
}

export async function runAllChecks(options = {}) {
  const sections = [
    ['Environment', checkEnvironment()],
    ['Agent definitions', checkAgentDefinitions(options.agentsDir)],
    ['Deployment', checkDeployment(options.agentsDir, options.targetDir)],
    ['Boundary hook', checkHookDeployment()],
    ['Fixture integrity', await checkFixtureIntegrity(options.fixtureDir)],
    ['Fixture suite', checkFixtureSuite(options.fixtureDir)],
  ]
  const all = sections.flatMap(([, results]) => results)
  return {
    sections,
    failed: all.filter((r) => r.status === 'fail'),
    warned: all.filter((r) => r.status === 'warn'),
    total: all.length,
  }
}

const GLYPH = { pass: 'ok  ', fail: 'FAIL', warn: 'warn' }

function report(result) {
  for (const [title, results] of result.sections) {
    console.log(`\n${title}`)
    for (const r of results) {
      console.log(`  ${GLYPH[r.status]}  ${r.name}${r.detail ? ` -- ${r.detail}` : ''}`)
    }
  }

  console.log('')
  if (result.failed.length) {
    console.log(`${result.failed.length} of ${result.total} checks failed. Fix these before running the pipeline.`)
  } else {
    console.log(`All ${result.total} mechanical checks passed.`)
    console.log('')
    console.log('This does NOT mean the pipeline works -- nothing here dispatched an')
    console.log('agent. It means the install is ready to be tested. The graded run is')
    console.log('a human step: see docs/VERIFYING.md, step 4.')
  }
  if (result.warned.length) console.log(`(${result.warned.length} warning${result.warned.length === 1 ? '' : 's'})`)
}

async function main() {
  const result = await runAllChecks()
  report(result)
  process.exit(result.failed.length ? 1 : 0)
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('verify-install.mjs')) {
  await main()
}
