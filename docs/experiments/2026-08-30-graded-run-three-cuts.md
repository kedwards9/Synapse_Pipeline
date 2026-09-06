# Graded run — the three cuts, task 21

**Status: PRE-REGISTERED. Written and committed while the run was in flight,
before any result was known.** That is the point of it. A record written after
the evidence arrives can be shaped to fit the evidence, and this line is here so
a later reader can check the commit timestamp against the run.

**The subject:** task 21, the handoff line, dispatched through a fresh
`synapse-manager` on 2026-08-30 with the declaration
`The record is the plan: watcher/docs/2026-08-29-watcher-card-back.md`.

**What is on trial:** the three cuts in
`specs/2026-08-30-pipeline-burn-three-cuts.md`, plus every other pipeline change
made on 2026-08-30 — the `CONTEXT.md` map and its marker, the drift rules, the
stewardship map check, the disagreement relay, and the research gate. None of
them had ever executed when this run started.

---

## 1. Karl's hypothesis, stated in his words

> *"I think we are slightly lowering accuracy/efficiency for less token burn."*

**This is the thing being tested, and it is not a rhetorical worry.** Every one
of the cuts trades something:

| Cut | What it buys | What it may cost |
|---|---|---|
| `dot` reporter | ~75× fewer bytes per suite run | Coder can no longer see *which* tests ran — only that none failed. It cannot confirm its own new test executed. |
| Skip Planner on a record | One of five cold agents | A numbered plan is a thinking artifact. A record's sections are weaker task boundaries, and the explicit test-before-implementation ordering is gone. |
| Batch bookkeeping | Two cold dispatches | One agent doing three unrelated bookkeeping items may do each less carefully than three focused dispatches would. |
| The `CONTEXT.md` map | ~2.5× on orientation | Agents trust a summary instead of reading code. A subtly wrong entry misdirects confidently. |

**A cheaper run that is also a worse run is a bad trade, and this experiment is
designed to be able to say so.**

---

## 2. The baseline, and why it is a fair one

**Tasks 19 and 20**, built 2026-08-30 by a warm brainstorm session working
directly from the same record, `watcher/docs/2026-08-29-watcher-card-back.md`.

| | Task 19 | Task 20 |
|---|---|---|
| Commit | `e70826c` | `76047e6` |
| Route | Direct, warm session | Direct, warm session |
| Plan | None. Built from the record. | None. Built from the record. |
| Suites after | 765 pass | 786 pass |

**Quality measurement on the baseline:** a batched `/code-review` at `high`
effort over both tasks returned **seven findings, one HIGH** — a self-removing
ratchet that had failed to fire because it matched `field\s*:` and the new
assignments were ES shorthand carrying no colon. Fixed in `17b0e40`.

**Why the comparison is fair:** same record, same author-tier work, adjacent
tasks, same day, same test suite. **Why it is not perfectly fair, stated
plainly:** the warm session had already read the record and the surrounding code
before starting either task, and had just been corrected by a review before
task 20. Task 21 starts cold. That asymmetry is the whole subject and must not
be quietly reported as a confound.

---

## 3. Predictions, recorded before the result

Each is falsifiable and each names what would kill it.

**P1 — Planner will not run.** Cut 2's second trigger fires on the declaration
now in task 21's queue entry.
*Falsified if:* Planner runs. The reason then matters more than the fact —
whether Manager did not match the declaration, or matched it and dispatched
anyway.

**P2 — Coder will not return `NEEDS_PLAN`.** The record specifies file
selection, the tie-break, the parse targets, the `--since` derivation and all
three values of `handoff`.
*Falsified if:* it does. That is not a failure of the design — it is the
backstop working — but it means the refusal wording is tuned too cautiously and
needs softening.

**P3 — The `handoff` ratchet will fire, and Coder will resolve it correctly.**
`NOT_YET_COLLECTED_FIELDS` contains only `handoff`. Filling the field without
removing it from that list fails `contracts.test.mjs`. A note left in that file
on 2026-08-30 tells whoever lands task 21 that the guard has been wrong once.
*This is the sharpest test in the run:* it measures whether the pipeline reads a
warning left in the code specifically for it.
*Falsified if:* Coder hits the failure and flails, or removes the field without
understanding why, or edits the test instead of the list.

**P4 — Decision 3's three values will survive.** `handoff` is `null` (not
collected), `false` (looked, absent), or an object. The queue entry fences this
explicitly because collapsing `false` into `null` would be the fifth
absence-collapse in that file in a week.
*Falsified if:* the implementation has two states.

**P5 — Stewardship will make one Coder dispatch for bookkeeping, not two or
three.**
*Falsified if:* more than one, or zero when there was bookkeeping to do.

**P6 — The run will cost more than tasks 19 and 20 did.** Cold contexts are
paid per agent. The question is not whether it costs more, it is *how much*
more, and whether the difference is smaller than the ~70,893 tokens one task
cost before any of today's work.
*Falsified if:* it costs the same or less, which would be a stronger result than
anything predicted here and should be treated with suspicion until checked.

---

## 4. The second test — the one that measures accuracy, not cost

**Token burn is the easy half. Karl's hypothesis is about quality, and quality
needs its own measurement.**

**Run the same review on task 21's output that was run on 19 and 20:**
`/code-review` at `high` effort, over task 21's commits alone, after the
pipeline has approved and merged them.

**Why this is a real comparison and not a vibe:** it is the same instrument, at
the same effort level, over work from the same record, on the same suite. The
baseline returned seven findings including one HIGH on work the author believed
was clean and that had passed 786 tests.

**How to read the result:**

- **Materially fewer findings than the baseline** → the pipeline's Reviewer
  earned its cost. Independence caught things before they landed.
- **About the same** → the pipeline's Reviewer is no better than a batched
  `/code-review` run afterward, and its cost buys process rather than quality.
  This is the outcome that would most change how the pipeline is used.
- **More findings** → the cuts hurt. Most likely suspects, in order: no Planner
  (P1 fired but should not have), or `dot` hiding something Coder needed to see.

**Do not adjust this reading after seeing the number.** It is written down here
first for that reason.

---

## 5. Where the evidence comes from

- **Token cost:** Manager's own status line, screenshotted before the session
  closes. This is where the 70,893 figure for a pre-cuts task came from.
- **Behaviour:** `node scripts/investigation-window.mjs` over the run's window —
  it reconstructs a chronological transcript of actions and statements, which is
  what P1 through P5 are actually asking about.
- **What landed:** `git log` and the diff on the worktree branch.
- **Quality:** the `/code-review` described in §4.

**OpenTelemetry was considered and not used for this run.** It reports cost, and
five of the six predictions are behavioural. The boundary hook log — 6.2MB and
recording — plus `investigation-window.mjs` already cover the behavioural half,
and setting up a collector was not worth delaying the run. It remains worth
doing as a durable habit, separately.

---

## 6. Results

Run completed 2026-08-30. Predictions above are **unedited**.

Branch `worktree-swirling-dazzling-stallman`, three `[manager]` commits:
`6ad2a08` (the work), `235be0f` (queue marked landed), `bb9e9c4` (docstring
correction). 604 insertions across 10 files, including a new
`watcher/src/main/handoff.mjs` and its tests.

**Suites: 790 → 813 pass, 0 fail**, verified independently by running
`test:verbose` inside the worktree rather than trusting the report.

### Scorecard — 6 of 6 confirmed

| | Prediction | Outcome | Evidence |
|---|---|---|---|
| **P1** | Planner will not run | ✅ | No `subagent_type":"synapse-planner"` in the transcript; no new file in `plans/`. **Cut 2 fired.** |
| **P2** | Coder will not return `NEEDS_PLAN` | ✅ | The token appears 3× in the transcript: twice in Manager's dispatch prompt, once in Manager's summary saying Coder *"returned without needing the `NEEDS_PLAN` backstop."* |
| **P3** | Ratchet fires, resolved correctly | ✅ | `NOT_YET_COLLECTED_FIELDS` is now `Object.freeze([])`. The field was removed from the list; `contracts.test.mjs` was not weakened. |
| **P4** | Decision 3's three values survive | ✅ | `if (winner === null) return false // looked, and there is no handoff log here` |
| **P5** | One bookkeeping dispatch | ✅ | Exactly two Coder dispatches: *"Implement handoff fill task 21"* and *"Task-close bookkeeping for task 21."* **Cut 3 fired.** |
| **P6** | Costs more than 19/20 | ✅ (weakly) | See below — the meters are too coarse to say much. |

**Dispatch census:** 2 × `synapse-coder`, 1 × `synapse-reviewer`, **0 Planner, 0
Architect.** Four agent invocations where the pre-cuts shape would have been
five or six.

### Not predicted, and it worked

**The map maintenance loop ran unprompted and landed correctly.** Task 21 added
a new module, and `CONTEXT.md` gained exactly one row:

    | `handoff.mjs` | Pure parse/select/format functions for `*HANDOFF.md`, for the card back's `handoff` field. |

Correctly placed among its siblings and accurately described. This is the first
execution of the whole chain — Coder's drift rule, the stewardship diff check,
`context-audit.mjs` as backstop — and no part of it had ever run before.

### P6 — cost, with the measurement's limits stated

| Meter | Before | After | Delta |
|---|---|---|---|
| 5-hour window | 18% | 23% | **5%** |
| Weekly (Max 5x) | 54% | 55% | **~1%** |

From Manager's own transcript: 37 assistant turns, **30,278 output**, 172,528
cache write, 1,801,861 cache read — about **203k** excluding cache reads.

**Three limits on that number, stated rather than buried:**

1. **It is Manager's session only.** The two Coder dispatches and the Reviewer
   dispatch were not separately recorded in that project directory, so the
   whole-run total is not measurable this way. The percentage meters are the
   only reliable total.
2. **The 5% and 1% both include this brainstorm session's own work** in the same
   window — writing this document, the commits, the queries. Small, but not zero.
3. **The 70,893 figure quoted in the earlier spec is not comparable.** That was
   a *context window* reading off a status line, not cumulative spend. Any
   comparison against it is apples to oranges and should not be made.

**So P6 is confirmed only weakly.** The honest statement is that one task
through the pipeline cost roughly what tasks 19 and 20 plus a code review plus
seven review fixes cost directly — which is a real result, but at 1% resolution
on the meter that matters, it is a rough one.

### The result that should be treated with suspicion

**Six of six predictions confirmed is not obviously good news.** A prediction
set that never fails is usually a set that was too easy, not a system that is
perfect. P1, P2, P4 and P5 were all things the design had just been written to
produce, and predicting that a mechanism does what it was built to do is a weak
test.

**P3 is the exception and the one worth keeping.** The ratchet was armed
independently, the note in `contracts.mjs` was left for a reader who did not
exist yet, and Coder resolved it the correct way rather than editing the test to
pass. That one measured something the design did not guarantee.

### Still untested: the whole of Karl's hypothesis

**Everything above is about cost and mechanism. None of it tests accuracy.**
Karl's stated concern — *"we are slightly lowering accuracy/efficiency for less
token burn"* — is measured by §4's review and by nothing here. Approval by the
pipeline's own Reviewer is not evidence: the baseline work was also approved, by
its author, and a later `/code-review` found seven issues in it including a HIGH.

**§4 is not optional and this run is not concluded without it.**

---

## 7. The accuracy test — §4's review, run

`/code-review` at `high` over `6ad2a08^..bb9e9c4`, the same instrument at the
same effort that produced the seven-finding baseline on tasks 19 and 20.

### The headline

**Two instruments, ~14 distinct findings between them, and only 2 overlap.**

| | Pipeline Reviewer | Independent `/code-review` |
|---|---|---|
| Findings | ~10, all marked non-blocking | 6 — two MEDIUM, four LOW |
| Verdict | `APPROVED` | n/a |
| Character | Record, docstring and backlog coherence | Runtime correctness |

**Overlapping — both found these:** the case-sensitive `HANDOFF_FILE_SUFFIX`,
and `commitsSinceArgs` counting a full `%H` list with no `-n` bound. Both graded
them low.

### What Reviewer missed, and it is the part that matters

**Two MEDIUM behavioural defects in code Reviewer approved:**

1. **Open-questions bleed across entries.** `parseHandoffEntry` bounds the
   *bullet* loop to the next heading but not the *search* for the
   `### Open Questions` heading, so it scans past the topmost entry into older
   ones. Verified against the branch's own code: a handoff #9 with no open
   questions, sitting above a #8 with three, returns `{number: 9, open: 3}`.
   **The card attributes another entry's questions to the newest one.**

2. **`TOP_LEVEL_BULLET = /^- /` counts hyphens only.** An Open Questions section
   using `1.` or `*` renders `0 open` — a plausible number the user can glance
   at, believe and act on, and unlike `null` it draws no marker to warn.

Plus two LOW ones Reviewer did not reach: an unparseable newest candidate
poisoning the whole section to `null` (Decision 3's conflation, in the other
direction), and a `## Handoff #99` inside a fenced code block winning the parse.

### What `/code-review` missed

Roughly eight of Reviewer's findings have no counterpart: Decision 1's record
disagreeing with the code, the stale `handoffText` docstring, `BACKLOG.md`'s
stale `activity` claim, `verify-install` failing 9 of 21 under a CRLF worktree
checkout, and the vacuous-guard observation.

**Neither instrument is a superset of the other.** That is the finding.

### Does this confirm Karl's hypothesis?

**Partly, and the honest answer is smaller than the evidence looks.**

**Confirmed:** the pipeline approved work containing two MEDIUM behavioural
defects that an independent review found in the same code, one of them verified
by execution. `APPROVED` is not equivalent to reviewed.

**Not established: that the cuts caused it.** Cut 1 (`dot`) and cut 3
(batching) are irrelevant to every finding above. **Only cut 2 is plausibly
implicated** — a Planner might have specified how to handle numbered lists, and
the record did not. That is speculation, not measurement, and it is recorded as
such.

**The alternative explanation, which is at least as likely:** Reviewer and
`/code-review` simply have different strengths, and always did. Reviewer read
the record, the docstrings and the backlog for coherence — work `/code-review`
never attempted. There is no baseline for "Reviewer with a Planner upstream" to
compare against.

### Latency of the second defect, checked

`MANAGERHANDOFF.md` is currently the most recently modified `*HANDOFF.md` and is
therefore what the card would select. Both it and `BRAINSTORMHANDOFF.md` use
hyphen bullets exclusively (46 and 20), so **defect 2 does not fire on this
repository today.** It is latent, not live.

`/code-review` reported that `HANDOFF.md` itself uses numbered open questions,
which would make it live the moment a code-work session touches that file last.
**That claim is unverified here** — this was a brainstorming session, and
`HANDOFF.md` is off limits to it in both directions. It is one `grep` for
whoever is next in a code session.

### What this changes

**Run both.** The cost argument was always "does the pipeline's Reviewer earn
five cold contexts." This run says the question is malformed: a batched
`/code-review` after the pipeline is not redundant with Reviewer, it is
orthogonal, and 12 of 14 findings appeared in exactly one of the two.

---

## 8. Where this was written up for outside readers

**`docs/writing/2026-08-30-approved-is-not-reviewed.md`**, and a published copy
at <artifact-url-removed>

That version explains the pipeline from scratch and names nothing internal
without defining it. **This file is the evidence; that one is the account.**
Keep them in step — a divergence is the same class of defect as a stale map,
and no script catches it.
