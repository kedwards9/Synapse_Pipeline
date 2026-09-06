# Implementation plan — pipeline specialists

**Spec:** `specs/2026-08-24-pipeline-specialists-design.md`
**Goal:** Add the `architect` agent; add `security` and `tests` briefs to
`reviewer`; make test-first an obligation on `planner` and `coder`; teach
`manager` to dispatch `architect`.

**Scope:** `agents/` and the two docs that describe the roster. No script
changes. `scripts/hot-files.test.mjs` must stay at 14/14 throughout — if it
moves, something unrelated broke.

**Ordering rationale:** new file first, then the agent whose contract is most
delicate (`reviewer`), then the two small obligations, then `manager` last
because it references everything above. Docs after the agents so they describe
what exists rather than what is intended.

---

## Pre-flight

```bash
cd <synapse> && git status --short && node --test scripts/hot-files.test.mjs 2>&1 | grep -E "^. (tests|pass|fail)"
```

Expected: clean tree, 14 pass / 0 fail.

---

## Task 1 — Create `agents/architect.md`

**Files:** create `agents/architect.md`.

- [ ] **Step 1: Frontmatter.** `name: architect`. Description must state it is
      dispatched by Manager and not for standalone use, matching the wording
      pattern in `planner.md` and `reviewer.md`. Tools: `Read, Grep, Glob,
      Write, Agent(Explore)` — identical to `planner`, because it does the same
      kind of investigation and needs the same fan-out. `model: claude-opus-5`,
      `effort: high`.
- [ ] **Step 2: The write constraint.** Same shape as planner's step 2: the
      `Write` grant exists for exactly one purpose, and writing anything
      outside the decisions directory is a signal it is doing another agent's
      job.
- [ ] **Step 3: Output contract.** Writes to
      `docs/superpowers/decisions/YYYY-MM-DD-<slug>.md`, follows an existing
      project convention if one is evident, returns path + abstract of ten
      lines or fewer, never pastes the body.
- [ ] **Step 4: The four obligations** from the spec — survey prior art, record
      rejected alternatives, state the reversing trigger, never plan the
      implementation.
- [ ] **Step 5: The decision-record format** — a concrete template so output is
      consistent across projects.
- [ ] **Step 6: Exploration fan-out + Delegation Completion Contract.** Copy
      planner's, unchanged. Same limits (4 agents, one wave, second wave only
      on a genuine unknown). These are load-bearing and must not drift between
      the two agents that have `Agent(Explore)`.
- [ ] **Step 7: Bare-dispatch guard**, matching planner's closing paragraph.

**Verify:** file exists, frontmatter parses, no `Write` path other than the
decisions directory is mentioned as permitted.

---

## Task 2 — Add briefs to `agents/reviewer.md`

**Files:** modify `agents/reviewer.md`.

**The contract must not change.** Three verdicts, same final-message format,
same mandatory build/test run. Briefs add scope only.

- [ ] **Step 1: Add a Briefs section** after the verdict-selection rules and
      before the build/test rules. State that the default implementation review
      always runs, that briefs never replace it, and that brief findings map
      onto the existing verdicts — unsafe code or a shallow test is
      `REJECTED(implementation)`; a plan that mandated it or never asked for
      tests is `REJECTED(plan)`.
- [ ] **Step 2: The `security` brief.** List the seven triggers. State that
      Reviewer applies it whenever changed files touch one, named or not.
- [ ] **Step 3: The `tests` brief.** Tests exist for changed behaviour; tests
      would fail if the behaviour broke; a documented invariant with no
      assertion is a finding.
- [ ] **Step 4: Backward compatibility sentence.** With no brief named,
      behaviour is exactly as before.
- [ ] **Step 5: Update the frontmatter description** to mention briefs.

**Verify:** the three verdict lines, the "no preamble, no commentary" rule, and
the toolchain-discovery list are all still present and unedited.

---

## Task 3 — Test-first obligation in `agents/planner.md`

**Files:** modify `agents/planner.md`.

- [ ] **Step 1:** Add a short numbered item to the plan-writing rules: for any
      step that changes behaviour, the test step comes before the
      implementation step, and the plan says what the test asserts.
- [ ] **Step 2:** Add the honest caveat — where a project has no test
      infrastructure at all, say so in the plan rather than inventing a
      framework.

Keep it to a few lines. Planner is already long and this is one rule.

**Verify:** the Exploration fan-out and Delegation Completion Contract sections
are untouched.

---

## Task 4 — Test obligations in `agents/coder.md`

**Files:** modify `agents/coder.md`.

- [ ] **Step 1:** When the plan orders a test step before an implementation
      step, honour that order rather than batching tests at the end.
- [ ] **Step 2:** Never weaken, skip, or delete an existing test to make a
      change pass. If a test genuinely encodes obsolete behaviour, say so in
      the summary and let Reviewer judge it — do not decide it alone.

Step 2 matters more than step 1: it is the failure a reviewer might not catch,
because a deleted test leaves no trace in a passing suite.

**Verify:** coder is 26 lines today; it should stay short.

---

## Task 5 — Teach `agents/manager.md` to dispatch `architect`

**Files:** modify `agents/manager.md`.

- [ ] **Step 1:** Add `architect` to the `Agent(...)` grant in frontmatter.
- [ ] **Step 2:** Add a **step 0** to the Code path: does this need an
      architectural decision? Gate it on the two-approaches bar from the spec —
      Manager can name two or more approaches producing materially different
      code and cannot choose without reading code it must not read.
- [ ] **Step 3:** State what Manager does with the returned path — passes it to
      `planner` as input, exactly as it passes a plan path to `coder`.
- [ ] **Step 4:** State the over-dispatch warning explicitly. Most tasks do not
      need this.
- [ ] **Step 5:** Add brief-naming to the reviewer dispatch step — name
      `security` when the task touches one of the seven triggers, name `tests`
      when the task changes behaviour.

**Verify:** the stewardship stage and the rejection-routing rules are untouched.

---

## Task 6 — Deploy and update docs

- [ ] **Step 1:** `.\scripts\deploy-agents.ps1`, then a drift check.
- [ ] **Step 2:** `docs/OVERVIEW.md` — the roster is now seven agents in three
      paths (decision, code, art). Update *The studio*, and add the decision to
      *What is settled*.
- [ ] **Step 3:** `README.md` — update any agent count or roster list.
- [ ] **Step 4:** Re-run the detector tests; still 14/14.

---

## Acceptance criteria

1. Seven agent files in `agents/`, all deployed with no drift.
2. Reviewer's three verdicts, final-message format and toolchain discovery are
   byte-for-byte intact.
3. No agent gained write access it did not have.
4. `node --test scripts/hot-files.test.mjs` — 14 pass, 0 fail.
5. `docs/OVERVIEW.md` and `README.md` describe seven agents, not six.
6. A reviewer dispatch naming no brief reads exactly as it did before.

## Known limitation, stated up front

None of this is executable. Agent definitions are markdown consumed by Claude
Code at session start, so the only real test is a live dispatch after a
restart. Everything above is verified by reading, and that is the ceiling.
