# Three cuts to pipeline token burn

**Status: design, ready to plan. Not dispatched.**

Written outside the pipeline by a brainstorm session, per CLAUDE.md's *"the
pipeline does not fix the pipeline."* All three cuts edit `agents/*.md` or the
files agents are told to run, so none may be dispatched through Manager.

Background and the measurements that motivated this:
`specs/2026-08-30-pipeline-token-economics.md`.

---

## Why these three

The earlier spec identified orientation as the term that scales, and the map
built on 2026-08-30 addressed it. That was one gain and a bounded one: it made
each cold agent **cheaper to start**, and left untouched the fact that **five of
them start per task**.

These three are the next largest, chosen by measuring rather than by reasoning.
Cut 1 was not on any earlier list and is the biggest of the three.

**Explicitly still not proposed:** capping research (Karl ruled on it), and
weakening Reviewer (it found seven issues including a HIGH on two fully-tested
tasks).

---

## Cut 1 — the test reporter

### The measurement

Watcher's suite, 790 tests, run 2026-08-30:

| Reporter | Bytes | Approx tokens |
|---|---|---|
| default (`spec`) | 62,835 | ~15,700 |
| `dot` | 830 | ~210 |

**A 75× reduction for the same information.**

### Why it multiplies

- **Coder runs the suite several times per task** — the plan orders tests before
  implementation, so at minimum red, green, and a final confirmation.
- **Reviewer runs it again**, independently, because it does not trust a summary.
- **Reviewer is required to paste the output**, and Manager's stewardship step
  (a) refuses the task without it. So one run's output lands in **two** contexts.

At three Coder runs plus one Reviewer run plus one paste into Manager, that is
roughly **75k tokens per task on test output alone** — larger than any other
single item found.

### The fix

Change the default reporter in `watcher/package.json`:

    "test": "node --test --test-reporter=dot \"src/**/*.test.mjs\""

**Flag position is load-bearing and was measured.** After the glob the flag is
silently ignored — `node --test "src/**/*.test.mjs" --test-reporter=dot`
produced the full 62,835 bytes, and so did `npm test -- --test-reporter=dot`.
Only before the pattern does it take effect. A plan that appends the flag will
appear to work and change nothing.

Add a verbose escape hatch for humans:

    "test:verbose": "node --test \"src/**/*.test.mjs\""

The same change applies to the scripts suite wherever it is invoked.

### The risk that turned out not to exist

The obvious objection is that `dot` hides which test failed, forcing a verbose
re-run and spending the saving back. **Measured, and it does not.** On failure
`dot` emits `.X` followed by a full `Failed tests:` block carrying the test
name, the assertion, the message, the stack and the actual/expected diff.

So there is **no conditional re-run rule to write.** Collapsing happens only for
passes, which is exactly the part nobody reads.

### What still needs deciding

Whether `dot` becomes the default for everyone or only for agents. Making it the
default is simpler, needs no agent instruction at all, and gives the same benefit
to a human reading a terminal. See §Open questions.

---

## Cut 2 — Planner runs against work a record already specifies

### The problem

Manager already skips Planner in one case. Its definition:

> If the user gives a **path to a written plan** rather than a task to be
> planned, **skip step 1 entirely and start at step 2.**

**The gate is too narrow.** `watcher/docs/2026-08-29-watcher-card-back.md`
specifies tasks 19, 20 and 21 down to field shapes, caps, the tie-break
requirement and the empty-repository case. Dispatching Planner against that pays
a cold agent to re-derive a document that already exists.

**Evidence:** tasks 19 and 20 were built directly from that record on
2026-08-30, and a plan was not wanted at any point.

### The fix

Widen the existing skip so it fires on a **record that specifies the task**, not
only on a document whose filename says "plan".

This drops **one of five agents** — its definition load, its orientation and its
work — on any task a design record already covers, which in this project is most
of them. It is a structural cut rather than a constant-factor one.

### Who judges sufficiency — RESOLVED 2026-08-30

**"The record already specifies it" is a judgement, and Manager cannot make
it.** Manager reads summaries, never documents. Two options were on the table
and both were bad: a queue entry declaring it (forgeable by inattention) or
Manager asking the user per task (a round-trip every time, on the agent whose
purpose is to not need one).

**Neither is the answer. Coder is.** It reads the record anyway, and *"can I
implement from this?"* is precisely its job. So sufficiency is not proved up
front — it is **attempted, and failed cheaply when it is absent.**

**Mechanism and backstop**, the shape this project already uses for plan
commits:

- **Mechanism — the queue entry declares "the record is the plan."** Karl makes
  the call once, while the record is already open in front of him.
- **Backstop — Coder verifies on arrival and may reject upward.** It returns
  *"this record is not sufficient, I need a plan"*, and Manager dispatches
  Planner.

### Why the economics survive the backstop firing

A rejection wastes one Coder start — its definition, its orientation, and
reading one record. Call it roughly a third of a full Planner run. So the trade
is break-even at a 50% hit rate and a clear win above it. The observed rate in
this project is much higher: one record covered tasks 19, 20 and 21 completely.

**A small burn that prevents a larger one is the right trade**, and it is worth
stating in those terms so the backstop is not later "optimised" away.

### The one thing that must be written carefully

**Coder's refusal has to be explicitly blameless.** The failure mode is an
agreeable Coder ploughing ahead on a thin record and producing code against a
guess — and it fails *quietly*, because Reviewer sees code and a record, not
the absence of a plan.

**Coder already has this exact reflex and it is the precedent to copy.** It
refuses to guess a `Session:` trailer value and stops to ask, because guessing
is a claim about something it cannot observe. Returning "this record is not
enough" must read the same way: a success, not a failure to implement.

---

## Cut 3 — stewardship dispatches Coder repeatedly for bookkeeping

### The problem

Manager's stewardship stage now makes up to **two additional cold Coder
dispatches** per task, on top of the one that did the work:

1. **The map update** — added 2026-08-30 (`1d0b9c3`), when a diff adds or deletes
   a module without touching `CONTEXT.md`.
2. **The plan commit** — the existing backstop, when the plan was never
   committed.

Each is a full agent invocation: definition load, orientation, and a commit, to
edit one line of markdown.

**One of these is my own doing, added today**, which is why it is in this spec
rather than in a complaint about the pipeline.

### The fix

**Batch task-close bookkeeping into a single Coder dispatch.** Manager gathers
every bookkeeping item it found — map entry, uncommitted plan, tracker update —
and dispatches once with all of them, rather than once per item.

The saving is per-item-beyond-the-first, so it is a smaller cut than 1 or 2 and
is worth doing chiefly because it removes an inefficiency this session
introduced.

### The constraint to preserve

Step (b) exists because bookkeeping *was* being skipped, and the current text is
emphatic that it must not be. **Batching must not become an excuse to defer.**
One dispatch with three items is the goal; zero dispatches because it felt like
overhead is the failure this whole step was written to prevent.

---

## Open questions — Karl's

1. ~~**Cut 2's judgement: queue entry, or ask the user?**~~ **ANSWERED
   2026-08-30: neither — Coder judges, with the queue entry as the declaration
   and Coder's rejection as the backstop.** See cut 2 above.
2. **Does `dot` become the default for humans too, or only for agents?**
   Default-for-everyone needs no agent instruction at all, which is the
   strongest argument for it, and a `test:verbose` script covers anyone who
   wants the full list. **Taken as the default unless Karl says otherwise** —
   it is a `package.json` line and reversing it costs nothing.
3. **Should Reviewer's "paste the output" requirement change at all?** Under
   `dot` the paste is ~210 tokens and the requirement costs almost nothing, so
   the answer is probably no — but it is worth stating rather than assuming.
4. **Is cut 3 worth doing now, or after the Sept 3–5 repo split?** It touches the
   same stewardship text the split will disturb.

---

## Sequencing

**All three are plannable.** Nothing is blocked.

- **Cut 1** — independent, cheapest, largest. Question 2 has a stated default.
- **Cut 2** — unblocked by the resolution above. Touches Manager and Coder.
- **Cut 3** — independent, touches only Manager. Question 4 is a "when", not a
  "whether".

Cut 2 and cut 3 both edit Manager's dispatch and stewardship text, so planning
them together avoids two passes over the same file.
