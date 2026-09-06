# Plan persistence — the plan file belongs to the commit stream, not to the run

**Date:** 2026-08-29
**Status:** design record, ready to implement as one edit to `agents/synapse-planner.md`
and one to `agents/synapse-manager.md`
**Covers:** `agents/synapse-planner.md`, `agents/synapse-manager.md`, and the
"landed vs in flight" signal that `watcher/docs/DISPATCH-QUEUE.md` cites

> **Routed outside the pipeline, by standing rule (2026-08-29).** This record
> edits `agents/synapse-manager.md`, so it is implemented by a plain session,
> not dispatched to `synapse-manager`. A Manager session changing its own
> definition runs the old text for the whole run and cannot exhibit what it just
> approved — see *"The pipeline does not fix the pipeline"* in `CLAUDE.md`.
> Run `node scripts/agent-audit.mjs` on the edit, then deploy, restart, and let
> the next Manager session be the test.

---

## 1. The measurement, re-run

Every row below was re-checked on 2026-08-29 with
`git ls-files --error-unmatch <path>`, not inherited from the queue.

| Task | Plan file | State |
|---|---|---|
| 11 | `watcher/docs/2026-08-28-watcher-drop-order-space-plan.md` | untracked |
| 12 | — | never written |
| 13 | — | never written |
| 10 | `plans/2026-08-29-boundary-hook-machine-wide.md` | untracked |
| 9 | `watcher/docs/2026-08-29-watcher-hook-log-adapter-plan.md` | **tracked** |
| 14 | — | never written |
| 16 | `watcher/docs/2026-08-29-watcher-repository-management-plan.md` | untracked |

**Six of the last seven landed tasks have no committed plan.** The table is
correct as given, including the row the dispatch queue does not yet have.

**Two corrections to what the repository says about itself, neither of which
changes the conclusion:**

- **`watcher/docs/DISPATCH-QUEUE.md` still says "Five of the last six".** It
  predates task 16 and stops one row short. Its own run-order line says **"Task
  16 is IN FLIGHT"**, sourced explicitly to *"Karl's report, 2026-08-29, not a
  measurement"*. It landed: `020d1d6`, `e468728`, `06a4414`, `e1acc69`, all
  trailered `[manager]`, 07:54–08:02 on 2026-08-29. The queue is stale, not
  wrong on purpose — and it is stale in exactly the way this record is about.
- **"Never written" is confirmed, not assumed.** `find . -name "*-plan.md"`
  across the whole tree returns seventeen files and none of them belongs to
  tasks 12, 13 or 14. `git log --diff-filter=D -- '*plan*.md'` shows the only
  plan deletions in history are the two `git mv`s in `c7bf97a`. Nothing was
  written and then removed.

**Untracked here means untracked, not ignored.** `.gitignore` holds
`node_modules/`, `.DS_Store`, `Thumbs.db`, `.superpowers/` and `Market/`. No
plan path is covered by any of them.

---

## 2. The cause, and why it is not a compliance failure

This is the part that changes what the fix has to be.

**No agent in the pipeline is instructed to commit the plan, and one of them is
instructed not to.**

`agents/synapse-planner.md`, under *Declared footprint*:

> **Exclude the plan file itself.** The footprint describes what Coder
> will touch, not what you just wrote.

`agents/synapse-coder.md`, on staging:

> Two things follow. **Never run `git add -A`, `git add .`, or
> `git commit -a`** — stage only the paths your plan told you to touch.

Put those two sentences beside each other and the outcome is forced. Planner
writes the plan and removes it from the only list Coder is allowed to stage
from. Coder then stages exactly what it was told to and nothing else. **The plan
file falls through the seam between two rules that are each individually
correct.**

That distinction matters because it rules out the obvious remedies. The failure
in `anthropics/claude-code` #25265 was an agent not doing what it was told —
*"Claude STATED it was writing the plan… Claude NEVER called the Write tool."*
Synapse's failure is every agent doing exactly what it was told. **More
instruction cannot fix an outcome that current instruction produces on purpose.**

### The one success was self-caused, and that is the existence proof

Task 9 is the only tracked plan in the table. It was committed by `cc287ac`,
whose message says why:

> Also commits the plan file this task implements, per its own step 18 note that
> two prior tasks left their plans untracked.

The plan's own `### Step 18 — commit` carries the instruction:

> Commit this plan file alongside the code. Two prior tasks (11 and 12) left
> their plans untracked and the queue records that as a pattern worth ending.

**A step inside the plan is the only thing that has ever made this happen in
this repository.** That is the `agent-os` mechanism — *"Task 1 is always 'Save
spec documentation'"* — arrived at independently, by hand, once. The design
below is that hand-written step made structural.

---

## 3. Decisions

### Decision 1 — the plan commits itself: "commit this plan file" becomes step 1 of every plan Planner emits

Planner writes, as the first numbered step of every plan, a step that commits
the plan file at its own path. Coder executes it before any code step.

**This is the only candidate that needs no new tool grant.** Coder already holds
`Bash`, already commits, and already has a rule that reads
*"stage only the paths your plan told you to touch"* — a plan that names its own
path satisfies that sentence as written. **`agents/synapse-coder.md` needs no
edit at all.**

The rejected alternatives, and why:

**Planner writes and commits its own plan — rejected on tools.** Planner's
grant is `tools: Read, Grep, Glob, Write, Edit, Agent(Explore)`. There is no
`Bash`, so Planner cannot run `git` at all. **An agent that cannot commit cannot
be given the job**, and the grant it would need is the largest single expansion
of authority anywhere in this pipeline — `Bash` is not a `git commit` grant, it
is a run-anything grant, handed to the one agent whose definition says *"Your
`Write` and `Edit` grants exist for exactly this one purpose."* Buying an
unbounded shell to fix a one-line bookkeeping gap is a bad trade, and it is the
trade `CLAUDE.md`'s "nothing half-built" rule exists to make visible.

**Manager verifies the plan is tracked before dispatching Coder — rejected as
the primary, kept as a backstop.** It cannot work in that position: at the
moment Manager would check, nobody has committed anything yet, and Manager can
neither commit nor write. The check is only possible *after* the run, which
makes it a detector rather than a fix. It is worth having anyway — see Decision
3.

### Decision 2 — step 1, not the last step, and the reason is already written in `synapse-coder.md`

Task 9 put the commit at step 18 and it worked. That is not an argument for
step 18; it is an argument that task 9 ran clean.

`agents/synapse-coder.md` makes the case against a trailing commit, in its own
words, about its own commits:

> A plan is many tasks and a run is long. Everything you have not
> committed is lost to a crashed session, a context blowout, or a bad
> edit — so batching the commits to the end means the whole run is
> unprotected for the whole run.

**The plan is the one artifact that is finished before the run starts.** There
is nothing to wait for and nothing that could invalidate it mid-run. A run that
stalls at step 15, or takes a `REJECTED(implementation)` and gets abandoned,
never reaches step 18 — and loses the plan for exactly the reason Coder's own
paragraph gives.

**The step must say that it has no tests, or Coder will look for some.** Coder's
commit rule is *"Commit after each completed task, once that task's tests
pass."* A plan-commit has no tests to pass. The step text has to name that
explicitly — a `docs(plan):` commit that protects the plan, with the suite
untouched — or a Coder reading its instructions faithfully stalls at step 1
waiting for a green run that step 1 cannot produce.

**The `Session:` trailer rule is untouched.** Step 1 signs with *"the value your
dispatcher gave you"*, identically to every other commit in the run. The step
must not name a value. `synapse-coder.md` records what happens when it does:
28 commits trailered `[manager]` in a repository where no Manager pipeline had
ever run. A plan-commit step that hardcoded `manager` would put that defect back
in the first line of every plan.

### Decision 3 — Manager's stewardship stage checks the plan path, using a command it already runs

Decision 1 covers plans that Planner writes. It structurally cannot cover:

- a plan the **user** supplied, where Manager *"skip[s] step 1 entirely and
  start[s] at step 2"* and no Planner ever ran to insert a step 1;
- a Coder that skipped step 1;
- every plan written before this record ships.

Manager's stewardship stage already runs `git status --short` twice — in step
(c) *Back up* and step (d) *Flag drift* — and step (d) already says
*"A dirty tree from `git status --short` is still worth reporting whatever the
log says."* Manager also already holds the plan's path: it is told to run
`git hash-object <path>` the moment Planner returns it and *"keep that hash
beside the path."*

**So the check is: if the plan path appears as `??` in `git status --short`,
say so, and dispatch `synapse-coder` to commit it.** Manager cannot commit —
`git commit` is not on its allow-list and writing is forbidden to it — but
dispatching Coder for a one-file bookkeeping commit is a move stewardship step
(b) *Record* already makes: *"dispatch `synapse-coder` to update it now, as its
own small dispatch."*

**This adds no command to Manager's Bash allow-list.** `git ls-files` would be
the more direct instrument and would sit comfortably inside the stated principle
— *"commands that return metadata about the repository are allowed"* — but
`git status --short` already answers the only question being asked, and an
allow-list that grows for a capability already present is the kind of
unnecessary grant `CLAUDE.md` asks to be argued for rather than assumed.

### Decision 4 — the FOOTPRINT rule inverts for the plan file, and that is the whole of the coupling

This is the one place Decision 1 collides with an existing rule, and it must be
changed in the same edit or the fix creates a review finding on every task.

Reviewer *"compares them literally against the paths Coder reports touching"*,
and Planner currently declares:

> **Exclude the plan file itself.**

Once step 1 commits the plan, Coder reports touching the plan path, Reviewer
compares it against a footprint that deliberately omits it, and every task ends
with a spurious discrepancy finding. **The rule becomes: declare the plan file
as the first line of the footprint, because step 1 commits it.**

The rationale changes with it. The old sentence — *"the footprint describes what
Coder will touch, not what you just wrote"* — was true precisely because Coder
did not touch the plan. Under Decision 1 it does. **`agents/synapse-reviewer.md`
needs no edit**: it keeps comparing two lists literally, and the two lists now
agree.

### Decision 5 — both `plans/` and `watcher/docs/` are correct, and the table shows the convention working

`README.md`'s Layout block:

    plans/               Implementation plans (point-in-time; stale by design)
    watcher/docs/        Every Watcher spec and plan, together. NOT in specs/ or plans/ -- on purpose.

`watcher/docs/README.md` restates it as a rule with a reason:

> **This is a deliberate exception to the repo's Layout block**, where design
> specs live in `specs/` and implementation plans in `plans/`. Watcher is the
> only part of Synapse that is a separate package with its own `package.json` …
> Do not "restore" these files to `specs/` and `plans/`.

The split is by **subject**, not by format. Task 10 was Synapse's own tooling —
the machine-wide boundary hook — and its plan is in `plans/`. Tasks 9, 11 and 16
were Watcher work and theirs are in `watcher/docs/`. **Every row in the table is
in the right directory.** The directories were never the problem.

**Planner's stated default has never once been used, and that is also correct.**
`agents/synapse-planner.md` says to write to `docs/superpowers/plans/`, then:

> Depart from it only when the project already holds plans somewhere else: an
> existing convention is one you can point at, not one you invent on the spot.

`docs/superpowers/` contains exactly one entry — `decisions/` — and no `plans/`
directory has ever existed. The escape clause has fired on every plan this repo
has ever produced, and it fired correctly each time because two README files
state the convention plainly enough to point at. **Do not "fix" Planner's
default to match Synapse.** The default is for a consumer repo with no
convention; Synapse is not that repo, and hardcoding Synapse's layout into a
machine-wide agent would break every other consumer.

### Decision 6 — a hook is the wrong instrument here, and saying otherwise would be theatre

The repo ships `scripts/orchestrator-boundary.mjs` as a `PreToolUse` hook, and
Anthropic's documented advantage is real: hooks are deterministic where
`CLAUDE.md` is advisory. That advantage does not apply to this failure.

**A `PreToolUse` hook fires before a tool call. This failure is the absence of a
tool call.** There is no event to hang the check on. Nothing happens, and
"nothing happens" is not a hook trigger.

**A `Stop` hook could fire at session end, and would be worse than useless.** Two
reasons, both from the existing hook's own design notes:

- The discriminator problem is already documented in
  `scripts/orchestrator-boundary.mjs`: *"the main session running as `--agent
  synapse-manager` and an ordinary brainstorming session look identical. Both
  simply lack the field."* A Stop hook cannot tell which kind of session it is
  ending.
- A brainstorm session **legitimately** has untracked plan files. Three sit in
  the working tree right now. A hook that fires on all of them fires constantly
  on correct behaviour, and a warning that is usually wrong gets muted.

**And a hook cannot commit.** Its options are block, warn, or record. Blocking a
tool call because some unrelated file is untracked punishes the wrong action at
the wrong moment.

**The empirical answer is #25265.** The reporter's summary, verbatim:

> Claude had hooks, rules, and explicit instructions specifically designed to
> prevent this exact failure mode.

Hooks were present and the plan was lost anyway. **A hook here would be
theatre — a visible control that does not touch the mechanism.** The mechanism
is a missing step in a numbered list, and the fix is a step in the numbered
list.

**What is worth building instead already has a spec.**
`specs/2026-08-29-queue-audit-script.md` check 8 reads untracked plan files
today. A script, run on demand, that reports rather than blocks is the right
shape for an observer — and its spec already gets the discipline right:
its check 8 says **"Do not label an untracked plan 'in flight.'"** and asks for
"the files, their tracked state, and no inference".

### Decision 7 — committing the plan makes the revision history recoverable, and the benefit is smaller than it looks

A real secondary effect, stated at its true size rather than its most flattering
one.

`agents/synapse-planner.md` names a live loss:

> An in-place edit destroys its own predecessor. That is a real cost, not
> a bookkeeping detail — **when Manager escalates a twice-rejected task to
> Architect, it is instructed to hand over the rejected approaches, and
> Manager cannot recover them.** … If you did not write the reasoning down, it
> is gone.

Once step 1 has committed the plan, git holds the pre-revision text and it is no
longer gone.

**But it does not reach the agent that needs it.** Manager is forbidden
`git show`. Architect's grant is `tools: Read, Grep, Glob, Write, Agent(Explore)`
— no `Bash`, so it cannot run `git show` either, and `Read` only sees the
current file. **The recovered text is available to a human, to Coder and to
Reviewer, and to none of the three agents in the escalation path.** It is a real
improvement to the repository's record and not a fix for the escalation gap.
Recording it here so that nobody later cites this record as having solved that.

---

## 4. What this actually buys, stated honestly

**It restores one signal and nothing else.** `watcher/docs/DISPATCH-QUEUE.md`
calls a committed plan *"the signal that separates 'landed' from 'in flight'"*.
Six of seven wrong makes that signal worse than absent — a reader applying it
does not get an unknown, they get a confident wrong answer, and the queue has
been wrong about what is in flight four times in two days on exactly this basis.

**It does not make plans maintained artifacts, and it should not try.**
arXiv:2608.04661's conclusion is that committed plans are

> better characterized as **ephemeral task records** than as intentionally
> maintained project artifacts.

**Synapse already agrees, in writing.** `README.md` calls `plans/`
*"point-in-time; stale by design"*, and `watcher/docs/README.md` §3 opens
*"Point-in-time and stale by design. They record what was intended when written,
not what the code does now."* The study's pessimism is aimed at a goal this repo
explicitly does not hold. **The goal here is a record and a signal, not a living
document** — and for that goal, an ephemeral task record in the ledger is
exactly the right artifact.

**The cost is about fifteen lines of prose in one agent file, and no new tool
grants at all.** Per `CLAUDE.md`'s rule that *"every emitted field and every
granted tool needs a path by which it gets used"*: this design grants nothing.
It changes what an existing grant is pointed at. The consumers of the change are
named and live — Coder executes step 1 with the `Bash` it already has, Reviewer
compares a footprint it already compares, Manager reads a `git status --short`
it already runs.

---

## 5. The changes, and the deploy step

**`agents/synapse-planner.md`** — two edits, in one pass:

1. In the numbered instructions, after the plan-path rule: **every plan's step 1
   is committing the plan file at its own path.** State that it has no tests to
   wait for, that it is a `docs(plan):` commit, and that it signs with the value
   the dispatcher gave — never a value named in the plan.
2. In *Declared footprint*, replace **"Exclude the plan file itself"** with the
   inverse: **declare the plan file as the first footprint line**, because step 1
   commits it.

**`agents/synapse-manager.md`** — one edit, in the stewardship stage: when the
plan path Manager fingerprinted appears as `??` in the `git status --short` it
already runs, report it and dispatch `synapse-coder` to commit it, supplying
`Session: manager` as it must on every Coder dispatch. No change to the Bash
allow-list.

**`agents/synapse-coder.md`** — no change. **`agents/synapse-reviewer.md`** — no
change.

**Then run `node scripts/deploy-agents.mjs`, and tell the user to restart the
session.** Agent definitions load at session start, so an un-restarted Manager
pipeline is still running the old Planner text and will still emit plans with no
step 1. Per `CLAUDE.md`: a test that appears to show an agent ignoring this rule
is more likely a stale definition than a bad rule — check which before
concluding anything.

---

## 6. Open, not decided here

1. **The worktree dependency, which is unresolved in both directions.** The task
   framing names `specs/2026-08-29-manager-worktree-isolation.md` as a
   concurrent record that may move the Manager pipeline into a git worktree.
   > **Corrected 2026-08-29 by audit. This said "that file does not exist on
   > disk."** It does — 27,235 bytes in `specs/`, written the same minute as this
   > record, which is why the check came back empty. **The claim was
   > self-refuting**: the sentence asserting no Markdown file references it was
   > itself such a reference. The disposition it produced — defer the dependency
   > — was therefore wrong, and is replaced below.

   The dependency is real regardless, and Decision 1 is the candidate that
   survives it best: step 1 commits the plan **wherever Coder is**, on the same
   branch as the code, so the plan travels with the implementation through
   whatever merge that branch gets. Decision 3 is the half that breaks —
   Manager's `git status --short` would run in some directory, and which one is
   precisely the question the worktree record has to answer. **Do not implement
   Decision 3's check as worktree-blind if that record lands first.** Flagged,
   not resolved.

2. **Architect's decision records have the identical gap and are excluded here
   deliberately.** Architect writes to `docs/superpowers/decisions/` and holds no
   `Bash`, exactly as Planner does. `c7bf97a`'s own commit message records an
   instance: *"the Architect decision record at `docs/superpowers/decisions/`,
   which is uncommitted output from a concurrent Manager session."* Planner is
   handed the decision path and could name it in step 1 — but the record may
   already be tracked from an earlier task, so the step would need a conditional,
   and step 1's entire virtue is that it is unconditional. Buy it separately or
   not at all.

3. **What "committed" should mean for a plan whose task is later abandoned.** A
   step-1 commit lands the plan before anyone knows whether the task will
   survive. That is consistent with `synapse-coder.md`'s *"A commit is not an
   endorsement"*, and it is the right default — but nothing currently says what
   should happen to a plan for a task that is abandoned after three rejections.
   Probably nothing. Not decided.

4. **~~Whether check 8 needs its wording revisited.~~ Already done — this item
   described a superseded reading.** Check 8 no longer treats untracked plans as
   the in-flight signal; it was demoted by measurement on the same day and now
   says **"Do not label an untracked plan 'in flight.'"** If this record ships,
   untracked means *either* in flight *or* a skipped step 1 — and check 8's
   current shape, which reports tracked state and draws no inference, already
   handles that. **No change needed.**

5. **The design records are leaking too, and this fix does not touch them.**
   `watcher/docs/2026-08-29-watcher-card-back.md`,
   `2026-08-29-watcher-clean-value-guard.md` and
   `2026-08-29-watcher-repository-management.md` are all untracked right now, and
   they are the *inputs* to dispatches, not pipeline outputs. They come from
   brainstorm sessions, which no agent rule governs. Different cause, different
   fix, same symptom.

6. **`watcher/docs/README.md` §3's plan index is stale by five entries.** It
   stops at `2026-08-28-watcher-card-legibility-plan.md` and is missing the
   empty-state, live-state-machine, drop-order-space, hook-log-adapter and
   repository-management plans. Committing plans will not update a hand-written
   index; Manager's stewardship step (b) *Record* is the mechanism that should,
   and evidently has not been. Out of scope here, but it is the same class of
   failure one layer up.

---

## 7. What this record does not change

- **No agent gains a tool.** Planner does not get `Bash`. Manager's allow-list is
  unchanged. Architect is untouched.
- **The `Session:` trailer contract is untouched.** Coder is still told the value
  by its dispatcher and still stops and asks if it is omitted. Step 1 names no
  value.
- **Planner's default plan path stays `docs/superpowers/plans/`.** The escape
  clause is what Synapse relies on and it has worked on every plan ever written
  here.
- **The `plans/` vs `watcher/docs/` split stays exactly as it is**, including the
  deliberate exception and both READMEs that argue for it.
- **The revision protocol is unchanged.** Planner still revises in place, on the
  same path, keeping `Revision history` in the file. A revision is a second
  commit from a fresh Coder's step 1, not an amend — `synapse-manager.md`'s rule
  that a rejected-then-fixed task *"is supposed to look like two commits"* covers
  the plan file the same way it covers the code.
- **The boundary hook keeps logging and does not start enforcing.** Nothing here
  touches `decide()` in `scripts/orchestrator-boundary.mjs`.
- **Plans stay point-in-time and stale by design.** Committing one is a record of
  what was intended, and confers no obligation on anyone to keep it true.
