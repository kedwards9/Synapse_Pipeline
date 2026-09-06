// Tests for the prompt extractor.
//
// The first three groups pin the three on-disk facts that each produced a
// plausible-looking wrong answer before being measured. They are the reason
// this file exists; a fixture invented from the format's documentation would
// not contain any of them.

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  isSynthetic,
  parseJsonl,
  extractPrompt,
  selectPrompts,
  dedupe,
  slugFor,
  matchesSlug,
  renderMarkdown,
  renderPlain,
  parseArgs,
  DEFAULT_PASTE_CHARS,
} from './prompt-record.mjs'

const T = '2026-08-28T20:00:00.000Z'
const ms = (iso) => Date.parse(iso)
const WINDOW = { from: ms(T), to: ms(T) }

// ---------- 1. a human prompt is a STRING, not a block array ----------

test('a prompt stored as a plain string is found', () => {
  // THE BUG THIS PINS: filtering on the block-array shape -- the shape
  // assistant turns use -- returned 1-4 prompts per session where the true
  // count was 20-52, and looked plausible enough to believe.
  const got = extractPrompt({ type: 'user', message: { content: 'go over the queue again' } })
  assert.deepEqual(got, { text: 'go over the queue again', interrupted: false })
})

test('the block-array form is still read, for the records that use it', () => {
  const got = extractPrompt({
    type: 'user',
    message: { content: [{ type: 'text', text: 'from a block' }] },
  })
  assert.equal(got.text, 'from a block')
})

test('a tool_result-only user turn yields no prompt', () => {
  const got = extractPrompt({
    type: 'user',
    message: { content: [{ type: 'tool_result', content: 'output' }] },
  })
  assert.equal(got, null)
})

// ---------- 2. mid-turn messages are queue-operations, stored twice ----------

test('a message typed mid-turn is found, and marked as such', () => {
  // THE BUG THIS PINS: these are not `user` turns at all. Eight were missing
  // from an extraction whose own header called interruptions its highest-signal
  // entries.
  const got = extractPrompt({
    type: 'queue-operation', operation: 'enqueue',
    content: "it's obviously not letting you do it. Stop.",
  })
  assert.equal(got.text, "it's obviously not letting you do it. Stop.")
  assert.equal(got.interrupted, true)
})

test('the `remove` half of the pair is ignored, so it is not counted twice', () => {
  const remove = { type: 'queue-operation', operation: 'remove', content: 'same text' }
  assert.equal(extractPrompt(remove), null)
})

test('an enqueue/remove pair yields exactly one prompt end to end', () => {
  const records = [
    { type: 'queue-operation', operation: 'enqueue', content: 'stop', timestamp: T },
    { type: 'queue-operation', operation: 'remove', content: 'stop', timestamp: T },
  ]
  assert.equal(dedupe(selectPrompts(records, WINDOW)).length, 1)
})

// ---------- 3. the project directory appears under two casings ----------

test('each separator becomes its own dash', () => {
  // `E:\synapse` is `E--synapse`, not `E-synapse`: the colon and the backslash
  // are two separators. Collapsing runs of separators to one dash was the first
  // implementation and it matched nothing on disk.
  assert.equal(slugFor('E:\\synapse'), 'E--synapse')
  assert.equal(slugFor('/home/k/synapse'), '-home-k-synapse')
})

test('a directory matches its project regardless of case', () => {
  // MEASURED: E--Synapse and E--synapse both exist and hold overlapping files,
  // because the directory name follows however the path was typed that session.
  assert.equal(matchesSlug('E--Synapse', slugFor('E:\\synapse')), true)
  assert.equal(matchesSlug('E--synapse', slugFor('<synapse>')), true)
})

test('a different project does not match', () => {
  assert.equal(matchesSlug('E--Untitled-RPG', slugFor('E:\\synapse')), false)
})

// ---------- the synthetic filter is anchored, not a substring match ----------

test('harness text is dropped when it opens the message', () => {
  assert.equal(isSynthetic('<system-reminder>do not respond</system-reminder>'), true)
  assert.equal(isSynthetic('<task-notification><task-id>abc</task-id>'), true)
  assert.equal(isSynthetic('Base directory for this skill: C:\\x'), true)
  assert.equal(isSynthetic('Skill /takehandoff is already loaded above'), true)
})

test('a prompt that MENTIONS harness text is still a prompt', () => {
  // The whole reason this is anchored. A substring match here is the same
  // mistake that made a marker check fire on the sentence saying the marker
  // was absent -- docs/LESSONS.md, "A marker check matched the sentence saying
  // the marker was absent."
  assert.equal(isSynthetic('why does <system-reminder> keep showing up?'), false)
  assert.equal(isSynthetic('the task-notification block is noisy'), false)
})

// ---------- pastes are stubbed, not dropped ----------

test('an oversized paste is recorded as a stub with its opening words', () => {
  const body = `The video opens here.\n${'x'.repeat(DEFAULT_PASTE_CHARS + 100)}`
  const [got] = selectPrompts(
    [{ type: 'user', timestamp: T, message: { content: body } }],
    WINDOW,
  )
  assert.match(got.text, /^\[PASTED — /)
  assert.match(got.text, /The video opens here\./)
  assert.equal(got.pastedChars, body.length)
})

test('a paste is not silently discarded -- what was pasted is part of the record', () => {
  const [got] = selectPrompts(
    [{ type: 'user', timestamp: T, message: { content: 'y'.repeat(9000) } }],
    WINDOW,
  )
  assert.ok(got, 'the prompt must survive as a stub')
})

test('the paste threshold is configurable', () => {
  const [got] = selectPrompts(
    [{ type: 'user', timestamp: T, message: { content: 'a short one' } }],
    { ...WINDOW, pasteChars: 5 },
  )
  assert.match(got.text, /^\[PASTED — /)
})

// ---------- windowing ----------

test('the window is inclusive at both ends and excludes either side', () => {
  const at = (iso) => ({ type: 'user', timestamp: iso, message: { content: iso } })
  const got = selectPrompts(
    [
      at('2026-08-28T19:59:59.999Z'),
      at('2026-08-28T20:00:00.000Z'),
      at('2026-08-28T20:30:00.000Z'),
      at('2026-08-28T21:00:00.000Z'),
      at('2026-08-28T21:00:00.001Z'),
    ],
    { from: ms('2026-08-28T20:00:00Z'), to: ms('2026-08-28T21:00:00Z') },
  )
  assert.equal(got.length, 3)
})

test('a record with no parseable timestamp is skipped rather than defaulted', () => {
  const got = selectPrompts(
    [{ type: 'user', timestamp: 'not a date', message: { content: 'x' } }],
    WINDOW,
  )
  assert.equal(got.length, 0)
})

// ---------- parseJsonl ----------

test('a torn line is skipped and counted, not thrown', () => {
  const { records, skipped } = parseJsonl('{"a":1}\n{"b": broken\n{"c":3}\n')
  assert.equal(records.length, 2)
  assert.equal(skipped, 1)
})

// ---------- dedupe ----------

test('dedupe keeps the first occurrence and drops later identical text', () => {
  const got = dedupe([
    { at: 1, text: 'same' },
    { at: 2, text: 'same' },
    { at: 3, text: 'different' },
  ])
  assert.deepEqual(got.map((p) => p.at), [1, 3])
})

test('dedupe compares trimmed text, so whitespace does not defeat it', () => {
  assert.equal(dedupe([{ at: 1, text: 'x' }, { at: 2, text: '  x  ' }]).length, 1)
})

// ---------- rendering ----------

test('markdown marks a mid-turn prompt and leaves an ordinary one unmarked', () => {
  const out = renderMarkdown([
    { at: ms(T), session: 'abc12345', interrupted: true, text: 'stop' },
    { at: ms(T), session: 'abc12345', interrupted: false, text: 'carry on' },
  ])
  assert.match(out, /sent mid-turn/)
  assert.equal(out.match(/sent mid-turn/g).length, 1)
})

test('markdown quotes every line of a multi-line prompt', () => {
  const out = renderMarkdown([
    { at: ms(T), session: 's', interrupted: false, text: 'one\ntwo' },
  ])
  assert.match(out, /> one\n> two/)
})

test('markdown says so when the range is empty', () => {
  assert.match(renderMarkdown([]), /No prompts in that range/)
})

test('plain output collapses newlines so one prompt is one line', () => {
  const out = renderPlain([
    { at: ms(T), session: 's', interrupted: false, text: 'one\ntwo' },
  ])
  assert.equal(out.trim().split('\n').length, 1)
})

// ---------- args ----------

test('parseArgs reads the range positionally and the rest by flag', () => {
  const o = parseArgs(['2026-08-24T00:00Z', '2026-08-29T00:00Z', '--project', 'E:\\synapse', '--plain'])
  assert.equal(o.from, '2026-08-24T00:00Z')
  assert.equal(o.to, '2026-08-29T00:00Z')
  assert.equal(o.project, 'E:\\synapse')
  assert.equal(o.format, 'plain')
})

test('parseArgs defaults the project to the working directory', () => {
  assert.equal(parseArgs(['2026-08-24T00:00Z']).project, process.cwd())
})
