// Tests for deploy-agents.mjs.
//
// Every case runs against a throwaway directory pair under the OS temp dir.
// Nothing here touches the real ~/.claude/agents -- a test that deployed to the
// live target would rewrite the definitions of the session running it.
//
// deploy() now deploys hooks too, unconditionally, in the same call that
// deploys agents. Every deploy() call below passes an explicit
// `hooksTargetDir: s.hooksTargetDir` for exactly that reason -- leaving it
// out defaults to the REAL ~/.claude/hooks/, and a test run would silently
// write the real orchestrator-boundary.mjs into the machine running it. This
// was caught once already: several of these tests wrote it there before this
// comment and the fix existed.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { deploy, classify, listAgentFiles, findShadowingDirs, parseArgs, manifestPath, readManifest, isBoundaryHookRegistered } from './deploy-agents.mjs'

function scratch() {
  const root = mkdtempSync(join(tmpdir(), 'deploy-agents-test-'))
  const sourceDir = join(root, 'agents')
  const targetDir = join(root, 'home', '.claude', 'agents')
  const hooksTargetDir = join(root, 'home', '.claude', 'hooks')
  mkdirSync(sourceDir, { recursive: true })
  return {
    root, sourceDir, targetDir, hooksTargetDir,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  }
}

function writeAgent(dir, name, body) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, name), body)
}

test('creates the target directory when it does not exist', () => {
  const s = scratch()
  try {
    writeAgent(s.sourceDir, 'manager.md', 'one')
    assert.equal(existsSync(s.targetDir), false)

    const result = deploy({ sourceDir: s.sourceDir, targetDir: s.targetDir, hooksTargetDir: s.hooksTargetDir })

    assert.equal(existsSync(s.targetDir), true)
    assert.equal(result.targetExisted, false)
    assert.deepEqual(result.changed, ['manager.md'])
    assert.equal(readFileSync(join(s.targetDir, 'manager.md'), 'utf8'), 'one')
  } finally {
    s.cleanup()
  }
})

test('--check does not create the target directory or write files', () => {
  const s = scratch()
  try {
    writeAgent(s.sourceDir, 'manager.md', 'one')

    const result = deploy({
      sourceDir: s.sourceDir, targetDir: s.targetDir, hooksTargetDir: s.hooksTargetDir, check: true,
    })

    assert.equal(existsSync(s.targetDir), false, 'check mode must not create anything')
    assert.equal(result.targetExisted, false)
    assert.deepEqual(result.changed, ['manager.md'])
  } finally {
    s.cleanup()
  }
})

test('reports an unchanged file as in sync rather than updating it', () => {
  const s = scratch()
  try {
    writeAgent(s.sourceDir, 'manager.md', 'same bytes')
    writeAgent(s.targetDir, 'manager.md', 'same bytes')

    const result = deploy({ sourceDir: s.sourceDir, targetDir: s.targetDir, hooksTargetDir: s.hooksTargetDir })

    assert.deepEqual(result.changed, [])
    assert.deepEqual(result.same, ['manager.md'])
  } finally {
    s.cleanup()
  }
})

test('detects a one-byte difference', () => {
  const s = scratch()
  try {
    writeAgent(s.sourceDir, 'manager.md', 'abc')
    writeAgent(s.targetDir, 'manager.md', 'abd')

    assert.deepEqual(classify(s.sourceDir, s.targetDir).changed, ['manager.md'])
  } finally {
    s.cleanup()
  }
})

test('overwrites a stale copy that WE deployed', () => {
  const s = scratch()
  try {
    writeAgent(s.sourceDir, 'manager.md', 'old text')
    deploy({ sourceDir: s.sourceDir, targetDir: s.targetDir, hooksTargetDir: s.hooksTargetDir })

    writeAgent(s.sourceDir, 'manager.md', 'new text')
    deploy({ sourceDir: s.sourceDir, targetDir: s.targetDir, hooksTargetDir: s.hooksTargetDir })

    assert.equal(readFileSync(join(s.targetDir, 'manager.md'), 'utf8'), 'new text')
  } finally {
    s.cleanup()
  }
})

// The bug this guard exists for. Agent names like "coder" are generic enough
// that somebody else's file under the same name is likely, and deploy used to
// destroy it while reporting "updated: coder.md" -- output identical to
// success. An earlier version of this suite asserted that overwrite as correct
// behaviour, which is how the hole survived being tested.
test('refuses to overwrite a file it did not deploy', () => {
  const s = scratch()
  try {
    writeAgent(s.sourceDir, 'coder.md', 'ours')
    writeAgent(s.targetDir, 'coder.md', 'THEIR PRECIOUS AGENT')

    const result = deploy({ sourceDir: s.sourceDir, targetDir: s.targetDir, hooksTargetDir: s.hooksTargetDir })

    assert.deepEqual(result.foreign, ['coder.md'])
    assert.deepEqual(result.writable, [])
    assert.equal(
      readFileSync(join(s.targetDir, 'coder.md'), 'utf8'),
      'THEIR PRECIOUS AGENT',
      'a foreign agent definition must survive a deploy untouched',
    )
  } finally {
    s.cleanup()
  }
})

test('--force overwrites a foreign file, because that is what it is for', () => {
  const s = scratch()
  try {
    writeAgent(s.sourceDir, 'coder.md', 'ours')
    writeAgent(s.targetDir, 'coder.md', 'theirs')

    const result = deploy({
      sourceDir: s.sourceDir, targetDir: s.targetDir, hooksTargetDir: s.hooksTargetDir, force: true,
    })

    assert.deepEqual(result.writable, ['coder.md'])
    assert.equal(readFileSync(join(s.targetDir, 'coder.md'), 'utf8'), 'ours')
  } finally {
    s.cleanup()
  }
})

test('refusing one file does not block the others', () => {
  const s = scratch()
  try {
    writeAgent(s.sourceDir, 'coder.md', 'ours')
    writeAgent(s.sourceDir, 'planner.md', 'ours')
    writeAgent(s.targetDir, 'coder.md', 'theirs')

    const result = deploy({ sourceDir: s.sourceDir, targetDir: s.targetDir, hooksTargetDir: s.hooksTargetDir })

    assert.deepEqual(result.foreign, ['coder.md'])
    assert.deepEqual(result.writable, ['planner.md'])
    assert.equal(readFileSync(join(s.targetDir, 'planner.md'), 'utf8'), 'ours')
    assert.equal(readFileSync(join(s.targetDir, 'coder.md'), 'utf8'), 'theirs')
  } finally {
    s.cleanup()
  }
})

test('--check reports a refusal instead of writing or claiming an update', () => {
  const s = scratch()
  try {
    writeAgent(s.sourceDir, 'coder.md', 'ours')
    writeAgent(s.targetDir, 'coder.md', 'theirs')

    const result = deploy({
      sourceDir: s.sourceDir, targetDir: s.targetDir, hooksTargetDir: s.hooksTargetDir, check: true,
    })

    assert.deepEqual(result.foreign, ['coder.md'])
    assert.equal(readFileSync(join(s.targetDir, 'coder.md'), 'utf8'), 'theirs')
    assert.equal(existsSync(manifestPath(s.targetDir)), false, 'check mode writes no manifest')
  } finally {
    s.cleanup()
  }
})

test('a corrupt manifest is read as owning nothing, not as owning everything', () => {
  const s = scratch()
  try {
    writeAgent(s.sourceDir, 'coder.md', 'ours')
    writeAgent(s.targetDir, 'coder.md', 'theirs')
    writeFileSync(manifestPath(s.targetDir), '{ this is not json')

    const result = deploy({ sourceDir: s.sourceDir, targetDir: s.targetDir, hooksTargetDir: s.hooksTargetDir })

    assert.equal(result.corruptManifest, true)
    assert.deepEqual(result.foreign, ['coder.md'])
    assert.equal(readFileSync(join(s.targetDir, 'coder.md'), 'utf8'), 'theirs')
  } finally {
    s.cleanup()
  }
})

test('reports files it deployed under a name the repo no longer uses', () => {
  const s = scratch()
  try {
    writeAgent(s.sourceDir, 'coder.md', 'v1')
    deploy({ sourceDir: s.sourceDir, targetDir: s.targetDir, hooksTargetDir: s.hooksTargetDir })

    rmSync(join(s.sourceDir, 'coder.md'))
    writeAgent(s.sourceDir, 'synapse-coder.md', 'v2')
    const result = deploy({ sourceDir: s.sourceDir, targetDir: s.targetDir, hooksTargetDir: s.hooksTargetDir })

    assert.deepEqual(result.orphans, ['coder.md'])
    assert.equal(existsSync(join(s.targetDir, 'coder.md')), true, 'not removed without --prune')
    assert.equal(existsSync(join(s.targetDir, 'synapse-coder.md')), true)
  } finally {
    s.cleanup()
  }
})

test('--prune removes the orphans and forgets them', () => {
  const s = scratch()
  try {
    writeAgent(s.sourceDir, 'coder.md', 'v1')
    deploy({ sourceDir: s.sourceDir, targetDir: s.targetDir, hooksTargetDir: s.hooksTargetDir })

    rmSync(join(s.sourceDir, 'coder.md'))
    writeAgent(s.sourceDir, 'synapse-coder.md', 'v2')
    const result = deploy({
      sourceDir: s.sourceDir, targetDir: s.targetDir, hooksTargetDir: s.hooksTargetDir, prune: true,
    })

    assert.deepEqual(result.pruned, ['coder.md'])
    assert.equal(existsSync(join(s.targetDir, 'coder.md')), false)
    assert.deepEqual(readManifest(s.targetDir).deployed, ['synapse-coder.md'])
  } finally {
    s.cleanup()
  }
})

test('--prune never deletes a file we did not deploy', () => {
  const s = scratch()
  try {
    writeAgent(s.sourceDir, 'synapse-coder.md', 'ours')
    writeAgent(s.targetDir, 'someone-elses.md', 'not ours')

    deploy({ sourceDir: s.sourceDir, targetDir: s.targetDir, hooksTargetDir: s.hooksTargetDir, prune: true })

    assert.equal(existsSync(join(s.targetDir, 'someone-elses.md')), true)
  } finally {
    s.cleanup()
  }
})

test('ignores non-markdown files in the source directory', () => {
  const s = scratch()
  try {
    writeAgent(s.sourceDir, 'manager.md', 'x')
    writeFileSync(join(s.sourceDir, 'notes.txt'), 'not an agent')
    writeFileSync(join(s.sourceDir, 'manager.md.bak'), 'a backup')

    assert.deepEqual(listAgentFiles(s.sourceDir), ['manager.md'])

    deploy({ sourceDir: s.sourceDir, targetDir: s.targetDir, hooksTargetDir: s.hooksTargetDir })
    assert.equal(existsSync(join(s.targetDir, 'notes.txt')), false)
    assert.equal(existsSync(join(s.targetDir, 'manager.md.bak')), false)
  } finally {
    s.cleanup()
  }
})

test('reports subdirectories under the target, which shadow real agents', () => {
  const s = scratch()
  try {
    writeAgent(s.sourceDir, 'manager.md', 'x')
    mkdirSync(join(s.targetDir, 'backups'), { recursive: true })

    const result = deploy({ sourceDir: s.sourceDir, targetDir: s.targetDir, hooksTargetDir: s.hooksTargetDir })

    assert.deepEqual(result.shadowing, ['backups'])
  } finally {
    s.cleanup()
  }
})

test('deploying twice is a no-op the second time', () => {
  const s = scratch()
  try {
    writeAgent(s.sourceDir, 'manager.md', 'x')
    writeAgent(s.sourceDir, 'coder.md', 'y')

    const first = deploy({ sourceDir: s.sourceDir, targetDir: s.targetDir, hooksTargetDir: s.hooksTargetDir })
    const second = deploy({ sourceDir: s.sourceDir, targetDir: s.targetDir, hooksTargetDir: s.hooksTargetDir })

    assert.deepEqual(first.changed, ['coder.md', 'manager.md'])
    assert.deepEqual(second.changed, [])
    assert.deepEqual(second.same, ['coder.md', 'manager.md'])
  } finally {
    s.cleanup()
  }
})

test('leaves files in the target that the repo does not have', () => {
  const s = scratch()
  try {
    writeAgent(s.sourceDir, 'manager.md', 'x')
    writeAgent(s.targetDir, 'someone-elses-agent.md', 'not ours')

    deploy({ sourceDir: s.sourceDir, targetDir: s.targetDir, hooksTargetDir: s.hooksTargetDir })

    assert.equal(
      readFileSync(join(s.targetDir, 'someone-elses-agent.md'), 'utf8'),
      'not ours',
      'deploy must not delete agents this repo does not own',
    )
  } finally {
    s.cleanup()
  }
})

test('throws a named error when the source directory is missing', () => {
  const s = scratch()
  try {
    assert.throws(
      () => deploy({ sourceDir: join(s.root, 'nope'), targetDir: s.targetDir }),
      /Missing source directory/,
    )
  } finally {
    s.cleanup()
  }
})

test('findShadowingDirs returns empty for a target that does not exist', () => {
  const s = scratch()
  try {
    assert.deepEqual(findShadowingDirs(s.targetDir), [])
  } finally {
    s.cleanup()
  }
})

test('parseArgs accepts the documented flags', () => {
  assert.equal(parseArgs(['--check']).check, true)
  assert.equal(parseArgs([]).check, false)
  assert.equal(parseArgs(['--help']).help, true)
  assert.equal(parseArgs(['--target', '/tmp/x']).targetDir, '/tmp/x')
})

test('parseArgs still accepts -Check, the flag the PowerShell script used', () => {
  assert.equal(parseArgs(['-Check']).check, true)
})

test('parseArgs rejects an unknown argument rather than ignoring it', () => {
  assert.throws(() => parseArgs(['--deploy-everything']), /Unknown argument/)
  assert.throws(() => parseArgs(['--target']), /--target needs a directory/)
})

test('parseArgs accepts --hooks-target', () => {
  assert.equal(parseArgs(['--hooks-target', '/tmp/hooks']).hooksTargetDir, '/tmp/hooks')
})

// ---------------------------------------------------------------------------
// Hooks: a second artifact kind sharing the same manifest file.
//
// manifestPath() resolves both ~/.claude/agents and ~/.claude/hooks to the
// same ~/.claude/.synapse-deployed.json, which is deliberate (decision C) --
// but it means a flat `deployed` list would make every deployed hook look
// like an orphaned agent, and a v1 manifest on disk (no `hooks` key at all)
// must not be misread as owning zero agents just because hooks were added
// later.
// ---------------------------------------------------------------------------

// The migration test. If this regresses, every existing install's next
// deploy refuses all seven agents and exits 3.
test('a v1 manifest still owns its agents after the hooks list is added', () => {
  const s = scratch()
  try {
    writeAgent(s.sourceDir, 'synapse-coder.md', 'new body')
    writeAgent(s.targetDir, 'synapse-coder.md', 'old body')
    writeAgent(s.sourceDir, 'orchestrator-boundary.mjs', 'hook body')
    writeFileSync(manifestPath(s.targetDir), JSON.stringify({ version: 1, deployed: ['synapse-coder.md'] }))

    const result = deploy({
      sourceDir: s.sourceDir,
      targetDir: s.targetDir,
      hooksSourceDir: s.sourceDir,
      hooksTargetDir: s.hooksTargetDir,
    })

    assert.deepEqual(result.foreign, [])
    assert.deepEqual(result.writable, ['synapse-coder.md'])
    assert.equal(readFileSync(join(s.targetDir, 'synapse-coder.md'), 'utf8'), 'new body')
  } finally {
    s.cleanup()
  }
})

test('a v1 manifest reads as owning no hooks', () => {
  const s = scratch()
  try {
    writeAgent(s.sourceDir, 'orchestrator-boundary.mjs', 'new hook body')
    writeAgent(s.hooksTargetDir, 'synapse-orchestrator-boundary.mjs', 'someone elses hook')
    writeFileSync(manifestPath(s.targetDir), JSON.stringify({ version: 1, deployed: [] }))

    const result = deploy({
      sourceDir: s.sourceDir,
      targetDir: s.targetDir,
      hooksSourceDir: s.sourceDir,
      hooksTargetDir: s.hooksTargetDir,
    })

    assert.deepEqual(result.hookForeign, ['synapse-orchestrator-boundary.mjs'])
  } finally {
    s.cleanup()
  }
})

test('refuses to overwrite a hook it did not deploy', () => {
  const s = scratch()
  try {
    writeAgent(s.sourceDir, 'orchestrator-boundary.mjs', 'ours')
    writeAgent(s.hooksTargetDir, 'synapse-orchestrator-boundary.mjs', 'THEIR PRECIOUS HOOK')

    const result = deploy({
      sourceDir: s.sourceDir,
      targetDir: s.targetDir,
      hooksSourceDir: s.sourceDir,
      hooksTargetDir: s.hooksTargetDir,
    })

    assert.deepEqual(result.hookForeign, ['synapse-orchestrator-boundary.mjs'])
    assert.deepEqual(result.hookWritable, [])
    assert.equal(
      readFileSync(join(s.hooksTargetDir, 'synapse-orchestrator-boundary.mjs'), 'utf8'),
      'THEIR PRECIOUS HOOK',
      'a foreign hook must survive a deploy untouched',
    )
  } finally {
    s.cleanup()
  }
})

test('--force overwrites a foreign hook', () => {
  const s = scratch()
  try {
    writeAgent(s.sourceDir, 'orchestrator-boundary.mjs', 'ours')
    writeAgent(s.hooksTargetDir, 'synapse-orchestrator-boundary.mjs', 'theirs')

    const result = deploy({
      sourceDir: s.sourceDir,
      targetDir: s.targetDir,
      hooksSourceDir: s.sourceDir,
      hooksTargetDir: s.hooksTargetDir,
      force: true,
    })

    assert.deepEqual(result.hookWritable, ['synapse-orchestrator-boundary.mjs'])
    assert.equal(readFileSync(join(s.hooksTargetDir, 'synapse-orchestrator-boundary.mjs'), 'utf8'), 'ours')
  } finally {
    s.cleanup()
  }
})

test('a corrupt manifest is read as owning no hooks either', () => {
  const s = scratch()
  try {
    writeAgent(s.sourceDir, 'orchestrator-boundary.mjs', 'ours')
    writeAgent(s.hooksTargetDir, 'synapse-orchestrator-boundary.mjs', 'theirs')
    writeFileSync(manifestPath(s.targetDir), '{ this is not json')

    const result = deploy({
      sourceDir: s.sourceDir,
      targetDir: s.targetDir,
      hooksSourceDir: s.sourceDir,
      hooksTargetDir: s.hooksTargetDir,
    })

    assert.equal(result.corruptManifest, true)
    assert.deepEqual(result.hookForeign, ['synapse-orchestrator-boundary.mjs'])
    assert.equal(readFileSync(join(s.hooksTargetDir, 'synapse-orchestrator-boundary.mjs'), 'utf8'), 'theirs')
  } finally {
    s.cleanup()
  }
})

test('a deployed hook is not reported as an orphaned agent', () => {
  const s = scratch()
  try {
    writeAgent(s.sourceDir, 'manager.md', 'x')
    writeAgent(s.sourceDir, 'orchestrator-boundary.mjs', 'hook body')

    deploy({
      sourceDir: s.sourceDir,
      targetDir: s.targetDir,
      hooksSourceDir: s.sourceDir,
      hooksTargetDir: s.hooksTargetDir,
    })
    const result = deploy({
      sourceDir: s.sourceDir,
      targetDir: s.targetDir,
      hooksSourceDir: s.sourceDir,
      hooksTargetDir: s.hooksTargetDir,
    })

    assert.deepEqual(result.orphans, [])
  } finally {
    s.cleanup()
  }
})

test('--prune does not delete a deployed hook while pruning agents', () => {
  const s = scratch()
  try {
    writeAgent(s.sourceDir, 'coder.md', 'v1')
    writeAgent(s.sourceDir, 'orchestrator-boundary.mjs', 'hook body')
    deploy({
      sourceDir: s.sourceDir,
      targetDir: s.targetDir,
      hooksSourceDir: s.sourceDir,
      hooksTargetDir: s.hooksTargetDir,
    })

    rmSync(join(s.sourceDir, 'coder.md'))
    writeAgent(s.sourceDir, 'synapse-coder.md', 'v2')
    const result = deploy({
      sourceDir: s.sourceDir,
      targetDir: s.targetDir,
      hooksSourceDir: s.sourceDir,
      hooksTargetDir: s.hooksTargetDir,
      prune: true,
    })

    assert.deepEqual(result.pruned, ['coder.md'])
    assert.equal(existsSync(join(s.hooksTargetDir, 'synapse-orchestrator-boundary.mjs')), true)
    assert.deepEqual(readManifest(s.targetDir).hooks, ['synapse-orchestrator-boundary.mjs'])
  } finally {
    s.cleanup()
  }
})

test('deploying twice is a no-op for hooks too', () => {
  const s = scratch()
  try {
    writeAgent(s.sourceDir, 'orchestrator-boundary.mjs', 'hook body')

    const first = deploy({
      sourceDir: s.sourceDir,
      targetDir: s.targetDir,
      hooksSourceDir: s.sourceDir,
      hooksTargetDir: s.hooksTargetDir,
    })
    const second = deploy({
      sourceDir: s.sourceDir,
      targetDir: s.targetDir,
      hooksSourceDir: s.sourceDir,
      hooksTargetDir: s.hooksTargetDir,
    })

    assert.deepEqual(first.hookChanged, ['synapse-orchestrator-boundary.mjs'])
    assert.deepEqual(second.hookChanged, [])
    assert.deepEqual(second.hookSame, ['synapse-orchestrator-boundary.mjs'])
  } finally {
    s.cleanup()
  }
})

test('the manifest round-trips both lists', () => {
  const s = scratch()
  try {
    writeAgent(s.sourceDir, 'manager.md', 'x')
    writeAgent(s.sourceDir, 'orchestrator-boundary.mjs', 'hook body')

    deploy({
      sourceDir: s.sourceDir,
      targetDir: s.targetDir,
      hooksSourceDir: s.sourceDir,
      hooksTargetDir: s.hooksTargetDir,
    })

    const manifest = readManifest(s.targetDir)
    assert.equal(manifest.version, 2)
    assert.deepEqual(manifest.deployed, ['manager.md'])
    assert.deepEqual(manifest.hooks, ['synapse-orchestrator-boundary.mjs'])
  } finally {
    s.cleanup()
  }
})

test('the hook deploys under its synapse- prefixed name', () => {
  const s = scratch()
  try {
    const hookBody = 'console.log("hook")'
    writeAgent(s.sourceDir, 'orchestrator-boundary.mjs', hookBody)

    deploy({
      sourceDir: s.sourceDir,
      targetDir: s.targetDir,
      hooksSourceDir: s.sourceDir,
      hooksTargetDir: s.hooksTargetDir,
    })

    assert.equal(existsSync(join(s.hooksTargetDir, 'synapse-orchestrator-boundary.mjs')), true)
    assert.equal(
      readFileSync(join(s.hooksTargetDir, 'synapse-orchestrator-boundary.mjs'), 'utf8'),
      hookBody,
    )
  } finally {
    s.cleanup()
  }
})

test('--check does not create the hooks target directory or write files', () => {
  const s = scratch()
  try {
    writeAgent(s.sourceDir, 'orchestrator-boundary.mjs', 'hook body')

    const result = deploy({
      sourceDir: s.sourceDir,
      targetDir: s.targetDir,
      hooksSourceDir: s.sourceDir,
      hooksTargetDir: s.hooksTargetDir,
      check: true,
    })

    assert.equal(existsSync(s.hooksTargetDir), false, 'check mode must not create the hooks target')
    assert.deepEqual(result.hookChanged, ['synapse-orchestrator-boundary.mjs'])
  } finally {
    s.cleanup()
  }
})

// ------------------------------------------- boundary hook registration
//
// The banner used to claim "deployed but NOT registered" without ever reading
// settings.json, so a correctly-configured machine was told to paste the
// fragment a second time -- which logs every tool call twice. These cases pin
// the detection that decides which banner prints.

/** Write a settings.json into a scratch dir and return its path. */
function settingsWith(root, contents) {
  const path = join(root, 'settings.json')
  writeFileSync(path, typeof contents === 'string' ? contents : JSON.stringify(contents), 'utf8')
  return path
}

test('registration: a settings file carrying the hook reads as registered', () => {
  const s = scratch()
  try {
    const path = settingsWith(s.root, {
      hooks: {
        PreToolUse: [
          { matcher: '*', hooks: [{ type: 'command', command: '"$HOME/.claude/hooks/research-guard.sh"' }] },
          { matcher: '*', hooks: [{ type: 'command', command: 'node "$HOME/.claude/hooks/synapse-orchestrator-boundary.mjs"' }] },
        ],
      },
    })
    assert.equal(isBoundaryHookRegistered(path), true,
      'the hook is the SECOND entry -- an implementation checking only the first would miss it')
  } finally {
    s.cleanup()
  }
})

test('registration: other hooks present but not ours reads as NOT registered', () => {
  const s = scratch()
  try {
    const path = settingsWith(s.root, {
      hooks: { PreToolUse: [{ matcher: '*', hooks: [{ type: 'command', command: '"$HOME/.claude/hooks/research-guard.sh"' }] }] },
    })
    assert.equal(isBoundaryHookRegistered(path), false)
  } finally {
    s.cleanup()
  }
})

test('registration: missing, empty, and malformed settings all read as NOT registered', () => {
  const s = scratch()
  try {
    assert.equal(isBoundaryHookRegistered(join(s.root, 'does-not-exist.json')), false, 'missing file')
    assert.equal(isBoundaryHookRegistered(settingsWith(s.root, {})), false, 'no hooks key at all')
    assert.equal(isBoundaryHookRegistered(settingsWith(s.root, { hooks: {} })), false, 'no PreToolUse array')
    assert.equal(isBoundaryHookRegistered(settingsWith(s.root, '{ not json')), false, 'malformed JSON never throws')
  } finally {
    s.cleanup()
  }
})

test('registration: an entry with no hooks array does not throw', () => {
  const s = scratch()
  try {
    const path = settingsWith(s.root, { hooks: { PreToolUse: [{ matcher: '*' }] } })
    assert.equal(isBoundaryHookRegistered(path), false)
  } finally {
    s.cleanup()
  }
})
