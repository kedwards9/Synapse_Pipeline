# Plan — three cuts to pipeline token burn

**Design:** `specs/2026-08-30-pipeline-burn-three-cuts.md`, committed at
`f507ce7` and amended at `c1388ba`.

**This plan is NOT for the pipeline.** Every task below edits `agents/*.md` or a
file agents are told to run, and CLAUDE.md is explicit: *"Any change to
`agents/*.md`, or to the rules in this file that govern the pipeline, is made
OUTSIDE the pipeline — by a plain session, directly."* Do not dispatch
`synapse-manager` to execute this. A brainstorm session runs it.

**Sign every commit `Session: brainstorm`.**

---

## Division of labour, stated up front

Tasks 1–4 are mechanical and can be done and verified in a session.

**Task 5 is Karl's and cannot be delegated.** A pipeline change is only tested
by a fresh Manager running under the new definitions, and Manager is launched by
a human with `claude --agent synapse-manager`. Nothing before task 5 is
evidence that any of this works.

---

## Task 1 — the test reporter

**Cut 1. Independent of everything else. Largest saving, smallest change.**

### 1.1 Change the watcher test script

In `watcher/package.json`, the `test` script becomes:

    node --test --test-reporter=dot "src/**/*.test.mjs"

and a new sibling is added:

    "test:verbose": "node --test \"src/**/*.test.mjs\""

**The flag must sit BEFORE the glob.** Measured 2026-08-30: after the glob it is
silently ignored and the full 62,835 bytes are printed, and
`npm test -- --test-reporter=dot` is ignored the same way. A change that appends
the flag will appear correct and save nothing.

### 1.2 Verify the reduction, do not assume it

    npm --prefix watcher test 2>&1 | wc -c

**Expect roughly 830. If it is near 62,835 the flag is in the wrong place.**
This check is the whole point of the task; do not skip it because the diff looks
right.

### 1.3 Confirm failures still carry detail

Temporarily break one assertion in any test file, run the suite, and confirm the
output still names the failing test and prints its assertion and diff. Then
revert the break.

Measured 2026-08-30: `dot` prints `.X` followed by a full `Failed tests:` block.
**This is what makes the "no conditional re-run" decision safe**, so it is worth
one minute to see it rather than trusting this paragraph.

### 1.4 Update the two documents that name the command

- `CONTEXT.md` §4 — the verification block.
- `agents/synapse-manager.md` — the stewardship note that contrasts
  `node --test scripts/*.test.mjs` with `npm --prefix watcher test`. Check
  whether the wording still reads correctly; do not change its meaning.

### 1.5 Decide the scripts suite

`node --test scripts/*.test.mjs` has the same problem at a smaller scale (226
tests). Either add a `--test-reporter=dot` to the invocations in `CONTEXT.md`, or
leave it and record why. **Either is acceptable; silently doing neither is not.**

**Commit boundary.** Suites green, then commit.

---

## Task 2 — Coder judges whether a record is enough

**Cut 2. Touches `agents/synapse-manager.md` and `agents/synapse-coder.md`.**

### 2.1 Widen Manager's existing skip

Manager already skips Planner when handed a path to a written plan. Widen that
so it also fires when the dispatch names **a record that the queue entry
declares to be the plan.**

Keep the existing plan-path case working exactly as it does now. This is a
second trigger for an existing branch, not a new branch.

### 2.2 Tell Manager what a rejection means

Manager must handle Coder returning *"this record is not sufficient"* by
dispatching `synapse-planner`, then continuing at step 2 with the plan Planner
produces.

**It must not treat the rejection as a failed task**, retry Coder, or count it
against the rejection counter. It is the backstop working.

### 2.3 Give Coder the judgement, and make refusing blameless

In `agents/synapse-coder.md`: when dispatched with a record instead of a plan,
Coder reads the record and decides whether it can implement from it.

If it cannot, it stops and says so, naming **what is missing** rather than
returning a verdict — the same shape as Reviewer's findings.

**Write the refusal as a success.** Copy the register of Coder's existing
`Session:` refusal, which stops rather than guessing because guessing is a claim
about something it cannot observe. The failure mode being prevented is an
agreeable Coder producing code against a thin record, and it fails *quietly*:
Reviewer sees code and a record, not the absence of a plan.

### 2.4 Document the queue declaration

`watcher/docs/DISPATCH-QUEUE.md` needs one line in *How to use this* saying how
a queue entry declares that a record is the plan, so the mechanism has a written
form rather than a convention.

**Commit boundary.** `node scripts/agent-audit.mjs` exit 0, then commit.

---

## Task 3 — batch task-close bookkeeping

**Cut 3. Touches `agents/synapse-manager.md` only.**

In the stewardship stage, step (b) currently dispatches `synapse-coder`
separately for the tracker update, the map update (`1d0b9c3`) and the
uncommitted plan.

Gather them instead: collect every bookkeeping item found, then make **one**
Coder dispatch carrying all of them.

**The constraint to preserve, and it is the reason step (b) is worded so
emphatically:** batching must not become deferral. One dispatch with three items
is the goal. Zero dispatches because it felt like overhead is the failure the
step was written to prevent, and the text saying so must survive the edit.

**Commit boundary.** `agent-audit` exit 0, then commit.

---

## Task 4 — deploy and verify mechanically

    node scripts/agent-audit.mjs          # exit 0
    node scripts/context-audit.mjs        # exit 0
    npm --prefix watcher test             # 790 pass, and now ~830 bytes
    node --test scripts/*.test.mjs        # 226 pass
    node scripts/deploy-agents.mjs
    node scripts/verify-install.mjs       # 21 checks, no warning

**Normalise line endings to LF before deploying if any file was written by a
script.** Measured 2026-08-30: writing an agent definition from Python turns it
CRLF, and `verify-install`'s frontmatter parser then reports *"missing: name,
description, tools"* on fields that are plainly present. Four checks failed that
way today.

**Then tell Karl to restart any Manager session.** Definitions load at session
start.

---

## Task 5 — the graded test. Karl's, and the only real evidence.

Nothing above proves any of this works. `agent-audit` checks whether a definition
contradicts *itself*; a green suite says nothing about pipeline behaviour.

**Dispatch task 21 — the handoff line — through a fresh Manager.**

It is the right subject for three reasons:

- **It exercises all three cuts at once.** Coder runs the suite (cut 1),
  arrives against `watcher/docs/2026-08-29-watcher-card-back.md` which specifies
  it fully (cut 2), and closes with bookkeeping (cut 3).
- **It has a comparison.** Tasks 19 and 20 came off the same record, built warm
  and direct, on 2026-08-30. The cost difference is the warm-versus-cold number
  this whole line of work has been estimating.
- **It also tests today's other unverified changes** — the map read, the marker,
  the drift rules, the disagreement relay, the research gate.

### What to watch for

- **Did Planner run?** If it did, cut 2 did not fire and the reason matters.
- **Did Coder reject the record?** A legitimate outcome, not a failure — the
  record is thorough, so a rejection means Coder is being too cautious and the
  refusal wording needs softening.
- **Did the `handoff` ratchet fire?** `NOT_YET_COLLECTED_FIELDS` contains only
  `handoff`, and filling it without removing it fails `contracts.test.mjs`. This
  is a live test of whether Coder reads a warning left specifically for it.
- **Did Decision 3 survive?** `handoff` takes three values, and collapsing
  `false` into `null` is the predicted planner error the queue entry fences
  against.
- **How many Coder dispatches did stewardship make?** One is the target.

---

## What this plan does not do

- Does not cap or narrow research. Karl ruled on that 2026-08-30.
- Does not weaken Reviewer.
- Does not touch `COVERED_DIRS`, the stewardship diff-versus-status gap, or the
  undefined "source module" — those are correctness items 4–6 from the
  2026-08-30 review pass and are not token burn.
