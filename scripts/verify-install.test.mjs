// Tests for verify-install.mjs.
//
// The point of most of these is to prove the verifier can FAIL. A check that
// only ever reports "ok" is worse than no check at all: it produces confidence
// without evidence, which is the exact failure blocker 11 was about. So every
// check here is run against a deliberately broken scratch install and asserted
// to notice.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

import {
  parseFrontmatter,
  checkAgentDefinitions,
  checkDeployment,
  checkFixtureIntegrity,
  checkEnvironment,
  checkHookDeployment,
} from './verify-install.mjs'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REAL_FIXTURE = join(REPO_ROOT, 'toy-repos', 'gatekeeper')

const statusOf = (results, prefix) =>
  results.find((r) => r.name.trim().startsWith(prefix))?.status

function scratch() {
  const root = mkdtempSync(join(tmpdir(), 'verify-install-test-'))
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) }
}

const AGENT_NAMES = [
  'synapse-architect', 'synapse-art-director', 'synapse-artist', 'synapse-coder',
  'synapse-manager', 'synapse-planner', 'synapse-reviewer',
]

function writeAgentSet(dir, { omit = [], overrides = {} } = {}) {
  mkdirSync(dir, { recursive: true })
  for (const name of AGENT_NAMES) {
    if (omit.includes(name)) continue
    const body = overrides[name]
      ?? `---\nname: ${name}\ndescription: test agent\ntools: Read\nmodel: claude-opus-5\n---\n\nBody.\n`
    writeFileSync(join(dir, `${name}.md`), body)
  }
}

test('parseFrontmatter reads a well-formed block', () => {
  const fields = parseFrontmatter('---\nname: synapse-coder\ntools: Read, Write\n---\n\nBody')
  assert.equal(fields.name, 'synapse-coder')
  assert.equal(fields.tools, 'Read, Write')
})

test('parseFrontmatter returns null when there is no block', () => {
  assert.equal(parseFrontmatter('# Just a heading\n'), null)
  assert.equal(parseFrontmatter('---\nname: unterminated\n'), null)
})

test('reports a complete, valid agent set as passing', () => {
  const s = scratch()
  try {
    const dir = join(s.root, 'agents')
    writeAgentSet(dir)
    const results = checkAgentDefinitions(dir)
    assert.equal(statusOf(results, 'Agent definitions present'), 'pass')
    assert.equal(results.filter((r) => r.status === 'fail').length, 0)
  } finally {
    s.cleanup()
  }
})

test('notices a missing agent definition by name', () => {
  const s = scratch()
  try {
    const dir = join(s.root, 'agents')
    writeAgentSet(dir, { omit: ['synapse-reviewer'] })
    const results = checkAgentDefinitions(dir)
    const entry = results.find((r) => r.name === 'Agent definitions present')
    assert.equal(entry.status, 'fail')
    assert.match(entry.detail, /synapse-reviewer/)
  } finally {
    s.cleanup()
  }
})

test('notices frontmatter that will not load', () => {
  const s = scratch()
  try {
    const dir = join(s.root, 'agents')
    writeAgentSet(dir, { overrides: { 'synapse-coder': '# no frontmatter at all\n' } })
    assert.equal(statusOf(checkAgentDefinitions(dir), 'synapse-coder'), 'fail')
  } finally {
    s.cleanup()
  }
})

test('notices a frontmatter name that disagrees with the filename', () => {
  const s = scratch()
  try {
    const dir = join(s.root, 'agents')
    writeAgentSet(dir, {
      overrides: { 'synapse-coder': '---\nname: synapse-codar\ndescription: x\ntools: Read\n---\n' },
    })
    const entry = checkAgentDefinitions(dir).find((r) => r.name.trim() === 'synapse-coder')
    assert.equal(entry.status, 'fail')
    assert.match(entry.detail, /must match the filename/)
  } finally {
    s.cleanup()
  }
})

test('notices missing required frontmatter fields', () => {
  const s = scratch()
  try {
    const dir = join(s.root, 'agents')
    writeAgentSet(dir, { overrides: { 'synapse-planner': '---\nname: planner\n---\n' } })
    const entry = checkAgentDefinitions(dir).find((r) => r.name.trim() === 'synapse-planner')
    assert.equal(entry.status, 'fail')
    assert.match(entry.detail, /description/)
  } finally {
    s.cleanup()
  }
})

test('notices agents that were never deployed', () => {
  const s = scratch()
  try {
    const agentsDir = join(s.root, 'agents')
    writeAgentSet(agentsDir)
    const entry = checkDeployment(agentsDir, join(s.root, 'nowhere')).find(
      (r) => r.name === 'Agents deployed',
    )
    assert.equal(entry.status, 'fail')
    assert.match(entry.detail, /deploy-agents\.mjs/)
  } finally {
    s.cleanup()
  }
})

test('notices a deployed copy that has drifted from the repo', () => {
  const s = scratch()
  try {
    const agentsDir = join(s.root, 'agents')
    const targetDir = join(s.root, 'deployed')
    writeAgentSet(agentsDir)
    writeAgentSet(targetDir)
    writeFileSync(
      join(targetDir, 'synapse-manager.md'),
      '---\nname: synapse-manager\ndescription: STALE\ntools: Read\n---\n',
    )

    const entry = checkDeployment(agentsDir, targetDir).find((r) => r.name === 'Agents deployed')
    assert.equal(entry.status, 'fail')
    assert.match(entry.detail, /synapse-manager\.md/)
  } finally {
    s.cleanup()
  }
})

test('notices a shadowing subdirectory under the deploy target', () => {
  const s = scratch()
  try {
    const agentsDir = join(s.root, 'agents')
    const targetDir = join(s.root, 'deployed')
    writeAgentSet(agentsDir)
    writeAgentSet(targetDir)
    mkdirSync(join(targetDir, 'old-backups'))

    const entry = checkDeployment(agentsDir, targetDir).find(
      (r) => r.name === 'No shadowing subdirectories',
    )
    assert.equal(entry.status, 'fail')
    assert.match(entry.detail, /old-backups/)
  } finally {
    s.cleanup()
  }
})

test('confirms the real fixture still carries every planted defect', async () => {
  const results = await checkFixtureIntegrity(REAL_FIXTURE)
  assert.equal(results.filter((r) => r.status === 'fail').length, 0)
  for (const letter of ['A', 'B', 'C', 'E']) {
    assert.equal(statusOf(results, `Defect ${letter} still planted`), 'pass', `defect ${letter}`)
  }
})

// The load-bearing test. If someone "improves" the fixture by fixing its bugs,
// the answer key stops describing it and every future graded run is scored
// against a document that no longer matches the code. The verifier has to catch
// that, so here it is handed a repaired fixture and required to object.
test('notices a fixture whose planted defects have been repaired', async () => {
  const s = scratch()
  try {
    const fixture = join(s.root, 'gatekeeper')
    cpSync(REAL_FIXTURE, fixture, { recursive: true })

    // Repair defect A: require the ":" delimiter before the wildcard.
    writeFileSync(
      join(fixture, 'src', 'permissions.mjs'),
      `export function hasPermission(role, required) {
  if (!role || !Array.isArray(role.grants)) return false
  return role.grants.some((grant) => matches(grant, required))
}

function matches(grant, required) {
  if (grant.endsWith(':*')) {
    return required.startsWith(grant.slice(0, -1))
  }
  return grant === required
}
`,
    )

    // Repair defect B: record denials too.
    writeFileSync(
      join(fixture, 'src', 'audit.mjs'),
      `const entries = []

export function record(principal, permission, decision) {
  entries.push({ principal, permission, allowed: decision.allowed, seq: entries.length })
}

export function history() {
  return entries.map((e) => ({ ...e }))
}

export function reset() {
  entries.length = 0
}
`,
    )

    const results = await checkFixtureIntegrity(fixture)
    assert.equal(statusOf(results, 'Defect A missing'), 'fail')
    assert.equal(statusOf(results, 'Defect B missing'), 'fail')
    assert.equal(statusOf(results, 'Defect E missing'), 'fail')
  } finally {
    s.cleanup()
  }
})

test('notices a fixture directory that is not there at all', async () => {
  const s = scratch()
  try {
    const results = await checkFixtureIntegrity(join(s.root, 'no-such-fixture'))
    assert.equal(results[0].status, 'fail')
  } finally {
    s.cleanup()
  }
})

test('environment check reports on this machine without throwing', () => {
  const results = checkEnvironment()
  assert.equal(results.length, 2)
  assert.equal(statusOf(results, 'Node version'), 'pass')
})

// The cheap mechanical guard against the duplicate coming back. The boundary
// hook is now registered once, machine-wide, in ~/.claude/settings.json --
// project settings registering it too would mean two invocations per tool
// call and two records per call in the log, silently, since the hook only
// ever logs and never fails a call. Claude Code's own hook-merging behaviour
// cannot be unit-tested from here; this is the testable half.
test('the project settings register no PreToolUse hook', () => {
  const settingsPath = join(REPO_ROOT, '.claude', 'settings.json')
  const settings = JSON.parse(readFileSync(settingsPath, 'utf8'))
  assert.equal(settings.hooks?.PreToolUse, undefined)
})

// ---------------------------------------------------------------------------
// checkHookDeployment -- the boundary hook's three mechanical checks.
//
// checkHookDeployment() reads ~/.claude/settings.json but must NEVER write
// it. That is asserted below by checking the file's bytes are unchanged
// after the call, not just taken on faith.
// ---------------------------------------------------------------------------

const HOOK_SOURCE_NAME = 'orchestrator-boundary.mjs'
const HOOK_TARGET_NAME = 'synapse-orchestrator-boundary.mjs'

function hookScratch() {
  const s = scratch()
  const hooksSourceDir = join(s.root, 'scripts-src')
  const hooksTargetDir = join(s.root, 'home', '.claude', 'hooks')
  mkdirSync(hooksSourceDir, { recursive: true })
  writeFileSync(join(hooksSourceDir, HOOK_SOURCE_NAME), 'hook source body')
  return { ...s, hooksSourceDir, hooksTargetDir }
}

function withLogPath(path, fn) {
  const prior = process.env.SYNAPSE_BOUNDARY_LOG
  process.env.SYNAPSE_BOUNDARY_LOG = path
  try {
    return fn()
  } finally {
    if (prior === undefined) delete process.env.SYNAPSE_BOUNDARY_LOG
    else process.env.SYNAPSE_BOUNDARY_LOG = prior
  }
}

const registeredSettings = {
  hooks: {
    PreToolUse: [
      {
        matcher: '*',
        hooks: [
          {
            type: 'command',
            command: 'node "$HOME/.claude/hooks/synapse-orchestrator-boundary.mjs"',
            timeout: 10,
          },
        ],
      },
    ],
  },
}

test('notices the boundary hook has never been deployed', () => {
  const s = hookScratch()
  try {
    const settingsPath = join(s.root, 'settings.json')
    writeFileSync(settingsPath, JSON.stringify(registeredSettings))

    const results = withLogPath(join(s.root, 'nope.jsonl'), () =>
      checkHookDeployment(s.hooksSourceDir, s.hooksTargetDir, settingsPath))

    const entry = results.find((r) => r.name === 'Boundary hook deployed')
    assert.equal(entry.status, 'fail')
    assert.match(entry.detail, /deploy-agents\.mjs/)
  } finally {
    s.cleanup()
  }
})

test('notices a deployed hook that has drifted from the repo', () => {
  const s = hookScratch()
  try {
    mkdirSync(s.hooksTargetDir, { recursive: true })
    writeFileSync(join(s.hooksTargetDir, HOOK_TARGET_NAME), 'STALE COPY')
    const settingsPath = join(s.root, 'settings.json')
    writeFileSync(settingsPath, JSON.stringify(registeredSettings))

    const results = withLogPath(join(s.root, 'nope.jsonl'), () =>
      checkHookDeployment(s.hooksSourceDir, s.hooksTargetDir, settingsPath))

    const entry = results.find((r) => r.name === 'Boundary hook deployed')
    assert.equal(entry.status, 'fail')
    assert.match(entry.detail, /deploy-agents\.mjs/)
  } finally {
    s.cleanup()
  }
})

test('reports the hook deployed and in sync', () => {
  const s = hookScratch()
  try {
    mkdirSync(s.hooksTargetDir, { recursive: true })
    writeFileSync(join(s.hooksTargetDir, HOOK_TARGET_NAME), 'hook source body')
    const settingsPath = join(s.root, 'settings.json')
    writeFileSync(settingsPath, JSON.stringify(registeredSettings))

    const results = withLogPath(join(s.root, 'nope.jsonl'), () =>
      checkHookDeployment(s.hooksSourceDir, s.hooksTargetDir, settingsPath))

    const entry = results.find((r) => r.name === 'Boundary hook deployed')
    assert.equal(entry.status, 'pass')
  } finally {
    s.cleanup()
  }
})

test('warns when the boundary hook is not registered in settings', () => {
  const s = hookScratch()
  try {
    mkdirSync(s.hooksTargetDir, { recursive: true })
    writeFileSync(join(s.hooksTargetDir, HOOK_TARGET_NAME), 'hook source body')
    const settingsPath = join(s.root, 'settings.json')
    writeFileSync(settingsPath, JSON.stringify({ hooks: { PreToolUse: [] } }))

    const results = withLogPath(join(s.root, 'nope.jsonl'), () =>
      checkHookDeployment(s.hooksSourceDir, s.hooksTargetDir, settingsPath))

    const entry = results.find((r) => r.name === 'Boundary hook registered')
    assert.equal(entry.status, 'warn')
    assert.match(entry.detail, /paste/i)
  } finally {
    s.cleanup()
  }
})

test('passes when settings register the boundary hook', () => {
  const s = hookScratch()
  try {
    mkdirSync(s.hooksTargetDir, { recursive: true })
    writeFileSync(join(s.hooksTargetDir, HOOK_TARGET_NAME), 'hook source body')
    const settingsPath = join(s.root, 'settings.json')
    writeFileSync(settingsPath, JSON.stringify(registeredSettings))

    const results = withLogPath(join(s.root, 'nope.jsonl'), () =>
      checkHookDeployment(s.hooksSourceDir, s.hooksTargetDir, settingsPath))

    const entry = results.find((r) => r.name === 'Boundary hook registered')
    assert.equal(entry.status, 'pass')
  } finally {
    s.cleanup()
  }
})

test('warns rather than throws when settings.json does not exist', () => {
  const s = hookScratch()
  try {
    mkdirSync(s.hooksTargetDir, { recursive: true })
    writeFileSync(join(s.hooksTargetDir, HOOK_TARGET_NAME), 'hook source body')
    const settingsPath = join(s.root, 'no-such-settings.json')

    const results = withLogPath(join(s.root, 'nope.jsonl'), () =>
      checkHookDeployment(s.hooksSourceDir, s.hooksTargetDir, settingsPath))

    const entry = results.find((r) => r.name === 'Boundary hook registered')
    assert.equal(entry.status, 'warn')
  } finally {
    s.cleanup()
  }
})

test('warns rather than throws when settings.json is unreadable json', () => {
  const s = hookScratch()
  try {
    mkdirSync(s.hooksTargetDir, { recursive: true })
    writeFileSync(join(s.hooksTargetDir, HOOK_TARGET_NAME), 'hook source body')
    const settingsPath = join(s.root, 'settings.json')
    writeFileSync(settingsPath, '{ not json')

    const results = withLogPath(join(s.root, 'nope.jsonl'), () =>
      checkHookDeployment(s.hooksSourceDir, s.hooksTargetDir, settingsPath))

    const entry = results.find((r) => r.name === 'Boundary hook registered')
    assert.equal(entry.status, 'warn')
  } finally {
    s.cleanup()
  }
})

test('checkHookDeployment reads settings.json but never writes it', () => {
  const s = hookScratch()
  try {
    mkdirSync(s.hooksTargetDir, { recursive: true })
    writeFileSync(join(s.hooksTargetDir, HOOK_TARGET_NAME), 'hook source body')
    const settingsPath = join(s.root, 'settings.json')
    const before = JSON.stringify(registeredSettings)
    writeFileSync(settingsPath, before)

    withLogPath(join(s.root, 'nope.jsonl'), () =>
      checkHookDeployment(s.hooksSourceDir, s.hooksTargetDir, settingsPath))

    assert.equal(readFileSync(settingsPath, 'utf8'), before)
  } finally {
    s.cleanup()
  }
})

test('warns when the boundary hook has not recorded anything', () => {
  const s = hookScratch()
  try {
    mkdirSync(s.hooksTargetDir, { recursive: true })
    writeFileSync(join(s.hooksTargetDir, HOOK_TARGET_NAME), 'hook source body')
    const settingsPath = join(s.root, 'settings.json')
    writeFileSync(settingsPath, JSON.stringify(registeredSettings))

    const results = withLogPath(join(s.root, 'no-such-log.jsonl'), () =>
      checkHookDeployment(s.hooksSourceDir, s.hooksTargetDir, settingsPath))

    const entry = results.find((r) => r.name === 'Boundary hook recording')
    assert.equal(entry.status, 'warn')
  } finally {
    s.cleanup()
  }
})

test('passes when the boundary hook has recorded at least one call', () => {
  const s = hookScratch()
  try {
    mkdirSync(s.hooksTargetDir, { recursive: true })
    writeFileSync(join(s.hooksTargetDir, HOOK_TARGET_NAME), 'hook source body')
    const settingsPath = join(s.root, 'settings.json')
    writeFileSync(settingsPath, JSON.stringify(registeredSettings))
    const logPath = join(s.root, 'log.jsonl')
    writeFileSync(logPath, '{"at":"2026-08-29T00:00:00.000Z"}\n')

    const results = withLogPath(logPath, () =>
      checkHookDeployment(s.hooksSourceDir, s.hooksTargetDir, settingsPath))

    const entry = results.find((r) => r.name === 'Boundary hook recording')
    assert.equal(entry.status, 'pass')
  } finally {
    s.cleanup()
  }
})
