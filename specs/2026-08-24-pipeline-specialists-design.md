# Pipeline specialists — architect, and reviewer briefs

**Status:** Design, approved 2026-08-24.
**Companion:** `agents/synapse-manager.md`, which this changes.

Three gaps were identified in Manager's code path: nothing owns system
design, nothing owns security, nothing owns test quality. This document
decides how each is closed.

---

## The decision

**One new agent. Two new briefs. No third and fourth agent.**

| Gap | Closed by | Why |
|---|---|---|
| System design | **New `synapse-architect` agent** | Occupies an empty phase — runs *before* planning, takes a problem rather than a plan, outputs a decision rather than steps. No existing agent is in that phase. |
| Security review | **`synapse-reviewer` security brief** | Reviewer already reads code, already gates, already pastes command output. A brief is the same move already settled for integration review. |
| Test quality | **`synapse-reviewer` tests brief, plus obligations on `synapse-planner` and `synapse-coder`** | Half of this cannot be a review at all — see below. |

This follows a precedent the project already set. From `docs/OVERVIEW.md`,
*What is settled*: "Integration review is the existing `synapse-reviewer` under a
second brief, **not a seventh agent**." The same reasoning applies twice more.

## Why test quality is not simply a third brief

TDD is a claim about **sequencing** — the test exists before the implementation
does. A reviewer runs after the code is written and cannot observe sequencing;
it sees only the final state, in which a test written first and a test written
last are indistinguishable.

So the gap splits:

- **What a review *can* catch** — tests missing entirely, tests that assert
  nothing meaningful, a documented invariant with no assertion behind it. This
  becomes the `tests` brief.
- **What a review *cannot* catch** — test-first ordering. This has to be an
  obligation earlier in the pipeline: `synapse-planner` writes the test step before the
  implementation step, and `synapse-coder` is required to honour that ordering rather
  than batch tests at the end.

Claiming a reviewer brief alone delivers TDD would be false, and this project
has already recorded what happens when a check is the wrong shape for what it
is meant to exclude (`docs/LESSONS.md` — hand-drawn art passed style review).

**This design does not claim to enforce TDD.** It makes test-first the
instructed default and makes missing or shallow tests a rejectable defect.
Nothing here can prove a test was written first.

## Briefs — the mechanism

A brief is **additional scope for a review**, never a new output. Reviewer's
existing contract is unchanged and remains binding:

- The default implementation review always runs. Briefs add to it; they never
  replace it.
- The three verdicts are unchanged. Brief findings map onto the existing ones:
  a security hole or a shallow test is `REJECTED(implementation)`; a plan that
  mandated the hole, or never asked for the tests, is `REJECTED(plan)`.
- The final-message format is unchanged: pasted build/test output, blank line,
  verdict.

Manager names the briefs when dispatching. Absent any named brief, Reviewer
behaves exactly as it does today — this change is backward-compatible with
every existing dispatch.

Adding a brief later is a list entry, not a redesign. The outstanding
integration-review brief slots into this mechanism unchanged and is
deliberately **not** built here.

### Brief: `security`

Fires on the seven triggers already written into the user's own standing rules:
authentication or authorization, user input handling, database queries,
filesystem operations, external API calls, cryptographic operations, and
payment or financial code.

Reviewer applies the brief when the changed files touch any of those, **whether
or not Manager named it** — a security hole does not become acceptable because
nobody asked. Manager naming it makes the review explicit; Reviewer noticing is
the safety net.

### Brief: `tests`

Judges whether tests exist for changed behaviour and whether they would fail if
the behaviour broke. Explicitly includes the case this project just produced:
an invariant documented in a comment with no assertion behind it.

## The `synapse-architect` agent

**Phase:** before `synapse-planner`. **Input:** a problem or a choice. **Output:** a
decision record at a path, plus a short abstract.

It mirrors `synapse-planner`'s context discipline exactly — writes to a file, returns a
path and an abstract of ten lines or fewer, never pastes the body into
Manager's context. That discipline is what lets a Manager session run many
tasks before needing a handoff, and it is not weakened here.

Four obligations, each derived from a practice this project already follows:

1. **Survey prior art before proposing.** Established solutions get named and
   linked. Derived from the seams spec's own *Prior art* section, and from the
   session that produced it: the honest answer to "am I reinventing something?"
   was largely yes.
2. **Record rejected alternatives with reasons.** Every spec here carries a
   *Tried & Rejected* section, and it is what stops decisions being
   re-litigated.
3. **State the trigger that would reverse the decision.** From OVERVIEW's
   *Further out* rule: an item with no trigger is a wish, not a plan.
4. **Never plan the implementation.** That is `synapse-planner`'s job, and the two
   agents must not both hold it.

### When Manager dispatches it

**Only when the task presents a real choice between structurally different
approaches.** Not for tasks with one obvious implementation — that is
over-dispatch, it costs a full Opus turn, and it inserts a decision record into
a project that did not need one.

The concrete trigger: Manager can name two or more approaches that would
produce materially different code, and cannot tell which is right without
reading the codebase — which it must not do.

If a task does not meet that bar, dispatch `synapse-planner` directly, as today.

## What is deliberately not being done

- **No `tdd-guide` agent.** Its job splits cleanly across `synapse-planner`, `synapse-coder`
  and a reviewer brief, and none of the pieces need an agent.
- **No `security-reviewer` agent.** Same reasoning, plus the precedent.
- **No `doc-updater`, `build-error-resolver`, `e2e-runner` or
  `refactor-cleaner`.** Manager's stewardship stage already dispatches `synapse-coder`
  to update stale trackers; build failures already route back through
  `REJECTED(implementation)`. These are covered, not missing.
- **The integration-review brief.** Decided in Handoff #2, still outstanding,
  and explicitly deferred to its own session at the user's request. The
  mechanism built here is what it will use.
  *(Built since — `synapse-reviewer.md` implements `integration`, and `synapse-manager.md`'s
  integration path dispatches it. The statement above is left as written
  because it was true when this design was approved.)*

## Roster effect

Manager's dispatch list goes from five to six: `synapse-planner`, `synapse-coder`, `synapse-reviewer`,
`synapse-art-director`, `synapse-artist`, `synapse-architect`.

§17 of the orchestration spec puts the field's convergent shape at one lead
plus three to five specialists, so six is one above that range. This is
accepted for a specific reason: the documented failure mode behind that number
is **orchestrator context overflow**, and the cost of a name Manager rarely
dispatches is close to zero. What that failure mode actually punishes is
ingesting work, and Manager reads only summaries. The number to watch is how
much Manager reads, not how many agents it can name.

## Success criteria

1. `agents/synapse-architect.md` exists, is deployed, and declares no write access
   outside its decisions directory.
2. Reviewer's existing dispatches behave identically when no brief is named.
3. Reviewer applies the security brief on the seven triggers even when
   unnamed.
4. `synapse-planner` orders test steps before implementation steps for behaviour
   changes; `synapse-coder` is obliged to honour that ordering and forbidden from
   weakening tests to pass.
5. Manager dispatches `synapse-architect` only against the two-approaches bar, and
   `docs/OVERVIEW.md` and `README.md` describe the six-agent roster.
6. No existing agent's output contract changes.

## Verification

Synapse has no build or test suite covering agent definitions — they are
markdown consumed by Claude Code. Verification is therefore:

```bash
node --test scripts/hot-files.test.mjs          # unrelated, must stay 14/14
.\scripts\deploy-agents.ps1 -Check              # no drift after deploy
```

plus reading each changed agent against the success criteria above. The real
test is a live dispatch, which requires a session restart — agent definitions
load at session start.
