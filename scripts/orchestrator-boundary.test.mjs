// Tests for orchestrator-boundary.mjs.
//
// Two things are being proved here, and they pull in opposite directions.
//
// The classifier must be able to say DENY -- a boundary check that only ever
// returns "fine" produces confidence without evidence, which is the same
// failure verify-install.test.mjs was written against. So every rule is
// exercised against input that should trip it.
//
// The hook must never actually deny, and must never break a session. It runs
// in front of every single tool call; a throw on malformed input, or a stray
// decision field on stdout, would take the session down with it. So the
// log-only invariant is asserted directly rather than assumed.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import {
  classify,
  readsRepoContent,
  toRecord,
  runHook,
} from './orchestrator-boundary.mjs'

const FIXED_CLOCK = () => '2026-08-27T00:00:00.000Z'

function scratch() {
  const root = mkdtempSync(join(tmpdir(), 'orch-boundary-test-'))
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) }
}

const mainSession = (over = {}) => ({
  session_id: 'sess-1',
  hook_event_name: 'PreToolUse',
  cwd: '<synapse>',
  permission_mode: 'default',
  ...over,
})

const subagent = (agentType, over = {}) =>
  mainSession({ agent_type: agentType, agent_id: 'ag-1', ...over })

// ---------------------------------------------------------------------------
// The discriminator: who is calling
// ---------------------------------------------------------------------------

test('a dispatched specialist reading source is never a violation', () => {
  const v = classify(subagent('synapse-coder', { tool_name: 'Read', tool_input: { file_path: 'a.mjs' } }))
  assert.equal(v.wouldDeny, false)
  assert.equal(v.rule, 'subagent-exempt')
})

test('every specialist is exempt, not just the coder', () => {
  for (const type of ['synapse-planner', 'synapse-reviewer', 'Explore', 'general-purpose']) {
    const v = classify(subagent(type, { tool_name: 'Edit', tool_input: { file_path: 'a.mjs' } }))
    assert.equal(v.wouldDeny, false, `${type} should be exempt`)
  }
})

test('the main session is identified by the ABSENCE of agent_type', () => {
  const v = classify(mainSession({ tool_name: 'Read', tool_input: { file_path: 'a.mjs' } }))
  assert.equal(v.seat, 'main')
  assert.equal(v.agentType, null)
})

// ---------------------------------------------------------------------------
// File tools from the orchestrator seat
// ---------------------------------------------------------------------------

test('the seat reading a source file trips the boundary', () => {
  const v = classify(mainSession({ tool_name: 'Read', tool_input: { file_path: 'agents/x.md' } }))
  assert.equal(v.wouldDeny, true)
  assert.equal(v.rule, 'file-tool')
  assert.match(v.detail, /agents\/x\.md/)
})

test('the seat editing or writing trips the boundary', () => {
  for (const tool of ['Edit', 'Write', 'NotebookEdit']) {
    const v = classify(mainSession({ tool_name: tool, tool_input: { file_path: 'a.mjs' } }))
    assert.equal(v.wouldDeny, true, `${tool} should trip`)
  }
})

test('searching is reading -- Grep and Glob trip too', () => {
  for (const tool of ['Grep', 'Glob']) {
    const v = classify(mainSession({ tool_name: tool, tool_input: { pattern: 'foo' } }))
    assert.equal(v.wouldDeny, true, `${tool} should trip`)
  }
})

test('the seat orchestrating is exactly what it is for', () => {
  for (const tool of ['Agent', 'TodoWrite', 'SendMessage', 'AskUserQuestion']) {
    const v = classify(mainSession({ tool_name: tool, tool_input: {} }))
    assert.equal(v.wouldDeny, false, `${tool} should be allowed`)
    assert.equal(v.rule, 'orchestration-tool')
  }
})

// ---------------------------------------------------------------------------
// Bash: repo STATE is allowed, repo CONTENT is not
// The allowlist is synapse-manager.md's own, verbatim.
// ---------------------------------------------------------------------------

test('the commands Manager may run unprompted all read as state', () => {
  const allowed = [
    'git status --short',
    'git log --oneline -10',
    "git log 0f24e3c..HEAD --format='%h [%(trailers:key=Session,valueonly,separator=)] %s'",
    'git rev-list --left-right --count HEAD...@{upstream}',
    'git branch --show-current',
    'git rev-parse HEAD',
    'git rev-parse --short HEAD',
    'git diff --stat',
  ]
  for (const cmd of allowed) {
    assert.equal(readsRepoContent(cmd), false, `should be state: ${cmd}`)
  }
})

test('the obvious content readers are caught', () => {
  const denied = [
    'cat agents/synapse-manager.md',
    'head -20 README.md',
    'tail -n 5 HANDOFF.md',
    'sed -n "1,50p" specs/x.md',
    'Get-Content .\\README.md',
  ]
  for (const cmd of denied) {
    assert.equal(readsRepoContent(cmd), true, `should be content: ${cmd}`)
  }
})

test('git show is content -- it is the command Manager cannot reach', () => {
  // Key Decision, handoff #17: a rejected plan was unrecoverable because
  // `git show` sits on Manager's deny-list. This case is why the log exists.
  assert.equal(readsRepoContent('git show 14b48d9'), true)
})

test('git diff without --stat is content, with --stat is state', () => {
  assert.equal(readsRepoContent('git diff'), true)
  assert.equal(readsRepoContent('git diff HEAD~1'), true)
  assert.equal(readsRepoContent('git diff --stat'), false)
})

test('a content reader hidden behind a pipe or && is still caught', () => {
  assert.equal(readsRepoContent('git status --short && cat README.md'), true)
  assert.equal(readsRepoContent('ls | head -3'), true)
})

test('Bash from the seat is classified through the command, not the tool', () => {
  const denied = classify(mainSession({ tool_name: 'Bash', tool_input: { command: 'cat x.mjs' } }))
  assert.equal(denied.wouldDeny, true)
  assert.equal(denied.rule, 'bash-content')

  const allowed = classify(mainSession({ tool_name: 'Bash', tool_input: { command: 'git status --short' } }))
  assert.equal(allowed.wouldDeny, false)
  assert.equal(allowed.rule, 'bash-state')
})

// ---------------------------------------------------------------------------
// The record
// ---------------------------------------------------------------------------

test('a record carries enough to judge the call later', () => {
  const r = toRecord(mainSession({ tool_name: 'Read', tool_input: { file_path: 'a.mjs' } }), FIXED_CLOCK)
  assert.equal(r.at, '2026-08-27T00:00:00.000Z')
  assert.equal(r.sessionId, 'sess-1')
  assert.equal(r.agentType, null)
  assert.equal(r.toolName, 'Read')
  assert.equal(r.wouldDeny, true)
  assert.equal(r.rule, 'file-tool')
})

test('the transcript path is carried -- it is the only candidate discriminator left', () => {
  // The main seat has no persona field, so `--agent synapse-manager` and an
  // ordinary session are identical in the payload. Dropping this field would
  // mean re-running the whole measurement to ask the question.
  const r = toRecord(
    mainSession({ tool_name: 'Read', tool_input: {}, transcript_path: '/x/y.jsonl' }),
    FIXED_CLOCK,
  )
  assert.equal(r.transcriptPath, '/x/y.jsonl')

  const missing = toRecord(mainSession({ tool_name: 'Read', tool_input: {} }), FIXED_CLOCK)
  assert.equal(missing.transcriptPath, null)
})

// ---------------------------------------------------------------------------
// Log-only invariants. These are the ones that matter most.
// ---------------------------------------------------------------------------

test('the hook writes nothing to stdout -- no decision field can leak', async () => {
  const { root, cleanup } = scratch()
  try {
    const out = await runHook(
      JSON.stringify(mainSession({ tool_name: 'Read', tool_input: { file_path: 'a.mjs' } })),
      { logPath: join(root, 'log.jsonl'), clock: FIXED_CLOCK },
    )
    assert.equal(out.stdout, '')
    assert.equal(out.exitCode, 0)
  } finally {
    cleanup()
  }
})

test('a would-deny call is logged but still exits 0', async () => {
  const { root, cleanup } = scratch()
  const logPath = join(root, 'log.jsonl')
  try {
    const out = await runHook(
      JSON.stringify(mainSession({ tool_name: 'Edit', tool_input: { file_path: 'a.mjs' } })),
      { logPath, clock: FIXED_CLOCK },
    )
    assert.equal(out.exitCode, 0)
    const line = JSON.parse(readFileSync(logPath, 'utf8').trim())
    assert.equal(line.wouldDeny, true)
  } finally {
    cleanup()
  }
})

test('records append rather than overwrite', async () => {
  const { root, cleanup } = scratch()
  const logPath = join(root, 'log.jsonl')
  try {
    for (const tool of ['Read', 'Edit', 'Agent']) {
      await runHook(JSON.stringify(mainSession({ tool_name: tool, tool_input: {} })), {
        logPath,
        clock: FIXED_CLOCK,
      })
    }
    const lines = readFileSync(logPath, 'utf8').trim().split('\n')
    assert.equal(lines.length, 3)
  } finally {
    cleanup()
  }
})

test('malformed stdin does not throw and does not break the session', async () => {
  const { root, cleanup } = scratch()
  try {
    for (const bad of ['', 'not json at all', '{"unterminated": ', 'null', '[]']) {
      const out = await runHook(bad, { logPath: join(root, 'log.jsonl'), clock: FIXED_CLOCK })
      assert.equal(out.exitCode, 0, `should survive: ${JSON.stringify(bad)}`)
      assert.equal(out.stdout, '')
    }
  } finally {
    cleanup()
  }
})

// ---------------------------------------------------------------------------
// The hook as the platform actually runs it: a spawned process fed on stdin.
//
// Every test above passed while the real script was a silent no-op -- its
// entry-point guard hand-built a `file://` URL that never matched
// `import.meta.url` on Windows, so it parsed, exited 0, and logged nothing.
// Exit 0 and no output is indistinguishable from working. Only spawning it
// catches that, so this is the test that earns its place.
// ---------------------------------------------------------------------------

test('spawned as a real hook process, it writes a record', async () => {
  const { root, cleanup } = scratch()
  const logPath = join(root, 'spawn.jsonl')
  try {
    const script = fileURLToPath(new URL('./orchestrator-boundary.mjs', import.meta.url))
    const payload = JSON.stringify(
      mainSession({ tool_name: 'Read', tool_input: { file_path: 'agents/x.md' } }),
    )

    const child = spawn(process.execPath, [script], {
      env: { ...process.env, SYNAPSE_BOUNDARY_LOG: logPath },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    child.stdout.on('data', (d) => { stdout += d })
    child.stdin.end(payload)
    const code = await new Promise((res) => child.on('close', res))

    assert.equal(code, 0)
    assert.equal(stdout, '', 'a PreToolUse hook must not print -- stdout is parsed for decisions')
    assert.equal(existsSync(logPath), true, 'the entry point did not run')
    assert.equal(JSON.parse(readFileSync(logPath, 'utf8').trim()).wouldDeny, true)
  } finally {
    cleanup()
  }
})

test('an unwritable log path fails silently rather than blocking the call', async () => {
  const { root, cleanup } = scratch()
  try {
    // A path whose parent is a FILE, not a directory -- unwritable on every platform.
    const wall = join(root, 'wall')
    const out = await runHook(
      JSON.stringify(mainSession({ tool_name: 'Read', tool_input: {} })),
      { logPath: join(wall, 'nested', 'log.jsonl'), clock: FIXED_CLOCK, mkdir: false },
    )
    assert.equal(out.exitCode, 0)
    assert.equal(out.stdout, '')
    assert.equal(existsSync(join(wall, 'nested', 'log.jsonl')), false)
  } finally {
    cleanup()
  }
})

// ---------------------------------------------------------------------------
// SYNAPSE_BOUNDARY_OFF -- the off switch a machine-wide hook needs and a
// project-scoped one never did.
// ---------------------------------------------------------------------------

test('the off switch suppresses the record entirely', async () => {
  const { root, cleanup } = scratch()
  const logPath = join(root, 'log.jsonl')
  try {
    const out = await runHook(
      JSON.stringify(mainSession({ tool_name: 'Edit', tool_input: { file_path: 'a.mjs' } })),
      { logPath, clock: FIXED_CLOCK, env: { SYNAPSE_BOUNDARY_OFF: '1' } },
    )
    assert.equal(existsSync(logPath), false)
  } finally {
    cleanup()
  }
})

test('the off switch still exits 0 and still prints nothing', async () => {
  const { root, cleanup } = scratch()
  const logPath = join(root, 'log.jsonl')
  try {
    const out = await runHook(
      JSON.stringify(mainSession({ tool_name: 'Edit', tool_input: { file_path: 'a.mjs' } })),
      { logPath, clock: FIXED_CLOCK, env: { SYNAPSE_BOUNDARY_OFF: '1' } },
    )
    assert.equal(out.exitCode, 0)
    assert.equal(out.stdout, '')
  } finally {
    cleanup()
  }
})

test('values that mean "not off" leave the hook recording', async () => {
  const notOff = [undefined, '', '0', 'false', 'FALSE', 'no', 'off ']
  for (const value of notOff) {
    const { root, cleanup } = scratch()
    const logPath = join(root, 'log.jsonl')
    try {
      const env = value === undefined ? {} : { SYNAPSE_BOUNDARY_OFF: value }
      await runHook(
        JSON.stringify(mainSession({ tool_name: 'Edit', tool_input: { file_path: 'a.mjs' } })),
        { logPath, clock: FIXED_CLOCK, env },
      )
      assert.equal(existsSync(logPath), true, `should record for env value: ${JSON.stringify(value)}`)
    } finally {
      cleanup()
    }
  }
})

test('any other value disables it', async () => {
  const off = ['1', 'true', 'yes', 'please']
  for (const value of off) {
    const { root, cleanup } = scratch()
    const logPath = join(root, 'log.jsonl')
    try {
      await runHook(
        JSON.stringify(mainSession({ tool_name: 'Edit', tool_input: { file_path: 'a.mjs' } })),
        { logPath, clock: FIXED_CLOCK, env: { SYNAPSE_BOUNDARY_OFF: value } },
      )
      assert.equal(existsSync(logPath), false, `should be off for env value: ${JSON.stringify(value)}`)
    } finally {
      cleanup()
    }
  }
})

test('spawned with the off switch set, it writes nothing and still exits 0', async () => {
  const { root, cleanup } = scratch()
  const logPath = join(root, 'spawn-off.jsonl')
  try {
    const script = fileURLToPath(new URL('./orchestrator-boundary.mjs', import.meta.url))
    const payload = JSON.stringify(
      mainSession({ tool_name: 'Edit', tool_input: { file_path: 'agents/x.md' } }),
    )

    const child = spawn(process.execPath, [script], {
      env: { ...process.env, SYNAPSE_BOUNDARY_LOG: logPath, SYNAPSE_BOUNDARY_OFF: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    child.stdout.on('data', (d) => { stdout += d })
    child.stdin.end(payload)
    const code = await new Promise((res) => child.on('close', res))

    assert.equal(code, 0)
    assert.equal(stdout, '')
    assert.equal(existsSync(logPath), false)
  } finally {
    cleanup()
  }
})
