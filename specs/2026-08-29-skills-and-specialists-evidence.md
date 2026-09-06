# Do we need more skills, or more specialised agents?

**Evidence review, 2026-08-29.** Window: **2026-08-24 → 2026-08-29**, five days.

Two questions, asked separately and answered from the same corpus:

1. **Skills** — is there a repeated pattern that would make a good skill?
2. **Specialised agents** — is there a demonstrated, repeated use case for an
   agent that does not exist yet?

Both were investigated read-only by dispatched agents under a strict evidence
bar: **three distinct cited occurrences in the window, plus evidence the thing
went wrong at least once.** No claim without a locator. "No candidate" was
declared a valid answer up front, so that a nil result would not be padded.

**Direct predecessor:** `specs/2026-08-24-pipeline-specialists-design.md`, which
records why Synapse deliberately did *not* build ECC-style specialist agents.
This document is the five-days-later evidence check on that decision.

---

## Part 1 — Skills

### The finding that reframes the question

Before any candidate: **across all 40 Synapse transcripts, the Skill tool was
invoked 20 times in total.**

| Skill | Invocations |
|---|---|
| `superpowers:brainstorming` | 8 |
| `takehandoff` | 5 |
| `artifact-design` | 4 |
| `devil` | 2 |
| `superpowers:writing-plans` | 1 |

**`surfacing-assumptions`, `verifying-assumptions`, `systematic-debugging`,
`verification-before-completion` and `test-driven-development` fired zero
times** — despite appearing in the available-skills reminder at all 56 session
starts.

**The evidence-discipline library already installed is inert.** That is the
single most important input to this question, because it means *authoring a new
skill is the mechanism least likely to change anything.* Any proposal has to
answer why it would fire when five near-identical skills did not.

There is one honest mitigation. `surfacing-assumptions` triggers *before writing
or editing code*, and this five-day window was almost entirely spec-writing,
queue-editing and dispatching — **not code editing**. So its trigger genuinely
did not match. That is the only real opening for a new skill, and it is
simultaneously the reason to doubt a new one would fire either.

---

### Candidate A — `constructing-a-fixture-for-an-unreachable-state`

**The one genuine skill candidate.**

**Trigger:** *Before recording anything as blocked, unverifiable, or "the live
system cannot produce this state" — ask whether a purpose-built fixture reaches
it in minutes.*

**Occurrences:**

1. `docs/REVIEW-QUEUE.md:519-525` — R23 written up as **`BLOCKED 2026-08-28 —
   nothing on the board can turn it on`**, with a fully measured justification:
   the two real repos sit at ahead 5 and ahead 2, `DEFAULT_AHEAD_THRESHOLD` is
   20, no unmerged files. **The measurement was right and the conclusion was
   wrong.**
2. Commit `c8e4744` — *"three verify items were unreachable on the live board —
   say so, and why."* Three items recorded blocked in a single pass.
3. Commit `25deb0d` — *"R22 and R23 pass — unblocked by building a fixture, not
   by waiting."* Body, verbatim: *"Both asked about states the live board could
   not produce, and both were recorded as blocked. One scratch repository
   resolved both… Two of today's blocked items were not blocked by the code at
   all, only by the data on the board, and a fixture costs minutes."*
4. `watcher/docs/DISPATCH-QUEUE.md`, task 13 — *"The fixture needs no network.
   `git init`, `git remote add`, set `branch.<name>.remote` and `.merge`, do not
   fetch."* The judgement about what the fixture must **not** touch is the
   deliverable.
5. Same pattern again at `757eac8`, `c6521cf`, `05d3948`, `94414bf`, and
   `e77a0c5` (R30 passing on *"the branch nothing automated reached"*).

**Evidence it went wrong:** items 1–3 are the same items — recorded as
permanently blocked, then unblocked minutes later by a technique nobody reached
for first. And building fixtures is not risk-free: `2d774ea`, *"correct three
defects run 1 found in the architect key"* — the fixture shipped with three
defects in its own answer key.

**Why a skill rather than the three cheaper mechanisms:**

- **Not a script.** Choosing the minimal repo state that produces "unmerged ≥1
  *and* a non-amber count beside it, on one card, in one glance" is judgement,
  and it differs per item.
- **Not a `CLAUDE.md` rule.** The invariant half is *already written* at
  `REVIEW-QUEUE.md:82-86` and did not prevent recurrence. What is missing is the
  **procedure**: identify the state, find the minimal producer, check whether it
  needs network or credentials, then verify the fixture itself.
- **Not a slash command.** This is the clean case for the *recognises-it-without-
  being-told* discriminator. It cannot be invoked, because the failure is that
  nobody realises a fixture is possible — the word "blocked" is already written
  and the session has moved on.

**What nearly covers it:** `superpowers:systematic-debugging` Phase 1 step 2
("Reproduce Consistently") — but that is scoped to *a bug already observed*.
These were verification questions about states that had never occurred, and
fixtures built to exercise agents. Different entry point.
`test-driven-development` covers writing tests, not constructing an environment
for **human** verification.

**Honest weakness:** the inertness finding above applies here too. The strongest
form of this is probably **a short skill plus a one-line `CLAUDE.md` rule
pointing at it** — the rule is what actually loads every session.

---

### Candidate B — the dispatch-queue state audit → **this should be a script**

**Strongest evidence in the entire window, and it is not a skill.**

**Occurrences,** all 2026-08-28, all against `watcher/docs/DISPATCH-QUEUE.md`:

1. `6ab4a5b` — *"the queue said nothing was in flight while task 11 was
   running."* Body: *"Karl caught it… **This is the second time today** a status
   line in this file went stale while being read as current."*
2. `9583283` — *"task 11 landed — and my in-flight note was stale when I wrote
   it."* Body: *"The status line in this file has now been wrong **in all three
   possible ways in a single day**."*
3. `2663e9d` — *"tasks 12 and 13 had no dispatch prompts, and 11 was out of
   order."* Body: *"Three problems, found by **auditing the file mechanically
   rather than reading it**."*
4. `b980b7d` — *"correct four stale claims in the dispatch queue,"* one of them
   written earlier the same day.
5. Recurring resync commits: `930a3c6`, `a2c4d3d`, `b8e2562`, `2ee2160`.
6. A standing warning now lives in the file itself at `DISPATCH-QUEUE.md:107-115`.

**Why a script.** `9583283` names the exact procedural bug: *"I checked
`<my-last-commit>..HEAD`, which is empty whenever the other session's commit is
OLDER than mine."* Every check that failed is deterministic:

- **Landed tasks** — a `git log` over `Session:` trailers from a session-start
  baseline.
- **In flight** — untracked plan files.
- **Every table row has a prompt section, in numeric order** — pure parsing.
- **Run order matches prompt-section order** — a diff of two lists.

There is no judgement anywhere in that list.

**Precedent already accepted inside Synapse.** `scripts/commit-task.mjs:14-16`:
*"This script decides nothing about timing. It exists so the mechanical half
stops being re-derived by a model on every invocation."* Same argument, already
won once. `scripts/` holds eight tested scripts; a ninth — `queue-audit.mjs` —
fits the established shape exactly. `CLAUDE.md` already says **"Audit
mechanically, not by reading"** for agent definitions; this extends the same rule
to the queue.

**What nearly covers it:** nothing. `commit-task.mjs` writes commits, it does not
read the queue. No existing skill or command touches this file.

**Corroborated independently on 2026-08-29:** the artifact rendering of this
queue was found to be missing dispatch prompts 9–13 entirely — including task
12, the next one to send — plus queue cards for 9 and 10. Found by mechanical
comparison against the markdown, not by reading. That is a seventh occurrence,
and it landed *after* the standing warning was added to the file.

---

### Candidate C — "check the condition before writing the claim" → **a `CLAUDE.md` rule**

The most frequent failure family in the window: **prose asserting something
about the system, written without checking the system.**

**Occurrences:**

1. `docs/FINDINGS.md:157-165` — *"the dial had five states and the application
   has no clock."* A queued task was priced as a rendering job; `Date.now`,
   `mtime` and `timestamp` appeared nowhere in `src/main/*.mjs`. *"The task was
   not priced wrong by a little; it was the wrong kind of task."*
2. `docs/FINDINGS.md:168-177` — *"the boundary log has no completion events."* A
   spec clause had never had an input. Also: *"not weeks — **30.3 hours**, which
   I only checked because the state count had just caught me out the same way."*
3. `docs/FINDINGS.md:179-189` — *"the disproof was in the user's own settings
   file."* *"I had read the comment and not the configuration it described."*
4. `docs/REVIEW-QUEUE.md:383-392` — R1, R22 and R23 *"were each drafted from the
   code… without checking whether the board could produce the state at all."*
   Plus R14–R20 withdrawn wholesale (`fd86ae9`): seven verify items about
   features the codebase does not contain.
5. `docs/LESSONS.md:744-786` — *"An inherited diagnosis survived three sessions
   without being tested."*
6. The documentation-side mirror, ~13 commits: `b887f3f`, `e190ca2`, `9ecdaab`,
   `b8e1f80`, `c0f7188`, `d5f5548`, `e90f6b5`, `e9d79ae`.
7. Karl, 2026-08-27T17:16Z: *"So if the tool doesn't exist, why is manager asking
   for that command?"*

**Why a rule and not a skill.** The invariant is already one sentence and already
written — `REVIEW-QUEUE.md:82-86`: *"an item must name the condition under which
the thing it asks about exists, and that condition must be checked before the
item is written."* It is buried in a Watcher-specific operational document where
nothing loads it. **Promote it verbatim to `CLAUDE.md`**, generalised from
"verify item" to *any claim about the system written into a spec, queue, comment
or docstring.*

**Why explicitly not a skill:** `superpowers:surfacing-assumptions` **is** this
skill, is installed, and fired zero times in 40 transcripts. Authoring a second
one with a broader trigger repeats an experiment that has already failed. A
`CLAUDE.md` line loads whether or not anything recognises anything.
`FINDINGS.md:129-133` reached this independently: *"the standing guard is the one
that fired: machine checks that do not get tired."*

---

### Rejected — and why

Kept so the next review does not re-find them.

| Pattern | Why rejected |
|---|---|
| **Doc/code lockstep as its own skill** | Real (13 commits) but it is the writing-direction half of Candidate C, and `superpowers:maintaining-project-context` already covers the shape. |
| **Writing a Manager dispatch prompt** | 13 prompts; went wrong twice (`2663e9d`, `FINDINGS.md:52`). Rejected because both failures were *reading* failures against instructions already in the file being edited — `2663e9d`: *"The instruction was sitting in the file I was reading from."* **A skill does not fix not-reading.** |
| **"Designs aimed a layer too high"** | `LESSONS.md:834-865`, three occurrences — but all in a **single session**, and the entry concludes no procedure would have caught them (*"all three chains of reasoning were sound"*). Fails the distinct-occurrence and tractability bars. |
| **Research runs dying mid-flight** | Three unfinished briefs. Already owned by `/research` and `/research-audit`; the orphaned-children cause is in `agents.md`'s completion contract and twice in `LESSONS.md`. |
| **Handoff writing** | High frequency, fully covered by `/session-hand-off`, `/takehandoff`, `/handoff-history`. Memory explicitly forbids model-invoked handoffs. |
| **Backslash collapse, artifact-force loop, session attribution, dead-grant audit** | All already in `CLAUDE.md`. Solved, not proposals. |
| **The measurement-regex disagreement** | `^test\(` vs `^\s*test\(` differing by five. One occurrence. Below the bar, though same family as C. |
| **`cd` prefixing 1,358 of 2,969 Bash calls** | Highest raw repetition found anywhere, but an environment/permissions artefact with no judgement in it. That is `fewer-permission-prompts` and an allowlist, not a skill. |

---

### What Part 1 could not check

- **`HANDOFF.md`** — off limits; this is a brainstorming session and that log is
  locked in both directions. It is the largest handoff log. A pattern living only
  there was invisible to this review.
- **Session narrative.** Transcripts were sampled by aggregate grep and by a
  ~750-prompt extraction via `scripts/prompt-record.mjs`, never read end to end. A
  recurring multi-step sequence leaving no trace in commits, curated docs or
  Karl's own prompts would not have been seen. `scripts/investigation-window.mjs`
  against two or three windows from `FINDINGS.md` would close this, at real
  context cost.
- **Days 08-24 → 08-27 at tool-call granularity.** See the instrumentation gap
  below.

---

### Incidental finding: two logs are not recording

Not part of either question, surfaced by trying to answer them.

- **`~/.claude/bash-commands.log` stopped on 2026-08-19**, at 272 entries. It has
  **zero entries inside the five-day window** and contributed nothing. It was
  expected to be the strongest signal for repeated procedure.

  > **The two investigations disagreed on this date and both were checked.** One
  > reported 2026-08-06, the other 2026-08-19. Measured directly: the file spans
  > `2026-08-06T17:27Z` → `2026-08-19T13:27Z`. The earlier figure was the
  > **first** entry read as the last. **Ten days dead, not three weeks** — which
  > matters, because 08-19 is close enough to the window to look alive at a
  > glance.
- **`~/.claude/synapse-orchestrator-boundary.jsonl` only covers
  2026-08-27T14:34Z → present** — two of the five days — and is `PreToolUse`-only
  (7,047 records).

`FINDINGS.md:168` already records the `PreToolUse`-only gap as a real defect. The
`bash-commands.log` stall is separate and, as far as this review can tell,
unrecorded. **Worth a look on its own account:** an instrument that silently
stopped **five days before this window opened** is exactly the class of thing
this project keeps finding the hard way.

---

## Part 2 — Specialised agents

### Verdict: no. The seven cover it.

**Nothing in the window clears the bar.** Every real gap resolves to one of the
four cheaper mechanisms — a `synapse-reviewer` brief, an edit to an existing
definition, a `general-purpose` dispatch, or a skill.

`specs/2026-08-24-pipeline-specialists-design.md` holds. Five days of heavy use
produced no evidence against its reasoning.

### What the telemetry actually shows

- **259 commits**, trailer census **122 `[brainstorm]` / 105 `[manager]` /
  32 untrailered** (all 32 predate the convention).
- **172 unique agent instances** in the boundary log: 38 `general-purpose`,
  37 `synapse-coder`, 33 `Explore`, 21 `synapse-planner`, 17 `synapse-reviewer`,
  12 `synapse-artist`, 8 `synapse-architect`, 3 `synapse-art-director`,
  3 `synapse-manager`.
- **Every human prompt in the window** extracted verbatim via
  `scripts/prompt-record.mjs` — a complete extraction of the human half of every
  transcript, not a sample.

  > **The exact count is not stable and should not be quoted as if it were.** The
  > two investigations reported 749 and 755; re-measured on 2026-08-29,
  > `prompt-record.mjs 2026-08-24 2026-08-30 --plain` returns **753**. Two causes,
  > both benign: the corpus **grows while the session runs**, so any figure is a
  > timestamp; and the 755 was two overlapping ranges summed across the 08-28
  > boundary. **Roughly 750, complete, not sampled** is the claim that survives —
  > the completeness is what the finding rests on, not the digits.

**`general-purpose` is the most-dispatched agent in the project**, ahead of
Coder. That is the shape of the answer: the gaps are being filled, cheaply, by
the built-in.

---

### 2.1 `synapse-researcher` — the only agent-*shaped* candidate, and it is below the bar

**Genuinely agent-shaped, because its whole value is a *withheld* tool grant.**
You cannot brief away a tool. `LESSONS.md:~255` already states the governing
rule: *"A rule that binds an agent must live in that agent's own definition."*

**Criterion 1 is met overwhelmingly.** 29 `general-purpose` instances on 08-28
and 8 on 08-29, the majority WebSearch/WebFetch-dominated — one ran **101**
`WebFetch` calls, another 93, another 86.

**Criterion 2 is met once, not three times.** Commit `f10aaf3`: *"Stopping four
agents left SEVEN child agents running and spending. They had to be found with
`ListAgents` and killed individually, which cost roughly ten percent of a usage
window after the decision to stop had already been made… one child's log
references an Agent E, so the nesting went at least three deep."* The boundary
log corroborates: 8 of ~29 research instances issued `Agent` calls, 20 nested
dispatches total.

**And the mitigation is working.** `docs/BACKLOG.md:~253` carries the standing
instruction — *"Say 'do not spawn sub-agents' in the prompt"* — and Handoff #5's
re-run folded it in by hand with a manual `ListAgents` post-check. It held. **A
mitigation succeeding is the argument against building the thing.**

| Cheaper alternative | Verdict |
|---|---|
| (a) `general-purpose` | **Not a killer here** — this *is* general-purpose, and its `*` grant is the defect. |
| (b) reviewer brief | Inapplicable. Reviewer reads code, not the web. |
| (c) edit a definition | Nothing to edit. Planner and Architect are capped at 4 `Explore` and are codebase-only. |
| (d) install an ECC agent | Checked all 68. `marketing-agent` is a copywriter persona; `docs-lookup` is Context7-only. No fit. |

**Recommendation: do not build it yet. One expensive failure, already mitigated,
is a one-off however painful.** *Trigger to revisit:* a second orphaned-children
incident, or a research round where the no-fan-out instruction is forgotten. At
that point it is ~15 lines and the case makes itself.

---

### 2.2 Visual verification — the biggest real gap, and still not an agent

**The structural hole is real and well-cited.**
`docs/experiments/2026-08-26-session-as-orchestrator.md`, sixth pipeline
finding: **"No agent in this pipeline has a display."** Tagged in the index as
*"One degree worse than the 18:06 gap: there one agent could do what another
could not, so routing could in principle close it; here no agent can."*

The cost is visible everywhere. The entire dispatch queue is **sorted by "what
can be proven without him at the keyboard."** `docs/BACKLOG.md` §3 freezes eight
items. Twelve `[brainstorm]` commits on 08-28 alone are hand-verification
bookkeeping. Transcript `e62e366e` records ~55 minutes of reading R-items aloud,
several unanswerable as written — *"I don't know what amber color you're talking
about because there are no colors added in."* And in `b179d3df`, a
hand-verification result was simply **wrong**, self-caught: *"I think I was
editing the wrong y coordinate."*

**It is still not an agent, for a reason that settles it:**

> **`general-purpose` has never once been tried.** A grep of the whole boundary
> log returns **zero** screenshot calls against the app, zero Playwright
> invocations, zero `npm start` launches by any agent. `general-purpose` holds
> `*` — Bash to launch Electron and capture the screen, `Read` to display the
> PNG. **The status quo did not handle this badly; the status quo never
> attempted it.** That alone fails criterion 2.

**The correct next move is a `visual` reviewer brief.** `synapse-reviewer`
already holds `Read, Grep, Glob, Bash` — exactly what a launch–capture–inspect
loop needs. The only blocker is one line of prose: *"Use Bash only for read-only
inspection… never to modify, create, or delete files."* A screenshot creates a
file. **That is a one-paragraph definition edit**, and the brief mechanism is
built and precedented three times over.

**ECC's two near-fits are both wrong here.** `e2e-runner` and `gan-evaluator`
would add Playwright to a project whose dependency posture is an *open decision*
— R4 in `REVIEW-QUEUE.md` is literally *"Packaging, distribution, and the end of
zero-dependency."* `gan-evaluator` also drags in a three-agent GAN loop that
conflicts with the pipeline. `e2e-runner` was rejected by name in the
2026-08-24 spec, and nothing here argues against that reasoning — it argues for a
**brief**, which is that spec's own preferred answer.

**And roughly half of what blocks is product judgement no agent can supply.**
R1 (severity ranking), R4, R5, R6, R28, *"does amber read at six feet"* — a
screenshot answers none of them.

---

### 2.3 Queue steward — best-evidenced repeated pain, and it is a skill

Recorded here so it is not lost between the two investigations: **this is
Part 1's Candidate B, found independently from the agent side.**

Ten-plus occurrences in two days — `b980b7d`, `537c96b`, `930a3c6`, `a2c4d3d`,
`b8e2562`, `2663e9d`, `6ab4a5b`, `9583283`, `6fc9a8f`, `e721d76`. The real cost,
in Karl's words at `08-28T20:40Z`: *"Well, I fucked up because I went with number
three before number six. I was going in order of dispatch queue, not the status
queue."* And `e721d76`: *"the two findings that would have caused real harm if
task 12 had been sent."*

**It was already solved with the cheapest tool available.** Two `general-purpose`
audits at `08-29T02:35Z` (37 and 41 Bash calls). `e721d76`: *"Both were found by
fresh-context agents reading the files, not by me re-reading them."* Handoff #4:
*"both earned their cost."*

**`general-purpose` plus a fresh context is the whole mechanism.** What is
missing is the repeatable *procedure* — which is a skill, or better a script.
Manager's stewardship step cannot cover it: **Manager is not running when a
brainstorm session edits the queue.**

---

### 2.4 ECC agents worth installing: none

All 68 descriptions checked, six definitions read in full.

`doc-updater`, `refactor-cleaner`, `build-error-resolver`, `tdd-guide` and
`security-reviewer` were rejected by name in the 2026-08-24 spec, and this window
produced nothing against that reasoning. `silent-failure-hunter`,
`pr-test-analyzer` and `type-design-analyzer` are **reviewer briefs wearing agent
costumes.** `harness-optimizer` holds `Edit` and would rewrite harness config — a
poor fit for a project whose own rule is that config changes need a traced source.

**Collision risk, if you ever do install any:** ECC ships `architect.md` and
`planner.md` at bare names. `deploy-agents.mjs` now refuses to overwrite what it
did not deploy, so the guard holds — but installing ECC's set would drop two
unprefixed `architect`/`planner` definitions into `~/.claude/agents/` beside the
`synapse-` seven. That is the exact hazard the 2026-08-26 rename (`a6b6014`)
exists to prevent. `e2e-runner` alone carries no name collision.

---

### 2.5 Rejected — and why

| Candidate | Why rejected |
|---|---|
| **Doc/tracker auditor** | Skill, not agent. `general-purpose` already does it successfully, twice, cited above. |
| **Design-record author for brainstorm sessions** | This is `synapse-architect`, which refuses standalone dispatch by design. Handoff #5's 854-line remote-source record came from a `general-purpose` agent and was good. Relaxing Architect's refusal breaks a standing rule; the status quo works. |
| **Public-contract-change detector** | Already filed in `docs/BACKLOG.md` §1 as **"[S] A Reviewer trigger for public-contract changes."** It is a Reviewer change and you already classified it as one. |
| **Verification-item author** | Real failure — 10 of 32 items unactionable on arrival, `fd86ae9` withdrew R14–R20. But the fix already shipped as a **rule** in `REVIEW-QUEUE.md`. Rules beat agents. |
| **Prose agent** | Karl raised it himself (`08-24T23:44Z`), then reframed it as *"a prose agent… or at least a prose brief?"* Settled against. |
| **Brainstorming agent** | Raised `08-25T01:18Z`, deferred same session, re-proposed and rejected later. |
| **Parallel-planner fan-out** | `LESSONS.md:~673` — withdrawn, not shipped: *"you keep the speedup and lose the coordination that justified it."* |
| **Agent-definition auditor** | One occurrence (`997445f`). `scripts/verify-install.mjs` plus the mechanical-audit rule in `CLAUDE.md` already cover it. |

---

### 2.6 The reserved question this report deliberately stops short of

> **CLOSED 2026-08-29, after this report was written — DECLINED.** Karl took the
> reserved question off the table the same day. The record is
> `specs/2026-08-29-brainstorm-pipeline-declined.md`, and it is a decline rather
> than a deferral: no pipeline, no gate, no backlog entry, and re-raising the
> asymmetry described below is not evidence.
>
> **One inference in this section does not survive, and it is named there.** The
> second reason given for the "no" verdict — *most of what looks like a missing
> agent is really the absence of that* — assumed the reserved thing might yet be
> built. It will not be, so it cannot absorb anything. **The verdict is
> unchanged**; its first reason (wrong layer) carries it alone, and is stronger
> for there being no layer to answer at.
>
> The rest of this section is left exactly as written, because it is the fairest
> statement of the asymmetry that prompted the idea, and the decline record cites
> it as such.

`BRAINSTORMHANDOFF.md` #4 records — and Karl confirmed at `08-29T02:36Z`, *"I am
starting to think I need to make a pipeline for you"* — a **pipeline or gate for
brainstorm sessions**, prompted by the observation that the Manager pipeline has
structural checks and a plain session has none. The handoff marks it *"explicitly
his and not to be designed or filed."*

**That is where the largest genuine structural gap in the five days sits.** It is
named here and stopped at.

It is also **the reason the answer above is "no."** Most of what looks like a
missing agent is really the absence of *that*, and building a seventh specialist
would be answering it at the wrong layer — the exact failure `LESSONS.md` records
as *"Three elaborate designs in one session, each coherent, each aimed a layer
too high."*

---

### What Part 2 could not check

- **`HANDOFF.md`** — not opened, per the brainstorm-session lock. It holds
  handoffs #1–#23 and is the largest continuity record in the repo. **Two
  rejected candidates above (prose agent, brainstorming agent) were settled
  there**, so their reasoning is cited second-hand. Anything settled only in that
  file is invisible to this review.
- **08-24 → 08-26 dispatch telemetry.** The boundary log starts
  2026-08-27T14:34Z. Those three days rest on commits, prompts and the
  experiment log.
- `Market/` (gitignored), `docs/writing/`, and agent model/effort economics.

---

## What the two halves say together

Read side by side, both investigations landed on the same shape from opposite
directions:

1. **The mechanisms Synapse already has are underused, not insufficient.** Five
   evidence-discipline skills fired zero times. `general-purpose` was never once
   pointed at the app. Reviewer's brief mechanism has three briefs and room for
   more.
2. **The strongest-evidenced pain in the window — queue drift — wants a
   *script*, not a skill and not an agent.** Both investigations found it
   independently and both routed it away from their own question.
3. **The one thing that is genuinely missing is reserved** and is not a
   specialist at all.

**If exactly one thing gets built from this document, it should be
`scripts/queue-audit.mjs`** — the highest occurrence count, the clearest measured
harm, zero judgement required, and an accepted in-repo precedent in
`commit-task.mjs`.
