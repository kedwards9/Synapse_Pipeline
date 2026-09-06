// Tests for the investigation reconstructor.
//
// The cases that matter here are the ones measured against real data on
// 2026-08-28 and that a hand-written fixture would not think to include:
// a repository appearing under two different cases, a `cwd` that is a
// subdirectory rather than the root, and `thinking` blocks that are present
// but empty. Each has its own test below and each is labelled with why.

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  parseJsonl,
  parseWindow,
  normaliseSegments,
  containsPath,
  selectEvents,
  selectTurns,
  merge,
  render,
  buildReport,
  parseArgs,
} from './investigation-window.mjs'

const T0 = '2026-08-28T20:00:00.000Z'
const ms = (iso) => Date.parse(iso)

const action = (at, over = {}) => JSON.stringify({
  at, sessionId: 's1', agentId: null, agentType: null, seat: 'main',
  toolName: 'Bash', rule: 'bash-content', wouldDeny: true,
  detail: 'wc -l file', cwd: 'E:\\synapse', permissionMode: 'auto',
  transcriptPath: 'C:\\t\\s1.jsonl', ...over,
})

const said = (at, text, type = 'assistant') => JSON.stringify({
  type, timestamp: at, message: { content: [{ type: 'text', text }] },
})

// ---------- parseJsonl ----------

test('parseJsonl skips a torn line rather than throwing, and counts it', () => {
  const { records, skipped } = parseJsonl(`${action(T0)}\n{"at": broken\n${action(T0)}\n`)
  assert.equal(records.length, 2)
  assert.equal(skipped, 1,
    'the boundary log is appended to by live sessions, so a partial last line is ' +
    'expected -- it must not blank the window')
})

test('parseJsonl ignores blank lines without counting them as damage', () => {
  const { records, skipped } = parseJsonl(`${action(T0)}\n\n   \n`)
  assert.equal(records.length, 1)
  assert.equal(skipped, 0)
})

// ---------- parseWindow ----------

test('parseWindow accepts an explicit range', () => {
  const w = parseWindow('2026-08-28T20:00:00Z..2026-08-28T21:00:00Z')
  assert.equal(w.to - w.from, 3600_000)
})

test('parseWindow accepts a start plus minutes and plus hours', () => {
  assert.equal(parseWindow('2026-08-28T20:00:00Z+45m').to - parseWindow('2026-08-28T20:00:00Z+45m').from, 45 * 60_000)
  assert.equal(parseWindow('2026-08-28T20:00:00Z+2h').to - parseWindow('2026-08-28T20:00:00Z+2h').from, 2 * 3600_000)
})

test('parseWindow returns null rather than guessing', () => {
  // A window that silently defaulted to "everything" would print a whole day
  // of unrelated work and read as though it were one investigation.
  for (const bad of ['', 'yesterday', null, undefined, '2026-13-45..nonsense']) {
    assert.equal(parseWindow(bad), null, `${JSON.stringify(bad)} must not parse`)
  }
})

test('parseWindow rejects a backwards range', () => {
  assert.equal(parseWindow('2026-08-28T21:00:00Z..2026-08-28T20:00:00Z'), null)
})

// ---------- path matching: the two measured hazards ----------

test('win32: a repository under two different cases matches either way', () => {
  // MEASURED 2026-08-28: the live log held E:\synapse 2,838 times and
  // <synapse> 2,609 times -- the same repo. Equality drops half the records.
  const lower = normaliseSegments('E:\\synapse', 'win32')
  const upper = normaliseSegments('<synapse>', 'win32')
  assert.deepEqual(lower, upper)
})

test('linux: case is NOT folded, because ext4 is case-sensitive', () => {
  assert.notDeepEqual(
    normaliseSegments('/home/k/synapse', 'linux'),
    normaliseSegments('/home/k/Synapse', 'linux'),
  )
})

test('a subdirectory cwd still belongs to its repository', () => {
  // MEASURED: E:\synapse\watcher\docs appeared 83 times. cwd is the session's
  // working directory, not the repo root.
  assert.ok(containsPath(
    normaliseSegments('E:\\synapse\\watcher\\docs', 'win32'),
    normaliseSegments('E:\\synapse', 'win32'),
  ))
})

test('a sibling with a shared prefix does NOT match', () => {
  // The reason this is segment-wise and not startsWith.
  assert.equal(containsPath(
    normaliseSegments('E:\\synapseX', 'win32'),
    normaliseSegments('E:\\synapse', 'win32'),
  ), false)
})

test('containsPath refuses an empty root rather than matching everything', () => {
  assert.equal(containsPath(normaliseSegments('E:\\synapse', 'win32'), []), false)
})

// ---------- selectEvents ----------

test('selectEvents keeps only what is inside the window, inclusive at both ends', () => {
  const { records } = parseJsonl([
    action('2026-08-28T19:59:59.999Z'),
    action('2026-08-28T20:00:00.000Z'),
    action('2026-08-28T20:30:00.000Z'),
    action('2026-08-28T21:00:00.000Z'),
    action('2026-08-28T21:00:00.001Z'),
  ].join('\n'))
  const got = selectEvents(records, { from: ms(T0), to: ms('2026-08-28T21:00:00.000Z') })
  assert.equal(got.length, 3)
})

test('selectEvents narrows to a repository across both casings at once', () => {
  const { records } = parseJsonl([
    action(T0, { cwd: 'E:\\synapse' }),
    action(T0, { cwd: '<synapse>\\watcher' }),
    action(T0, { cwd: 'E:\\other-project' }),
  ].join('\n'))
  const got = selectEvents(records, {
    from: ms(T0), to: ms(T0), cwd: 'E:\\synapse',
  })
  assert.equal(got.length, process.platform === 'win32' ? 2 : 1,
    'on win32 both casings belong to the same repository')
})

test('selectEvents survives a record with no transcriptPath', () => {
  // MEASURED: 23 of 5,763 records lacked it.
  const { records } = parseJsonl(action(T0, { transcriptPath: undefined }))
  const got = selectEvents(records, { from: ms(T0), to: ms(T0) })
  assert.equal(got[0].transcriptPath, null)
})

// ---------- selectTurns ----------

test('selectTurns drops empty thinking blocks instead of emitting blanks', () => {
  // MEASURED: 70 thinking blocks in a live transcript, every one an empty
  // string with only a signature. Emitting them would read as "said nothing"
  // rather than as "never recorded", which is a different and false claim.
  const line = JSON.stringify({
    type: 'assistant', timestamp: T0,
    message: { content: [
      { type: 'thinking', thinking: '', signature: 'CAIS...' },
      { type: 'text', text: 'the visible part' },
    ] },
  })
  const got = selectTurns(parseJsonl(line).records, { from: ms(T0), to: ms(T0) })
  assert.equal(got.length, 1)
  assert.equal(got[0].text, 'the visible part')
})

test('selectTurns keeps user turns as well as assistant ones', () => {
  const { records } = parseJsonl([
    said(T0, 'a question', 'user'),
    said(T0, 'an answer', 'assistant'),
  ].join('\n'))
  const got = selectTurns(records, { from: ms(T0), to: ms(T0) })
  assert.deepEqual(got.map((t) => t.who), ['user', 'assistant'])
})

test('selectTurns ignores record types that are not conversation', () => {
  const { records } = parseJsonl(JSON.stringify({
    type: 'file-history-snapshot', timestamp: T0, message: { content: [{ type: 'text', text: 'x' }] },
  }))
  assert.equal(selectTurns(records, { from: ms(T0), to: ms(T0) }).length, 0)
})

// ---------- merge ----------

test('merge puts a statement before an action in the same millisecond', () => {
  // A message is what PROMPTED the call recorded at the same instant, never a
  // reaction to it. Getting this backwards inverts cause and effect in the
  // rendered story, which is the one thing the story is for.
  const out = merge(
    [{ kind: 'action', at: 1000, tool: 'Bash', seat: 'main', agentType: null, detail: '' }],
    [{ kind: 'said', at: 1000, who: 'assistant', text: 'checking' }],
  )
  assert.equal(out[0].kind, 'said')
})

test('merge orders strictly by time otherwise', () => {
  const out = merge(
    [{ kind: 'action', at: 3, tool: 'B', seat: 'main', agentType: null, detail: '' }],
    [{ kind: 'said', at: 5, who: 'assistant', text: 'later' },
     { kind: 'said', at: 1, who: 'user', text: 'first' }],
  )
  assert.deepEqual(out.map((o) => o.at), [1, 3, 5])
})

// ---------- render ----------

test('render says so explicitly when the window is empty', () => {
  assert.match(render([]), /Nothing in that window/)
})

test('render collapses a multi-line command onto one line', () => {
  const out = render([{
    kind: 'action', at: ms(T0), tool: 'Bash', seat: 'main', agentType: null,
    detail: 'line one\nline two',
  }])
  assert.match(out, /line one line two/)
  assert.doesNotMatch(out, /line one\nline two/)
})

test('render labels a subagent by its agent type', () => {
  const out = render([{
    kind: 'action', at: ms(T0), tool: 'Read', seat: 'subagent',
    agentType: 'Explore', detail: '',
  }])
  assert.match(out, /_\(Explore\)_/)
})

test('render truncates rather than dumping a 7kB command body', () => {
  // MEASURED: max detail length in the live log was 7,219 characters.
  const out = render(
    [{ kind: 'action', at: ms(T0), tool: 'Bash', seat: 'main', agentType: null, detail: 'x'.repeat(7219) }],
    { detailChars: 50 },
  )
  assert.ok(out.includes('…'))
  assert.ok(out.length < 400)
})

// ---------- buildReport ----------

test('buildReport reports the transcripts a window touched', () => {
  const logText = [
    action(T0, { transcriptPath: 'C:\\t\\a.jsonl' }),
    action(T0, { transcriptPath: 'C:\\t\\b.jsonl' }),
    action(T0, { transcriptPath: 'C:\\t\\a.jsonl' }),
  ].join('\n')
  const r = buildReport({
    logText, transcriptText: '',
    window: { from: ms(T0), to: ms(T0) }, cwd: null,
  })
  assert.deepEqual(r.transcripts.sort(), ['C:\\t\\a.jsonl', 'C:\\t\\b.jsonl'])
})

test('buildReport works with no transcript at all, actions only', () => {
  const r = buildReport({
    logText: action(T0), transcriptText: '',
    window: { from: ms(T0), to: ms(T0) }, cwd: null,
  })
  assert.equal(r.actionCount, 1)
  assert.equal(r.turnCount, 0)
  assert.match(r.markdown, /\*\*Bash\*\*/)
})

// ---------- parseArgs ----------

test('parseArgs reads the window positionally and the rest by flag', () => {
  const o = parseArgs(['2026-08-28T20:00Z+30m', '--cwd', 'E:\\synapse', '--log', 'L'])
  assert.equal(o.window, '2026-08-28T20:00Z+30m')
  assert.equal(o.cwd, 'E:\\synapse')
  assert.equal(o.log, 'L')
  assert.equal(o.transcript, null)
})
