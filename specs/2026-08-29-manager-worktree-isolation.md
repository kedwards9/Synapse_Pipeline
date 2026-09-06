# Manager runs in a worktree — isolating the pipeline session from the brainstorm session

**Date:** 2026-08-29
**Status:** design record. **Blocked on one measurement** (§4, item 1) that must
be taken before the first dispatch.
**Covers:** `agents/synapse-manager.md`'s tool grant and stewardship stage,
`CLAUDE.md`'s concurrent-sessions section, `.gitignore`
**Supersedes nothing.** `specs/2026-08-25-session-attribution-design.md` stands
unchanged — see Decision 6 for why isolation does not retire it.

> **Routed outside the pipeline, by standing rule (2026-08-29).** This record
> edits `agents/synapse-manager.md`, so it is implemented by a plain session,
> not dispatched to `synapse-manager`. A Manager session changing its own
> definition runs the old text for the whole run and cannot exhibit what it just
> approved — see *"The pipeline does not fix the pipeline"* in `CLAUDE.md`.
> Run `node scripts/agent-audit.mjs` on the edit, then deploy, restart, and let
> the next Manager session be the test.

---

## 1. What is actually wrong

Two Claude Code sessions run against **one clone**. A `synapse-manager` pipeline
session launched as `claude --agent synapse-manager`, and a brainstorming
session. Neither can see the other. `CLAUDE.md` names the hazard and mitigates
it entirely by convention: a `Session:` trailer on every commit, and a rule
never to run `git add -A`, `git add .`, or `git commit -a`.

**The convention is doing the job it was designed for, and that job is the wrong
half.** The 2026-08-29 research found a seven-day field measurement from a team
running 3–6 sessions against one clone:

> *"content always survived, attribution never did"*

and, on the same measurement:

> *"two of our three incidents happened to sessions that had read the mitigation
> and followed it correctly."*

That second sentence is the whole argument. A mitigation that fails while being
followed is not a mitigation with a compliance problem; it is a mitigation
aimed at the wrong layer. The same research found every vendor in the space —
Anthropic, Cursor, OpenAI — reaching for isolation rather than attribution, and
12 of 12 surveyed parallel-agent orchestrators using per-task git worktrees.

**The decision to use the harness's built-in `EnterWorktree` rather than a
script is already taken and is not re-argued here.** This record establishes
what has to be true around it, because four things are not, and two of them
break the pipeline outright.

Repository state at the time of measurement, for the record:

    $ git rev-parse HEAD
    e1acc69e39c2d5c6fae8c0713d63c26acffbec2a
    $ git rev-list --left-right --count HEAD...@{upstream}
    0	0
    $ git remote -v
    origin  https://github.com/kedwards9/synapse.git (fetch/push)
    $ git symbolic-ref refs/remotes/origin/HEAD
    refs/remotes/origin/master
    $ git --version
    git version 2.55.0.windows.3

`git status --short` at the same moment listed 5 modified and 12 untracked
paths, eleven of the untracked ones design records written this week. **That
dirty tree is the normal state of this repository, not an anomaly**, and it is
load-bearing for Decision 2.

---

## 2. Decisions

### Decision 1 — Manager calls `EnterWorktree` itself, first thing in its own run, on a `CLAUDE.md` instruction

**Karl cannot call it for Manager, and this is a mechanism fact rather than a
preference.** `EnterWorktree` switches *the calling session's* working
directory. Manager is a separate session — `claude --agent synapse-manager` —
so a call made from the brainstorm session moves the brainstorm session and
leaves Manager exactly where it was.

The harness stated the scope of the switch in its own refusal when this record's
author tried to measure it:

> *"EnterWorktree cannot create a worktree from a subagent with a cwd override
> (isolation: "worktree" or explicit cwd) — it would mutate the parent session's
> **process-wide working directory**."*

So the call has to come from inside the pipeline session, which means Manager
makes it.

**A `CLAUDE.md` instruction is a sanctioned trigger, not a workaround.** The
tool's own documentation says it must be used only when explicitly instructed
*"either by the user directly, or by project instructions (CLAUDE.md /
memory)"*, and lists as a **When to Use** case: *"CLAUDE.md or memory
instructions direct you to work in a worktree for the current task."* This is
the documented second door and it is the one that fits a session Karl launches
but does not drive.

**Ordering: `EnterWorktree` runs before `git rev-parse HEAD`.** Manager's
existing instruction is *"Before your first dispatch — anchor the session"*, and
the anchor is what stewardship step (d) measures its drift window from. Anchor
inside the worktree and the window is the branch, which is what you want.
Anchor in the main tree and step (d) measures across a branch boundary from the
first task onward.

### Decision 2 — `worktree.baseRef` is set to `head`, **and that does not solve the problem it looks like it solves**

The setting is unset. Measured four ways:

    $ git config --get worktree.baseRef        # exit 1, no value
    $ grep -ri worktree \
        ~/.claude/settings.json ~/.claude/settings.local.json \
        .claude/settings.json .claude/settings.local.json
                                               # no match in any file

So the default applies, and the tool's documentation states what that is:
*"`fresh` (default) branches from origin/<default-branch>; `head` branches from
your current local HEAD."* This repository has an origin, and `origin/HEAD`
resolves to `refs/remotes/origin/master`.

`head` is the correct setting. Local `master` happens to equal `origin/master`
right now (`0	0` above), but that is the state of one moment in a repository
whose sibling session commits several times a day and pushes only when asked.
Under `fresh`, a Manager launched five minutes after the brainstorm session
commits gets a worktree missing those commits, silently.

**Now the part that matters more, because setting `head` invites the belief that
the problem is handled.** A worktree is a checkout of a **commit**. Uncommitted
and untracked files in the main working tree do not exist in it — under *either*
value of `baseRef`. Measured directly:

    $ git worktree add -b probe-worktree-tmp <scratch>/probe-wt
    HEAD is now at e1acc69 ...
    $ ls <scratch>/probe-wt/specs/2026-08-29-queue-audit-script.md
    ls: cannot access ...: No such file or directory
    $ ls <scratch>/probe-wt/watcher/docs/2026-08-29-watcher-card-back.md
    ls: cannot access ...: No such file or directory

Both of those files were sitting untracked in `<synapse>` at that instant.
`2026-08-29-watcher-card-back.md` is a design record with five tasks in it — the
exact kind of document Manager gets dispatched against.

**Therefore, a rule with no setting behind it: the record or plan a Manager
session is dispatched to implement must be **committed at its current content**
— not merely tracked — before that session enters its worktree.**

> **"Tracked" is not enough, and the modified case is the larger population.** A
> record that is tracked but **modified** is already "committed" under a loose
> reading, and its *older* committed version is what the worktree gets. Measured
> at `e1acc69`: 15 untracked paths, of which 13 are records or plans — **and 15
> modified paths, of which 9 are tracked design records**, `DISPATCH-QUEUE.md`
> among them. The quiet failure is live for nine files right now.
>
> **This is a precondition, not a fatal objection.** It costs one `git add <path>
> && git commit` before dispatch, scoped to a single file.

This is a precondition on the dispatch and it belongs in
`CLAUDE.md` beside the launch instruction. There is no configuration that makes
it unnecessary, and the failure it prevents is the worst-shaped one available: a
worktree that looks fine, a Coder that reports the plan path unreadable, and a
Manager whose own instruction for that case is *"stop and tell the user"* — which
is at least loud. The quieter variant is a plan whose *earlier* committed version
exists in the worktree and gets implemented instead of the one Karl meant.

### Decision 3 — `.claude/worktrees/` is gitignored in the same change, or the isolation manufactures the mess it exists to prevent

Not currently ignored. Measured:

    $ git check-ignore -v .claude/worktrees
    (no output, exit 1)

`.gitignore` holds four patterns — `node_modules/`, `.DS_Store`, `Thumbs.db`,
`.superpowers/`, `Market/` — and none of them match.

The consequence is not hypothetical. A worktree was created at the tool's own
default location and the main repository's status was read:

    $ git worktree add -b probe-nested-tmp .claude/worktrees/probe-nested
    $ git status --short
    ...
    ?? .claude/worktrees/
    ...

One line, because git collapses the directory. One line is enough:

- **Manager's stewardship step (d)** says *"A dirty tree from `git status
  --short` is still worth reporting whatever the log says."* It would report
  that line on every APPROVED task, forever, for a directory the pipeline
  itself created.
- **`commit-task.mjs`** reports paths it was not given and leaves them alone —
  its `untouched` list. That list would carry the worktree on every commit.
- **The brainstorm session** sees it too, in a repository whose rules forbid
  `git add -A` *precisely because* of stray untracked files.

**Ignore `.claude/worktrees/` specifically, never `.claude/` wholesale.**
`.claude/settings.json` is tracked:

    $ git ls-files .claude
    .claude/settings.json

and it carries the `$comment` block explaining where the boundary hook moved to.
Ignoring the parent would take that with it.

> **Two directories are already leaking and this record does not fix them.**
> `.claude/research/` and `.claude/state/` are untracked and unignored today,
> and appear in every `git status --short`. They are somebody else's decision;
> mentioned only so the next reader does not assume this change created them.

### Decision 4 — Manager's stewardship step (c) is broken in a worktree and must be amended in the same change

Step (c) runs, verbatim from `agents/synapse-manager.md`:

    git status --short
    git rev-list --left-right --count HEAD...@{upstream}

The second command does not work on a worktree branch. Measured:

    $ git -C <worktree> rev-list --left-right --count HEAD...@{upstream}
    fatal: no upstream configured for branch 'probe-worktree-tmp'

Manager's own prose for that case: *"If there is no upstream at all, say so —
that means the work exists on exactly one disk."* So an unamended Manager raises
a data-loss alarm at the end of every single task. Worse, the alarm is
**false in a way that invites the wrong fix**: the remedy Manager offers in the
same step is `git push`, and pushing a throwaway pipeline branch to
`origin/synapse-work-<n>` is not backup, it is litter.

**Amendment.** Inside a worktree, the count is measured against the branch the
worktree was cut from:

    git rev-list --count master..HEAD

and the ahead-count is reported as *"N commits on `<branch>`, not yet merged to
master"* — which is the true statement — with an offer to merge rather than an
offer to push. Both commands stay on the state side of Manager's Bash boundary:
they return counts and names, never content.

### Decision 5 — the branch reaches master only from the main working tree, and Manager cannot do it

**This is the failure the record exists to prevent.** A pipeline that commits
into a branch nobody merges has silently lost the work, and every check Manager
runs would report success.

Two obvious escape routes are closed by git itself. Measured, both from inside a
worktree of this repository:

    $ git checkout master
    fatal: 'master' is already used by worktree at '<synapse>'

    $ git fetch . wt-merge-probe:master
    fatal: refusing to fetch into branch 'refs/heads/master' checked out at '<synapse>'

So the merge command must run with its working directory set to `<synapse>` —
the sibling session's perpetually dirty tree. What that does was measured in an
isolated probe repository rather than reasoned about:

| Main tree is dirty on… | Result |
|---|---|
| a path the merge does **not** touch | `Updating …` `Fast-forward` — merge succeeds, the dirty file is untouched |
| a path the merge **does** touch | `error: Your local changes to the following files would be overwritten by merge:` `Please commit your changes or stash them before you merge.` `Aborting` |

**Git protects the sibling's uncommitted work by refusing.** The failure mode of
a colliding merge is a **stall**, not a loss. That is the single most reassuring
thing in this record and it is why the merge step is safe to hand to a machine
at all.

**Manager still cannot run it.** Its Bash grant is enumerated and `git merge` is
not on the list; the forbidden clause is explicit — *"any command that writes,
moves, or deletes a file."* A merge writes files. So the merge is a `synapse-coder`
dispatch, which is exactly the move the Integration path already makes
(*"Dispatch `synapse-coder` to create a throwaway integration branch and merge
the streams into that"*), and it inherits that path's `Session:` requirement
unchanged.

**Leave the worktree in place until the merge has landed — do not remove it.**
The session-exit prompt is the mechanism; Manager does not call `ExitWorktree`
itself (Decision 8 explains why the grant was dropped). The
tool's own guard is real — *"If the worktree has uncommitted files or commits not
on the original branch, the tool will REFUSE to remove it unless
[`discard_changes`] is set to `true`"* — so this is belt and braces. It costs one
directory and removes the entire class of "the pipeline tidied up and the work
went with it." `remove` is available afterward, on Karl's word, and
`discard_changes: true` is never passed by an agent on its own judgement.

**Manager's final line on every task names the branch and the pending merge.**
Not a footnote. The branch name is the only thread back to the work.

### Decision 6 — the `Session:` trailer stays, and isolation makes it more useful rather than redundant

The tempting reading is that isolation subsumes attribution: separate trees,
separate work, nothing to attribute. It does not, and the field measurement says
so in one line:

> *"content always survived, attribution never did"*

**A worktree separates working trees. It does not separate history.** After the
merge in Decision 5, `master` holds both sessions' commits interleaved exactly as
it does today, and the question the trailer answers — *which session made this
commit* — is untouched. What the worktree removes is the file-collision hazard,
which is the half that *"always survived"* anyway. Isolation hardens the half
that was already working, and leaves the half that was failing entirely alone.
They are complements. Retiring the trailer on the strength of the worktree would
be dropping the mitigation for the failure that was actually measured.

**One real cost, named rather than waved past.** Manager's stewardship step (d)
reads the trailer over `<anchor>..HEAD`, and sorts what it finds into three
buckets — its own commits, a sibling's trailered commits, and untrailered drift.
Inside a worktree anchored at the branch point, that window contains **only
Manager's own commits**. The sibling's work is on `master` and invisible to the
window. So the middle bucket — *"the design session committed 2 docs since your
last task"* — goes permanently empty.

That is a genuine loss of situational awareness and it is the price of the
isolation. It is worth paying: the informational line was courtesy, the
collision it was warning about is the thing now structurally prevented, and the
third bucket — untrailered drift *on the pipeline's own branch* — becomes
sharper, not weaker, because nothing else should ever be committing there.

### Decision 7 — nothing in `scripts/` or Watcher breaks, with exactly one exception, and the exception is the dangerous kind

Every path-resolving consumer in the repository was checked against a changed
`cwd`.

**The boundary hook is fine, and does not do repository matching at all.**
`scripts/orchestrator-boundary.mjs`'s `toRecord` records `cwd: payload?.cwd ??
null` verbatim and makes no judgement about it. Its log destination is
homedir-anchored, not repo-anchored — `DEFAULT_LOG` is
`join(homedir(), '.claude', 'synapse-orchestrator-boundary.jsonl')`. A session
in a worktree writes a different `cwd` value into the same log. Nothing to
change.

**Watcher's `activity` field keeps working, and it works *because* the worktree
lives under the repo root.** The matcher is `isCwdInsideRepo` in
`watcher/src/main/hook-log-source.mjs`, and its own docstring states the rule:

> *"Case-insensitive segment-PREFIX containment, never equality and never raw
> `startsWith` on strings"*

A card configured as `<synapse>` has segments `E:`, `Synapse`; a worktree cwd
of `<synapse>\.claude\worktrees\<name>` has those as its first two. The prefix
holds, and hook records from the worktree attribute to the Synapse card exactly
as they do today. **This is an argument against ever relocating the worktree
directory** — a worktree outside the repository root would silently stop feeding
`activity`, and `activityFor` returns `null`, which renders as the grey
not-collected marker rather than as an error.

**Watcher's config is unaffected.** `watcher/src/main/config.mjs` validates a
hand-authored list — `KNOWN_KEYS` is `['_comment', 'repositories',
'alwaysOnTop']` — read from Electron's `userData`, with no discovery step. A
worktree does not become a card by appearing on disk. (If one is ever added by
hand, `normaliseRepoPath` gives it a distinct id and it becomes its own card
with its own status. That is correct behaviour, not a bug, and no reason to
prevent it.)

**`commit-task.mjs` is not merely unbroken, it is more correct inside a
worktree.** It resolves every path against `git rev-parse --show-toplevel`, which
in a worktree returns the worktree's own root — measured:

    $ git -C <worktree> rev-parse --show-toplevel
    C:/Users/.../probe-wt
    $ git -C <worktree> rev-parse --git-common-dir
    <synapse>/.git

So its "resolves outside the repository" guard is scoped to the worktree, and
its `untouched` report — the concurrent-session rule, enforced — no longer has
the sibling's twelve untracked files in it to report.

**The exception: `scripts/deploy-agents.mjs`.** Its source follows the worktree
and its target does not:

    const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
    export const DEFAULT_SOURCE = resolve(SCRIPT_DIR, '..', 'agents')
    export const DEFAULT_TARGET = join(homedir(), '.claude', 'agents')

Run from inside a worktree, it deploys **the worktree's** agent definitions
machine-wide, over the main tree's, and stamps the shared ownership manifest at
`~/.claude/.synapse-deployed.json` — which `manifestPath` derives from the
target's parent specifically so agents and hooks share one record. Isolation does
not isolate this, because the destination was never inside the repository.

The trap is that `CLAUDE.md` tells every session to run it: *"After editing an
agent — run `node scripts/deploy-agents.mjs`."* A Manager task that edits an
agent and follows that instruction from the worktree installs an **unmerged,
unreviewed** definition for every project on the machine, and the next session
Karl starts anywhere loads it.

**Decision: `deploy-agents.mjs` is not run from inside a worktree.** It runs
from the main tree, after the merge. That sentence goes in `CLAUDE.md` directly
beside the existing deploy instruction, because that instruction is where the
reader already is when the mistake becomes available.

### Decision 8 — `EnterWorktree` joins Manager's grant, and no specialist's yet

`agents/synapse-manager.md`'s current line, verbatim:

    tools: Agent(synapse-architect, synapse-planner, synapse-coder, synapse-reviewer, synapse-art-director, synapse-artist, Explore), SendMessage, TodoWrite, Bash

Neither tool is there. `CLAUDE.md`'s hard rule — *"Nothing half-built ships in an
agent definition… Every emitted field and every granted tool needs a path by
which it gets used. Before adding either, name that path"* — requires the
consumer be named, so:

| Grant | Named consumer | Where |
|---|---|---|
| `EnterWorktree` | Manager's own new first step, before the anchor | Decision 1 |
| ~~`ExitWorktree`~~ | ~~Manager's amended stewardship step~~ | **DROPPED — see below** |

> **`ExitWorktree` is NOT granted. An audit killed it on 2026-08-29, on this
> record's own rule.**
>
> **Its consumer was unreachable.** The tool's documentation says *"Do NOT call
> this proactively — only when the user asks."* A stewardship-stage call is
> proactive by definition, so the named consumer was a use the tool forbids —
> exactly the "dead grant" `CLAUDE.md` requires be deleted rather than shipped.
>
> **And it bought nothing.** `EnterWorktree` already states: *"On session exit,
> if still in the worktree, the user will be prompted to keep or remove it."*
> The safety property Decision 5 wanted is the harness default.
>
> **Worse, it would have broken the isolation.** Stewardship runs *per task* —
> *"runs on every `APPROVED`"* — while `EnterWorktree` runs **once**, at session
> start. A two-task session would have run task 1 in the worktree, exited to the
> shared tree, and run **task 2 onward exactly where the isolation was supposed
> to prevent it** — reported as success by every check, because every check
> would have been looking at the wrong tree.

**`EnterWorktree` is wired by prose in the same change that adds it.** It is not
scaffolding for a later record, and no second tool is held in reserve.

**Do not add `EnterWorktree` to any specialist *yet* — but do not rule it out.**
Coder, Planner, Reviewer and Architect never switch directories today, and
whichever directory they inherit is the one they work in. **That is the whole
unresolved question in §4** — and if it resolves the wrong way, granting
specialists `EnterWorktree` is the documented fallback, not a redesign:

> *"Switching with `path` also works … **from agents whose working directory was
> pinned at launch** (subagent isolation or explicit cwd) … from a pinned agent
> the switch only affects this agent, not the parent session."*

**That route needs no `cwd` parameter on the `Agent` tool**, which is what §4.2
worried about. An earlier draft of this decision ruled specialists out
unconditionally; that foreclosed the cheapest fallback sight-unseen.

> **The grant may be cosmetic, and it is added anyway.** Manager's own file
> records the limitation: the `tools:` line *"only restricts which nested
> subagents Manager can spawn when Manager itself is run as the top-level
> `--agent synapse-manager` session — it does not block Manager's own access to
> Read/Write/Edit/Bash/etc. in that mode."* The same note's conclusion is the
> standing rule here: *"Treat every `tools:` line as intent, not as a
> guarantee, and the prose constraints as the real boundary."* The grant states
> the intent; Decision 1's prose is the mechanism.

---

## 3. What changes, and where

Five files. None of them is code.

| # | File | Change |
|---|---|---|
| 1 | `.gitignore` | add `.claude/worktrees/` — **Decision 3** |
| 2 | `agents/synapse-manager.md` | `tools:` line gains **`EnterWorktree` only** — **Decision 8** |
| 3 | `agents/synapse-manager.md` | new first step: `EnterWorktree` **before** `git rev-parse HEAD` — **Decision 1** |
| 4 | `agents/synapse-manager.md` | stewardship (c) counts against `master`, offers merge not push, and names the branch in the final line — **Decisions 4, 5**. **No `ExitWorktree` step**: stewardship is per-task, and exiting there would end the isolation after task 1 |
| 5 | `agents/synapse-manager.md` | Bash grant note: `git rev-list --count master..HEAD` is state, and `git merge` is still forbidden — **Decision 5** |
| 6 | `CLAUDE.md` | the `worktree.baseRef: head` setting; the commit-before-dispatch precondition; the "never deploy from a worktree" line — **Decisions 2, 7** |

Then `node scripts/deploy-agents.mjs` **from the main tree**, and restart the
session — agent definitions load at session start, and an un-restarted Manager
is running the old text.

---

## 4. Open, not decided here

### 1. ~~Whether a dispatched subagent inherits Manager's worktree.~~ **RESOLVED 2026-08-29 by measurement — it does.**

> **Measured, not reasoned.** A session entered a worktree with `EnterWorktree`,
> dispatched a plain `Agent` with no `cwd` and no isolation flag, and asked it to
> report three things. Results, verbatim:
>
> | Probe | Result |
> |---|---|
> | `pwd` | `/e/Synapse/.claude/worktrees/probe-inherit` |
> | `git rev-parse --show-toplevel` | `<synapse>/.claude/worktrees/probe-inherit` |
> | **Write at the relative path `probe-marker.txt` landed at** | `/e/Synapse/.claude/worktrees/probe-inherit/probe-marker.txt` |
>
> **The third row is the one that mattered.** `pwd` only proves where the
> specialist's *Bash* runs; the design depends on where its *Write* lands. Both
> are inside the worktree.
>
> **So the design is not inverted, and Decision 8's fallback is not needed.**
> Specialists need no `EnterWorktree` grant and the `Agent` tool needs no `cwd`
> parameter. The worktree was removed afterwards and the repository verified
> byte-identical to its pre-test state: same `HEAD`, single worktree, single
> branch, `git status --porcelain` diffing clean against a saved baseline.
>
> **Two things the test found that this record did not predict:**
>
> 1. **Isolation enforcement refuses compound commands.** An ordinary `&&` chain
>    with a loop was rejected — *"too complex to verify that it stays inside the
>    worktree"* — not for doing anything wrong, but for not being *provably*
>    safe. **Manager works in plain single commands inside a worktree**, which is
>    a real cost for a stewardship stage that runs several `git` checks, and it
>    is not budgeted anywhere else in this record.
> 2. **The empty `.claude/worktrees/` directory survives `ExitWorktree(remove)`.**
>    Git does not track empty directories, so `git status` reports a clean
>    reversal while the directory is still on disk. It had to be removed by hand.
>    Decision 3's gitignore entry makes this harmless — but without that entry,
>    every Manager run would leave a residue that looks like nothing happened.

**This is not a detail. If the answer is no, this record's design is inverted:**
Manager sits in a clean worktree running stewardship checks that all report
success, while Coder writes every file into `<synapse>` — the exact tree the
isolation exists to protect — and Reviewer reads the wrong one.

Two attempts to measure it from this seat were refused by the harness. Both
refusals are quoted because both carry information:

> *"EnterWorktree cannot create a worktree from a subagent with a cwd override
> (isolation: "worktree" or explicit cwd) — it would mutate the parent session's
> process-wide working directory. To work in a different directory (including a
> worktree), spawn an Agent with `cwd` set to it."*

> *"Cannot enter worktree: the current working directory <synapse> is the
> repository root, not an isolated worktree — switching is only available to
> sessions whose working directory is inside a worktree of this repository."*

The first says the switch is **process-wide for the session**, which makes
inheritance likely. **Likely is not measured**, and the same sentence names two
mechanisms by which a subagent's directory is *pinned* instead of inherited.
`EnterWorktree`'s documentation describes switching *from* a pinned agent but
never states the default for a plain `Agent` dispatch made by a session that has
entered a worktree.

**The one-turn verification, to be run before anything else in §3 is acted on.**
Launch `claude --agent synapse-manager`. Have it `EnterWorktree`. Then dispatch
any specialist with one instruction and nothing else:

    run `pwd` and `git rev-parse --show-toplevel`, then create a file at a
    RELATIVE path and report its absolute location, then delete it. Report all
    three. Do nothing else.

> **The third step is not padding — without it the probe measures the wrong
> thing.** `pwd` reports where the specialist's **Bash** runs. What actually
> matters is where its **Write and Edit** land, and those are not obviously the
> same: Manager hands Coder plan paths *as text*, so an absolute main-tree path
> in a dispatch prompt writes to the main tree from a specialist whose `pwd` is
> the worktree. A probe that only checks `pwd` can come back "inherits" while
> every file still lands in the shared tree.

- Answer is the worktree path → this record holds; proceed with §3.
- Answer is `<synapse>` → **stop.** This record is wrong at the root, and the
  design has to move to a per-dispatch `cwd` on every `Agent` call, which is a
  different and larger change touching every dispatch site in Manager.

### 2. Whether the `Agent` tool actually accepts a `cwd` parameter

The harness's own error text above says *"spawn an Agent with `cwd` set to it"*.
`cwd` does **not** appear in the `Agent` tool schema this session was given,
which lists `description`, `prompt`, `subagent_type`, `model`, and `isolation`.
Either the schema is trimmed for subagents, or the error text names a parameter
that is not reachable. This matters only if item 1 comes back the wrong way —
but if it does, this is the whole fallback, so settle it in the same turn.

### 3. `isolation: "worktree"` on the `Agent` tool is **not** the simpler option it looks like

The `Agent` tool's own description offers `isolation: "worktree"` — *"gives the
agent its own git worktree (auto-cleaned if unchanged)."* Named here so the next
reader does not adopt it by mistake. It puts **each specialist** in its **own**
worktree, which breaks the pipeline outright: Planner writes a plan into a tree
Coder cannot see, and Manager's fingerprint check (`git hash-object <path>`)
runs against a path that does not exist in its own tree. The pipeline needs one
worktree shared across the run, which is what `EnterWorktree` on the session
gives.

### 4. Who runs the merge, and on what trigger

Decision 5 establishes it must run with `cwd` = `<synapse>` and that Manager
cannot run it. It does **not** settle which of three does:

- Karl, by hand, when he next looks at the repository;
- a `synapse-coder` dispatched with `cwd` set to the main tree — depends on item 2;
- a `synapse-coder` dispatched by the *brainstorm* session, which is already there.

The right answer depends on how often the sibling tree is dirty on paths the
merge touches, which is the stall case in Decision 5's table and has not been
measured over any window.

### 5. A resumed Manager session, rather than a fresh one

Decision 1 orders `EnterWorktree` before the anchor. A session resumed with
`--continue` or after a compaction has an anchor already, possibly taken in the
main tree, and may or may not still be in its worktree. Nothing here works that
through. It is the same shape as the existing rule that a handoff cannot be
taken by Manager, and probably resolves the same way, but it is not resolved
here.

---

## 5. What this record does not change

- **The `Session:` trailer** — neither its two values nor its mechanism.
  Decision 6 argues it forward rather than assuming it. `specs/2026-08-25-session-attribution-design.md` §4 stands.
- **The never-`git add -A` rule.** It is nearly free, and it still guards the one
  step that runs in the shared tree — the merge.
- **Any code.** `commit-task.mjs`, `hot-files.mjs`, `orchestrator-boundary.mjs`,
  `verify-install.mjs`, `investigation-window.mjs`, `prompt-record.mjs` and
  every file under `watcher/src/` are untouched. Decision 7 is a survey with one
  finding, and the finding is answered by a `CLAUDE.md` sentence, not a patch.
- **Watcher's card behaviour.** `isCwdInsideRepo` already handles a worktree cwd,
  by a property it documented for a different reason.
- **The brainstorm session.** It stays in `<synapse>` on `master` and does
  nothing differently. All of the cost of this change lands on the pipeline
  session, which is the one that can be told what to do in a file.
- **Any specialist agent definition.** The grant in Decision 8 is Manager's
  alone.
- **`CLAUDE.md`'s scope boundary.** A worktree of this repository is still this
  repository; entering one is not entering another repo, and the read-only rule
  on `<consumer-repo>` is unaffected in both directions.
