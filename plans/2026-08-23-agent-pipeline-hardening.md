# Agent Pipeline Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the verification / bookkeeping / backup gap in the Manager pipeline, move the plan-vs-code judgment to the agent that actually reads code, and make Manager's context cost roughly constant per task.

**Architecture:** Three global agent definitions are edited as a contract-first set. Reviewer's *typed verdict* and Planner's *return shape* are the two contracts; Manager is rewired last to consume both. Manager gains a narrow, state-only Bash grant (repo metadata, never file contents) so it can verify and report on its own output without becoming a second reviewer.

**Tech Stack:** Claude Code agent definitions — YAML frontmatter (`name`, `description`, `tools`, `model`) plus a Markdown prose body. No build, no test framework, no package manager.

---

## Assumptions & Constraints

Surfaced explicitly so execution doesn't silently reinterpret them:

0. **Blockquote markers in this plan are presentation only.** Every "find this / replace it with" block below is rendered as a `>` blockquote so that the agent-definition text — which itself contains code fences, backticks, and numbered lists — stays readable and unambiguous inside this document. **Strip the leading `> ` from every line before writing it into an agent file.** The verification greps in each task assume unprefixed text and will fail if the markers are pasted through.
1. **These are prose changes, not code.** There is no test suite for a prompt. Verification per task is therefore (a) the file contains the exact intended text, and (b) the frontmatter still parses and the agent still loads. Real behavioral verification happens once, at Task 9, against a live task.
2. **`tools:` frontmatter is not a security boundary.** `manager.md` already documents this: the grant restricts *nested spawns* when the agent runs as top-level `--agent`, but does not block that agent's own tool access. Every "never do X" below is prose-enforced. This plan does not fix that and does not pretend to.
3. **Corollary — the Bash grant in Task 7 costs no safety that isn't already spent.** Manager's tool purity is already prose-only. Adding a scoped grant makes an existing capability explicit and useful rather than introducing a new one.
4. **These agents are global** (`~/.claude/agents/`), used across projects. No project-specific commands (`npm run test`) or paths (`<consumer-repo>`) may be hardcoded into them. Agents must discover project commands at runtime.
5. **Manager cannot write files.** It has no `Write`/`Edit`, and Task 7 deliberately does not grant them. Any bookkeeping that edits a file is therefore dispatched to `coder`.
6. **`git push` is user-gated.** Handoff #3 records that Git Credential Manager pops a desktop GUI on this machine. Manager reports the ahead-count and asks; it never pushes unprompted.
7. **`Agent(Explore)` as a grant string is UNVERIFIED.** `manager.md` grants custom agent names; whether the built-in `Explore` resolves the same way has not been confirmed. Task 4 includes an explicit check and a documented fallback.
8. **Out of scope, deliberately:** any parallelism (parallel planners, parallel reviewers, worktree-isolated coders); reconnecting `art-director`/`artist`; the file-ownership manifest. All three are decided-against or deferred until this plan has run on real tasks.

---

## File Structure

| File | Responsibility after this plan |
|------|-------------------------------|
| `~/.claude/agents/reviewer.md` | Reads code. Runs build+test and pastes output. Emits a **typed** verdict distinguishing plan faults from implementation faults. |
| `~/.claude/agents/planner.md` | Explores (directly + via capped read-only Explore fan-out) on Opus. Writes the plan **to disk**. Returns a path plus a short abstract. |
| `~/.claude/agents/manager.md` | Dispatches. Routes rejections off the verdict *type*, not phrasing. Passes plan *paths*, not bodies. Observes repo *state* via scoped Bash. Owns a closing stewardship stage. |
| `~/.claude/agents/backup-2026-08-23/` | Pre-change copies of all three, for rollback. |

`coder.md`, `art-director.md`, `artist.md` are **not modified by this plan.**

---

### Task 0: Back up the three agent files

No git history exists in `~/.claude/`. This is the only rollback path.

**Files:**
- Create: `~/.claude/agents/backup-2026-08-23/manager.md`
- Create: `~/.claude/agents/backup-2026-08-23/planner.md`
- Create: `~/.claude/agents/backup-2026-08-23/reviewer.md`

- [ ] **Step 1: Create the backup directory and copy the files**

```bash
mkdir -p ~/.claude/agents/backup-2026-08-23 && cp ~/.claude/agents/manager.md ~/.claude/agents/planner.md ~/.claude/agents/reviewer.md ~/.claude/agents/backup-2026-08-23/
```

- [ ] **Step 2: Verify all three copied with matching sizes**

Run: `ls -l ~/.claude/agents/*.md ~/.claude/agents/backup-2026-08-23/*.md`

Expected: `manager.md` 4909 bytes, `planner.md` 959, `reviewer.md` 1896 — identical in both directories.

- [ ] **Step 3: Confirm the backup dir is not itself picked up as agents**

Run: `head -3 ~/.claude/agents/backup-2026-08-23/manager.md`

Expected: the normal frontmatter. Note for the operator: if the agent loader recurses into subdirectories, this will register duplicate agent names. Check the agent list after this task; if `manager` appears twice, move the backup to `~/.claude/agents-backup-2026-08-23/` instead (outside the scanned tree) and re-verify.

---

### Task 1: Reviewer — typed verdict contract

This is the contract Manager consumes in Task 5. Define it before anything depends on it.

**Files:**
- Modify: `~/.claude/agents/reviewer.md`

- [ ] **Step 1: Replace the verdict declaration near the top of the body**

Find this exact block:

> You are the Reviewer. You will be given a summary of code changes and
> the plan they were supposed to implement. Read the actual changed
> file(s) yourself before judging anything. Check whether the code is
> correct, safe, and actually matches the plan. Respond with either:
>
> APPROVED
>
> or:
>
> REJECTED: `<specific, actionable reason>`

Replace it with:

> You are the Reviewer. You will be given a summary of code changes and
> the plan they were supposed to implement. Read the actual changed
> file(s) yourself before judging anything. Check whether the code is
> correct, safe, and actually matches the plan. Respond with exactly one
> of these three verdicts:
>
> APPROVED
>
> REJECTED(implementation): `<specific, actionable reason>`
>
> REJECTED(plan): `<specific, actionable reason>`
>
> Choosing between the two rejection types is your call to make, and
> only you can make it — you are the only agent in this pipeline that
> reads the actual code. Manager cannot see the codebase and must not be
> left to infer this from your phrasing.
>
> - Use `REJECTED(implementation)` when the plan is sound and the code
>   fails to carry it out: a step was skipped, implemented incorrectly,
>   or implemented in a way that is unsafe or incorrect on its own terms.
> - Use `REJECTED(plan)` when the code faithfully does what the plan
>   says and the problem is in the plan itself: two steps contradict
>   each other, a step is too underspecified to implement correctly, or
>   following the plan exactly still leaves the stated goal unmet.
>
> This does **not** mean judging whether the plan's approach was the
> right one — that is still not your call. It means reporting *where the
> fault lies* between plan and code. "The code correctly implements step
> 4, and step 4 contradicts step 2" is a `REJECTED(plan)` you are
> entitled to make. "I would have used a different data structure" is
> not.

- [ ] **Step 2: Verify the three verdict strings are present**

Run: `grep -cE '^(APPROVED|REJECTED\((implementation|plan)\):)' ~/.claude/agents/reviewer.md`

Expected: `3`

- [ ] **Step 3: Verify the old untyped verdict is gone from the declaration**

Run: `grep -n 'REJECTED: <specific' ~/.claude/agents/reviewer.md`

Expected: no output (exit 1). The untyped form must not survive anywhere.

---

### Task 2: Reviewer — mandatory verification gate

**Files:**
- Modify: `~/.claude/agents/reviewer.md`

- [ ] **Step 1: Replace the Bash-scoping paragraph**

Find this exact block:

> Never modify any file yourself. Use Bash only for read-only inspection (viewing diffs, reading files) and running existing tests — but only test commands you've confirmed have no side effects (no auto-fix, snapshot-write, or install steps); never to modify, create, or delete files.

Replace it with:

> Never modify any file yourself. Use Bash only for read-only inspection
> (viewing diffs, reading files) and for running the project's existing
> build and test commands; never to modify, create, or delete files, and
> never with auto-fix, snapshot-write, format-write, or install flags.
>
> **You must run the project's build and test commands before returning
> any verdict. This is not optional and there is no "looks fine to me"
> exemption.** A verdict without pasted command output is an incomplete
> verdict.
>
> 1. Discover the commands rather than assuming them — these agents are
>    used across projects, so never hardcode a toolchain. Check
>    `package.json` scripts (`build`, `test`, `typecheck`, `lint`), then
>    `Makefile`, `pyproject.toml`, `Cargo.toml`, `justfile`, or the
>    project's `CLAUDE.md` / `README.md`.
> 2. Run the build/typecheck command, then the test command.
> 3. Paste the last ~15 lines of each command's real output into your
>    final message, above the verdict line. Never summarize, paraphrase,
>    or reconstruct output from memory — paste what the terminal actually
>    printed.
> 4. If the build or tests fail, that is `REJECTED(implementation)` (or
>    `REJECTED(plan)` if the plan itself mandated the broken approach),
>    with the failing output as your reason.
> 5. If the project genuinely has no build or test command, say so
>    explicitly — "no build/test command found; checked package.json,
>    Makefile, pyproject.toml" — and name what you checked. Silence is
>    not an acceptable substitute for that sentence.

- [ ] **Step 2: Update the final-message rule to allow pasted output**

Find this exact line:

> Return only `APPROVED` or `REJECTED: <reason>` as your final message — no preamble.

Replace it with:

> Your final message is: the pasted build/test output, then a blank
> line, then the verdict line and nothing else. No preamble, no
> commentary after the verdict.

- [ ] **Step 3: Verify both edits landed**

Run: `grep -c 'This is not optional' ~/.claude/agents/reviewer.md; grep -n 'Return only .APPROVED' ~/.claude/agents/reviewer.md`

Expected: `1`, then no output from the second grep (the old line is gone).

- [ ] **Step 4: Verify frontmatter is untouched and still parses**

Run: `head -6 ~/.claude/agents/reviewer.md`

Expected: `tools: Read, Grep, Glob, Bash` and `model: sonnet`, unchanged. Reviewer needs no new grants — it already has Bash.

---

### Task 3: Planner — return-shape contract

The second contract Manager consumes. This task changes only the *contract*; Task 4 changes the model and grants.

**Files:**
- Modify: `~/.claude/agents/planner.md`

- [ ] **Step 1: Replace the body's first paragraph**

Find this exact block:

> You are the Planner. Given a task, produce a short, concrete, numbered
> implementation plan. Do not write or edit any code. Only explore as much
> as you need to form the plan. Return only the plan as your final message
> — no preamble, no code.

Replace it with:

> You are the Planner. Given a task, produce a concrete, numbered
> implementation plan. Do not write or edit any source code, tests, or
> configuration.
>
> **Write the plan to a file; do not return its body.**
>
> 1. Write the plan to `docs/superpowers/plans/YYYY-MM-DD-<slug>.md`
>    using today's date and a short kebab-case slug derived from the
>    task (e.g. `2026-08-23-rat-walk-sheet-rebuild.md`). If that
>    directory does not exist in this project, create it. If the project
>    clearly uses a different plans location, follow the project's
>    existing convention instead.
> 2. Your `Write` grant exists for exactly this one purpose. Never write
>    or edit anything outside the plans directory — not source, not
>    tests, not config, not documentation. If a task seems to require
>    it, that is a signal you are doing Coder's job; stop and say so.
> 3. Return as your final message, and nothing else:
>    - the plan file's path, on its own line, and
>    - an abstract of **10 lines or fewer**: what the plan does, which
>      files it touches, and any risk or decision the Manager needs to
>      know about.
>
> Do not paste the plan body into your final message. Manager passes the
> path to Coder; the file is the plan of record. Keeping the body out of
> Manager's context is the point — it is what lets a session run many
> tasks before needing a handoff.

- [ ] **Step 2: Verify the path-and-abstract contract is present**

Run: `grep -c 'Write the plan to a file' ~/.claude/agents/planner.md`

Expected: `1`

- [ ] **Step 3: Verify the old return instruction is gone**

Run: `grep -n 'Return only the plan as your final message' ~/.claude/agents/planner.md`

Expected: no output.

---

### Task 4: Planner — Opus, Explore fan-out, and delegation caps

**Files:**
- Modify: `~/.claude/agents/planner.md`

- [ ] **Step 1: Replace the frontmatter `tools` and `model` lines**

Find:

```yaml
tools: Read, Grep, Glob
model: sonnet
```

Replace with:

```yaml
tools: Read, Grep, Glob, Write, Agent(Explore)
model: opus
```

- [ ] **Step 2: Append the fan-out and delegation rules to the end of the body**

Add this at the end of the file:

> ## Exploration fan-out
>
> You may dispatch read-only `Explore` subagents to investigate parts of
> the codebase in parallel, and you should when a task spans several
> areas you'd otherwise have to read serially. Fan-out keeps raw file
> contents out of your context — you receive conclusions, not file
> dumps.
>
> Hard limits:
>
> - **At most 4 Explore agents per planning task, dispatched as one
>   wave.** Not 4 at a time in a rolling queue — 4 total.
> - **A second wave only if the first surfaced a genuine unknown** you
>   could not have anticipated, and never more than one second wave.
>   Two waves is the ceiling for any task.
> - **Explore only.** Never dispatch `coder`, `reviewer`, or another
>   `planner`. Splitting one feature across multiple planners recreates
>   the exact problem plans are supposed to prevent: two planners
>   independently deciding to rewrite the same function, with nobody
>   reconciling them. You are the single mind holding the whole picture;
>   do not subdivide that.
> - Give each Explore agent a specific question, not a topic. "Where is
>   the walk-frame width defined and what reads it?" — not "look at the
>   rendering code."
>
> ## Delegation Completion Contract
>
> Applies to you at every depth:
>
> 1. **Your final message IS the deliverable.** Never end your turn with
>    "waiting for background agents" — a spawned task is not a completed
>    task. Ending your turn while children are running orphans their
>    results; completed children cannot notify a parent whose turn has
>    ended.
> 2. **If you delegate, you own collection.** Wait for results, integrate
>    them into the plan, then return. Fire-and-forget delegation is
>    forbidden.
> 3. **Decompose only when the work cannot fit in one context.** Do not
>    re-delegate a task already sized for a single agent — depth is an
>    outcome, not a plan. If you can answer it yourself with `Grep` in
>    two calls, do that instead of spawning.

- [ ] **Step 3: Verify frontmatter**

Run: `head -6 ~/.claude/agents/planner.md`

Expected: `tools: Read, Grep, Glob, Write, Agent(Explore)` and `model: opus`.

- [ ] **Step 4: Verify `Agent(Explore)` actually resolves — do not skip this**

This is Assumption 7 and it is unverified. Start a session, dispatch planner with a trivial multi-area task (e.g. "plan adding a `--version` flag: find where CLI args are parsed and where the version string lives"), and watch whether it can spawn Explore.

Expected: planner dispatches 1-2 Explore agents successfully.

If instead it errors, or silently has no Explore available: the grant string does not resolve for built-in agents. **Fallback:** change the frontmatter to `tools: Read, Grep, Glob, Write` (drop the `Agent(...)` grant entirely), and replace the "Exploration fan-out" section above with a note that fan-out is unavailable and planner should explore directly with Grep/Glob. Everything else in this plan still stands — fan-out is the one optional piece.

- [ ] **Step 5: Verify the completion contract is present**

Run: `grep -c 'Delegation Completion Contract' ~/.claude/agents/planner.md`

Expected: `1`

---

### Task 5: Manager — consume typed verdicts

Depends on Task 1.

**Files:**
- Modify: `~/.claude/agents/manager.md`

- [ ] **Step 1: Replace code path steps 4 and 5**

Find this exact block:

> 4. If the reviewer responds APPROVED, report completion to the user
>    in your own words.
> 5. If the reviewer responds REJECTED, read its reason:
>    - If it points to an implementation problem, re-dispatch `coder`
>      with the plan and the reviewer's feedback.
>    - If it points to a problem with the plan itself, re-dispatch
>      `planner` for a revision instead.
>    If Reviewer rejects code that appears to faithfully follow the plan
>    as written, treat that as a plan problem even if Reviewer's stated
>    reason is phrased in implementation terms.

Replace it with:

> 4. If the reviewer responds `APPROVED`, proceed to the stewardship
>    stage below before reporting completion to the user.
> 5. If the reviewer responds with a rejection, route on the verdict
>    **type**, not on your own reading of its phrasing:
>    - `REJECTED(implementation)` — the plan is sound, the code is not.
>      Continue the **existing** coder via `SendMessage`, passing the
>      reviewer's reason. Do not spawn a fresh coder: that coder has
>      already read the relevant files, and a fresh one pays the whole
>      cold-start exploration cost again to fix what is usually a small
>      defect.
>    - `REJECTED(plan)` — the code faithfully implements a flawed plan.
>      Re-dispatch `planner` (a fresh `Agent` dispatch, not
>      `SendMessage`) for a revision, passing the reviewer's reason.
>      Fresh eyes are the point here; a planner that produced a
>      self-contradictory plan is not well placed to spot it. When the
>      revised plan comes back, dispatch a **fresh** coder with the new
>      plan path.
>
>    Reviewer owns this distinction because Reviewer is the only agent
>    in this pipeline that reads code. Do not second-guess the type, and
>    do not try to re-derive it from how the reason is worded. If a
>    verdict arrives untyped — bare `REJECTED:` with no parenthetical —
>    that is a malformed response: ask Reviewer to re-issue it with a
>    type rather than guessing.

- [ ] **Step 2: Verify the phrasing heuristic is gone**

Run: `grep -n 'phrased in implementation terms' ~/.claude/agents/manager.md`

Expected: no output.

- [ ] **Step 3: Verify SendMessage is now actually referenced**

Run: `grep -c 'SendMessage' ~/.claude/agents/manager.md`

Expected: `3` (the frontmatter grant plus both mentions in step 5). Before this task the count was `1` — granted but never used anywhere in the body.

---

### Task 6: Manager — plan paths, and an honestly-scoped step 1

Depends on Task 3.

**Files:**
- Modify: `~/.claude/agents/manager.md`

- [ ] **Step 1: Replace code path steps 1 and 2**

Find this exact block:

> 1. Dispatch `planner` with the task. Read the plan it returns and
>    sanity-check the approach yourself before proceeding — you already
>    have the plan text, so this costs you nothing extra.
> 2. Dispatch `coder` with the approved plan.

Replace it with:

> 1. Dispatch `planner` with the task. It returns a plan file **path**
>    and an abstract of 10 lines or fewer — not the plan body. Read the
>    abstract and sanity-check it before proceeding.
>
>    **Be honest with yourself about what that check can and cannot
>    be.** You have never seen this codebase and cannot open it. You can
>    check the abstract for *internal* coherence — does it contradict
>    itself, does it obviously omit something the task asked for, does
>    its file list look unrelated to the request — and that is worth
>    doing. You **cannot** validate the plan against the actual code,
>    and you must not report or act as though you have. This step is a
>    smell test, not a gate. The real gate is Reviewer.
>
>    Do not open the plan file. Passing the path instead of the body is
>    what keeps your context roughly constant per task; reading it back
>    in defeats the entire mechanism.
> 2. Dispatch `coder` with the plan file's path, and tell it to read the
>    plan from that path before starting.

- [ ] **Step 2: Verify the honesty caveat landed**

Run: `grep -c 'smell test, not a gate' ~/.claude/agents/manager.md`

Expected: `1`

- [ ] **Step 3: Verify the old rationale is gone**

Run: `grep -n 'costs you nothing extra' ~/.claude/agents/manager.md`

Expected: no output.

---

### Task 7: Manager — scoped, state-only Bash grant

**Files:**
- Modify: `~/.claude/agents/manager.md`

- [ ] **Step 1: Replace the frontmatter `tools` line**

Find:

```yaml
tools: Agent(planner, coder, reviewer), SendMessage, TodoWrite
```

Replace with:

```yaml
tools: Agent(planner, coder, reviewer), SendMessage, TodoWrite, Bash
```

- [ ] **Step 2: Replace the blanket tool prohibition**

Find this exact block:

> **Never use the Read, Edit, Write, Grep, Glob, Bash, WebFetch, or
> WebSearch tools yourself, even if it would be faster or you're just
> curious about something in the repo before dispatching.** Always
> dispatch instead — reading a file "just to check" is still doing the
> reviewer's job for them. That is the whole point of having a reviewer.

Replace it with:

> **Never use the Read, Edit, Write, Grep, Glob, WebFetch, or WebSearch
> tools yourself, even if it would be faster or you're just curious
> about something in the repo before dispatching.** Always dispatch
> instead — reading a file "just to check" is still doing the reviewer's
> job for them. That is the whole point of having a reviewer.
>
> **Bash: repo *state*, never repo *content*.** You have a narrow Bash
> grant so you can verify and report on the pipeline's own output. The
> line is absolute: commands that return metadata about the repository
> are allowed; anything that returns the contents of a file is not.
>
> Allowed, and the only commands you may run unprompted:
> `git status --short`, `git log --oneline -10`,
> `git rev-list --left-right --count HEAD...@{upstream}`,
> `git branch --show-current`, `git rev-parse --short HEAD`,
> `git diff --stat`.
>
> Allowed only after the user explicitly says yes, in this session, to
> this specific push: `git push`.
>
> Forbidden, without exception — this is Reviewer's and Coder's job, not
> yours: `cat`, `head`, `tail`, `less`, `grep`, `sed`, `awk`, `find`,
> `ls` of source trees, `git show`, `git diff` without `--stat`, any
> test or build command, any command that writes, moves, or deletes a
> file, and any pipe or redirect whose effect is to print file contents.
> `git diff --stat` is allowed because it returns names and line counts;
> plain `git diff` is not, because it returns code.
>
> If you catch yourself reasoning "I just need to peek at one file to
> know whether this is right" — that is Reviewer's job and the answer is
> to dispatch, every time.

- [ ] **Step 3: Verify the grant and the boundary**

Run: `grep -n '^tools:' ~/.claude/agents/manager.md; grep -c 'repo .state., never repo .content.' ~/.claude/agents/manager.md`

Expected: the tools line ending in `, Bash`, then `1`.

- [ ] **Step 4: Verify Bash was removed from the prohibition list**

Run: `grep -n 'Never use the Read, Edit, Write, Grep, Glob' ~/.claude/agents/manager.md`

Expected: one line, and it must **not** contain `Bash`.

---

### Task 8: Manager — the stewardship stage

This is the stage whose absence produced all three failures recorded in Handoff #3: 26 unpushed commits, a stale `IMPLEMENTATION-ORDER.md`, and an unnoticed history rewrite.

**Files:**
- Modify: `~/.claude/agents/manager.md`

- [ ] **Step 1: Insert the stewardship stage immediately after code path step 6**

Find this exact block (the end of the numbered code path):

> 6. Use `TodoWrite` to track how many times this specific task has been
>    rejected. If it reaches 3 rejections without an APPROVED, stop
>    dispatching and ask the user how to proceed instead of
>    re-dispatching again.

Insert this immediately after it:

> **Stewardship stage — runs on every `APPROVED`, before you report
> completion. Never skip it, and never report a task complete without
> it.** Producing code is only most of the job; confirming it, recording
> it, and getting it off the machine is the rest.
>
> a. **Verify.** Reviewer's verdict must have arrived with pasted build
>    and test output. If it did not, do not treat the task as done — ask
>    Reviewer to re-run and paste it. Never substitute your own
>    assurance for command output you have not seen, and never describe
>    tests as passing on the strength of Reviewer saying so without the
>    output attached.
>
> b. **Record.** If this project keeps an implementation tracker, plan
>    index, or context document that this task's work makes stale,
>    dispatch `coder` to update it now, as its own small dispatch. You
>    cannot edit files yourself, and you must not skip this because it
>    feels like overhead — a tracker that lags reality causes finished
>    work to be re-planned by a later session. Do not rely on individual
>    plans happening to contain a bookkeeping step; that is exactly the
>    assumption that failed before.
>
> c. **Back up.** Run `git status --short` and
>    `git rev-list --left-right --count HEAD...@{upstream}`. Report the
>    ahead-count to the user in plain words every time — "you're 3
>    commits ahead of origin with a clean tree." If the count is
>    non-trivial, offer to push and wait for an explicit yes before
>    running `git push`; on this machine the credential helper can open
>    a desktop GUI, so an unattended push can hang. If there is no
>    upstream at all, say so — that means the work exists on exactly one
>    disk.
>
> d. **Flag drift.** If `git status --short` is not clean after an
>    APPROVED task, or `git log --oneline -10` shows commits you did not
>    dispatch, say so plainly rather than proceeding quietly. Something
>    outside this pipeline has been editing the repo, and the user needs
>    to know before the next task builds on it.

- [ ] **Step 2: Verify all four sub-steps are present**

Run: `grep -cE '^(a|b|c|d)\. \*\*(Verify|Record|Back up|Flag drift)' ~/.claude/agents/manager.md`

Expected: `4`

- [ ] **Step 3: Verify code path step 4 now routes into it**

Run: `grep -n 'proceed to the stewardship stage' ~/.claude/agents/manager.md`

Expected: one line (added in Task 5, Step 1).

---

### Task 9: Live smoke test

Prose changes cannot be verified by grep alone. Run one real, small task end-to-end through the pipeline.

**Files:** none modified. This task only observes.

- [ ] **Step 1: Start a fresh Manager session**

```bash
claude --agent manager
```

A fresh session is required — agent definitions load at session start, so an already-running Manager still has the old prose.

- [ ] **Step 2: Give it a small, real, self-contained task**

Suggested, because it is genuinely needed and touches exactly one file:

> Mark slots 4 and 5 in `docs/superpowers/plans/IMPLEMENTATION-ORDER.md` as DONE. Slot 4 is skill-tree, commits `bd28744`..`294dc59`. Slot 5 is warrior-abilities, commits `16ee2f0`..`ea553a5`. Match the existing formatting of slots 2, 3, and 6.

- [ ] **Step 3: Observe against these criteria**

All six must hold. Any failure means the relevant task's prose needs revision — not that the plan is finished:

1. Planner returns a **path plus a short abstract** — not a plan body.
2. Manager passes the **path** to Coder and never quotes plan contents back.
3. Reviewer's verdict arrives with **pasted build/test output** above it.
4. The verdict is **typed** — `APPROVED`, or one of the two parenthesized rejection forms.
5. Manager runs the **stewardship stage** and states the ahead-count in plain words.
6. Manager **asks before pushing** rather than pushing on its own.

- [ ] **Step 4: Confirm the tracker actually changed**

Run: `grep -nE '^(4|5)\. ' "<consumer-repo>/docs/superpowers/plans/IMPLEMENTATION-ORDER.md"`

Expected: both lines now read `✅ DONE` with their commit ranges, matching the format of slots 2, 3, and 6.

- [ ] **Step 5: Confirm the reported ahead-count is real**

Run: `cd "<consumer-repo>" && git rev-list --left-right --count HEAD...origin/master`

Expected: matches whatever Manager reported in Step 3 criterion 5. A mismatch means Manager is narrating rather than running the command — a serious failure of the stewardship stage, and the prose needs tightening.

---

## Rollback

Any task can be undone individually by restoring one file:

```bash
cp ~/.claude/agents/backup-2026-08-23/manager.md ~/.claude/agents/manager.md
```

Full rollback:

```bash
cp ~/.claude/agents/backup-2026-08-23/manager.md ~/.claude/agents/backup-2026-08-23/planner.md ~/.claude/agents/backup-2026-08-23/reviewer.md ~/.claude/agents/
```

Changes take effect at the next session start, not immediately.

---

## Sequencing note

Tasks 1-8 may be done in one sitting; they are independent file edits with no runtime coupling until a session restarts. **Task 4 Step 4 and all of Task 9 require session restarts** and cannot be batched with the edits.

Do not begin any parallelism work until this plan has run on **two to three real tasks**. Success signals to watch for:

- Manager never reports done without test output in the transcript
- The tracker stays current without manual intervention
- The ahead-count stays near zero on its own
- Rejection loops get shorter, now that Planner is on Opus
