# Synapse — what this is and why

The comprehensive version. `README.md` is the reference card: where things live,
what to run, what will bite you. This file is the explanation — what Synapse is
for, how the pieces fit, what has been decided and why, and what is actually
left to do.

If you are picking this up cold, read this first, then `README.md`, then
`specs/composition-root-seams-pattern.md`.

---

## In one paragraph

Synapse is a version-controlled set of seven Claude Code subagent definitions —
a small development studio of specialists — plus the design work behind making
several of them run at once without trampling each other. It publishes those
agents to `~/.claude/agents/`, where every project on the machine picks them up.
It is not a framework, not a running service, and not something you install into
a project. It is definitions, decisions, and a handful of small scripts.

## The problem it exists to solve

Three things drove it, in order of how much they cost:

**1. The agents had no version control.** They lived in `~/.claude/agents/` with
`.bak` files as the only rollback. An edit that made an agent worse was
unrecoverable except by memory. Everything else here is downstream of fixing
that: once the definitions are in git, they can be reviewed, reverted, and
carried to another machine.

**2. Work was serial when it did not need to be.** One task at a time,
planner → coder → reviewer. Art, combat, camera, and class-system work are
genuinely independent and could run concurrently — but every attempt collided.

**3. The user was being made the conflict detector.** When two streams touched
the same file, the system asked which should win. That is the system's job.

## How it works today

**Deploy mode.** Synapse publishes; it does not reach out. You edit an agent
here, run `node scripts/deploy-agents.mjs`, and it lands in `~/.claude/agents/`.
Then you open a session **rooted in the project you want to work on** and the
agents are there. Synapse never writes into another project — see *Deploy, not
control plane* below for why that is a consequence rather than a rule.

**The studio.** Seven agents in two paths:

- **Code path** — `synapse-manager` optionally dispatches `synapse-architect` first (only when
  the task admits two or more structurally different approaches; it returns a
  decision path, not a plan), then `synapse-planner` (produces a plan, returns a path
  and a ten-line abstract), then `synapse-coder` (implements it), then `synapse-reviewer` (the
  gate, and the only agent that reads code in order to judge it). Reviewer can
  be dispatched under named **briefs** — `security` and `tests` — which add
  scope to the review without changing its verdicts. `synapse-architect` can also be
  pulled in **mid-flight**: if the same task's plan is rejected twice, that's
  treated as evidence of a missed fork rather than a one-off planning mistake,
  and manager dispatches `synapse-architect` before the task's third and final
  attempt, feeding it both rejected plans and reviewer's findings verbatim.
- **Art path** — `synapse-manager` dispatches `synapse-art-director`, which owns the style spec
  and reference exemplars and dispatches `synapse-artist`. Never dispatch `synapse-artist`
  directly; it expects context only `synapse-art-director` holds.

Manager never reads code, edits files, or produces art. It reads returned
summaries and nothing else. This is not fastidiousness — it is the documented
mitigation for the failure mode that kills orchestrators, and it is the single
most important line in `agents/synapse-manager.md`. See *Adopt orchestration; do not
build it* below.

## The three ideas

Most of the value here is three decisions, each of which took a while to reach
and one of which reversed an earlier position.

### 1. Deploy, not control plane

**Synapse publishes agents; it does not dispatch work into other projects.**

The rejected alternative was a control plane: sit in a Synapse session and
drive work in any repo on the machine. It was seriously considered and is
genuinely attractive. It was rejected because the working safeguard is the user
reviewing each proposed change — which holds for direct edits but *not* for a
dispatched `synapse-coder` writing a batch of files in a worktree. The mode with the
largest reach would have had the least oversight.

The useful consequence: "a Synapse session never writes to project X" stops
being a special-cased prohibition and becomes simply what deploy mode means. It
generalises to every future project at no cost.

Reading and writing were deliberately unbundled. Synapse may *read* every
project — that is how the detector works — it just never writes.

Full argument: `specs/2026-08-23-stream-orchestration-design.md` §16.

### 2. Adopt orchestration; do not build it

**The custom parallel-orchestration layer was designed, then abandoned.**

Sections 3–10 of the orchestration spec describe a registry, a dispatch rule,
footprint declarations, batch planning, and direction checks. Nearly all of it
now ships in Claude Code: worktree isolation with enforced checks, dynamic
workflows, agent view, and agent teams with a shared task list, mailboxes,
dependency tracking, and file-locked claiming.

Two findings came out of the survey and both are worth carrying:

**Manager is not obsolete — it is the standard pattern.** One lead plus three
to five specialists is what the field converged on, including Anthropic's own
research system. The known failure mode is the lead accumulating context from
every worker until it degrades. Manager's "read only the summaries, never the
work" discipline is the textbook mitigation, and it was already there.

**Orchestration was never the blocker.** Agent teams do not isolate teammates
in worktrees; the instruction is to partition work so each teammate owns a
different set of files. A codebase with hot composition roots cannot do that.
Multi-agent only wins when the work decomposes into independent threads — so
the constraint is decomposability, not coordination.

Full argument: same spec, §17.

### 3. Composition-root seams — the one original contribution

**The techniques are old; the reason for applying them is not.** Every
*agent-orchestration* tool in this space isolates agents — separate worktrees,
separate branches, merge at the end — and none of them restructure your code so
that collisions stop happening. But the restructuring itself is well-trodden
ground: Open/Closed, plugin registries, Test Data Builder, and change-coupling
analysis from version-control history all predate this by decades, and
Tornhill's work applies the same detection to the same problem with human teams
as the parallel workers. See the *Prior art* section of the seams spec, which
maps each move to its established form.

What survives as original is narrower and load-bearing: that literature
motivates the work by **human** cost — merge pain, coordination overhead,
onboarding. The claim here is about **machine** parallelism, where seams are a
precondition rather than a quality improvement. A human team negotiates a
contended composition root in a chat channel. Parallel agents have no channel.

In most codebases a handful of files are touched by nearly every feature: the
composition root, the update/tick pipeline, the render path, the primary state
constructor, and raw literals duplicated across test fixtures. Any file-level
conflict check finds that every stream collides on these, queues them all onto
one owner, and serialises the work again — behaving correctly and buying
nothing.

The shared edit cannot be removed; new work has to reach the running program
somehow. It can be **demoted**: from "rewrite this function" to "append one
line to a list." Append-only lists merge cleanly. Rewritten pipelines do not.

Two of the five shapes are **not** mechanical, and the spec is emphatic about
it — an update pipeline is often a data flow rather than a step sequence, and a
render path may have more than one transform pass, which makes its layers
non-interchangeable. A naive registry can be worse than the hardcoded version
it replaces. Both failure modes were found in real code *after* the pattern was
first written.

Full pattern: `specs/composition-root-seams-pattern.md`.

## The tools

**`scripts/deploy-agents.mjs`** — copies `agents/*.md` to `~/.claude/agents/`
and the orchestrator boundary hook (below) to
`~/.claude/hooks/synapse-orchestrator-boundary.mjs`, two artifact kinds
sharing one ownership manifest and one refuse-to-overwrite guard. Compares
byte-for-byte to report drift, creates either target directory when absent,
and warns about the subdirectory-shadowing trap that once cost hours. A
successful deploy that leaves the hook in place prints the settings fragment
to register it — see `adoption/boundary-hook.md`. Runs on Windows, macOS and
Linux; `scripts/deploy-agents.test.mjs` covers it.

**`scripts/verify-install.mjs`** — confirms an install is wired correctly:
definitions valid and deployed, nothing shadowing them, the boundary hook
deployed and (once registered) recording, and the test fixture still carrying
its planted defects. It deliberately stops short of dispatching anything,
because whether the pipeline exercises *judgment* correctly is graded by a
human against an answer key, not asserted. See `docs/VERIFYING.md`.

**`scripts/orchestrator-boundary.mjs`** — a `PreToolUse` hook that **measures
the orchestrator boundary and never enforces it.** Manager's definition says it
never reads code or edits files, and its `tools:` line appears to guarantee
that — but the same file documents that the grant is prose-only when Manager
runs as the top-level `--agent` session. This records what an enforcing version
*would* have denied, then exits 0 and writes nothing, so it cannot affect a
call. It logs outside the repo, to `~/.claude/synapse-orchestrator-boundary.jsonl`
or `$SYNAPSE_BOUNDARY_LOG`. It is deployed and registered **machine-wide** —
`node scripts/deploy-agents.mjs`, then a one-time paste into the user-scope
`~/.claude/settings.json` — so it covers every repository on the machine,
including consumer repos and ones that do not exist yet; see
`adoption/boundary-hook.md`. Set `SYNAPSE_BOUNDARY_OFF` to disable it without
touching the registration.

It stays an observer because the discriminator is not yet sufficient:
`agent_type` arrives only inside a subagent, so a session running as
`--agent synapse-manager` and an ordinary session are indistinguishable in the
payload. Turning it into a gate is a change to one function, `decide()`.

**`scripts/commit-task.mjs`** — commits one completed task. It cannot sweep the
tree; it stages only the paths handed to it and refuses any argument that would
expand past them. It also refuses a named path with no changes, reports modified
files it was *not* given rather than absorbing them, never invents a `Session:`
value, and reads the trailer back out of git afterwards — because text sitting
in a message and a trailer git actually parsed are different claims. Timing is
not its business: *when* to commit is a rule in `agents/synapse-coder.md`.

**`scripts/hot-files.mjs`** — finds files that are becoming composition roots.
Its only input is git history, so it runs against any repository with no setup
and no project knowledge. The heuristic: a composition root is not merely a
file that changes often, it is one that changes *alongside everything else*, so
results rank by **co-change breadth** rather than commit count. A busy leaf file
scores high on frequency and low on breadth; a composition root scores high on
both. Docs and lockfiles are excluded from the ranking by default and reported
separately — they are real collision points but want a different remedy than a
registry. Alongside breadth it reports **coupled breadth** — the partners that
recur across two or more commits — which is not ranked on but exposes a file
whose breadth came from sitting in a few wide commits rather than from genuine
co-evolution.

It was validated against the game repo, which it knows nothing about. All three
primary refactor targets of the hand-written seam plans land in the **top six**
— `src/render/draw.ts` at #2, `src/sim/world.ts` at #3, `tests/sim/world.test.ts`
at #6 — reproducing from git history a list originally derived by reading code
by hand. **`src/main.ts` ranks #1 and no plan covers it.**

Use it as a monitoring tool, not a one-shot. New composition roots keep
appearing as a project grows — persistence, audio, a UI root, networking — and
the point of generating the list is that it cannot go stale.

## What is settled

Recorded so it is not re-litigated. Each has its full reasoning in the specs.

- Deploy mode over control plane. Revisit only with a real cross-project need.
- Adopt the platform's orchestration. Do not build a registry, dispatch rule,
  or supervisor.
- Keep Manager unchanged. Porting its code path to a dynamic workflow is
  optional and worth doing **only if** the hang and orphan failures recur.
- Integration review is the existing `synapse-reviewer` under a second brief, not a
  seventh agent. Security review and test-quality review follow the same rule —
  they are `synapse-reviewer` briefs, not agents. The brief mechanism now exists, so
  integration review is a list entry when it lands.
- **New capability gets an agent only when it occupies an empty phase.**
  `synapse-architect` earned one because nothing ran before planning. `tdd-guide`,
  `security-reviewer`, `doc-updater` and `build-error-resolver` did not: their
  work either splits across existing agents or is already covered by the
  stewardship stage. See
  `specs/2026-08-24-pipeline-specialists-design.md`.
- Agent teams stay **project-scoped**. Setting the flag globally converts
  Manager's dispatches into fire-and-forget teammates and reintroduces the
  orphaning failure machine-wide.
- All seven agents pin explicit model IDs rather than tier aliases.

## What is actually left

Status as of 2026-08-24. Ordering of the seam plans is fixed by risk. Items 1-3
are game-repo work and **must happen in a session rooted in that project, not
here**; item 4 is Synapse-side.

1. **Finish the three seam plans.** Two of three are done and committed:
   - `test-state-factory` — **done**, `3bd5f51`.
   - `tick-system-registry` — **done**, `99c4d60`. `tick()` now reduces over an
     ordered `SYSTEMS` registry; twelve systems extracted to
     `src/sim/systems/`. Suite 30 files/418 tests → 32/425, `tsc --noEmit`
     clean. It left one gap open — see item 2.
   - `draw-layer-registry` — **the only one outstanding**, and the riskiest: no
     existing coverage, and the render path is the shape the spec flags as
     *non*-interchangeable.
2. **Enforce the tick registry's ordering constraints.** `src/sim/systems/
   index.ts` documents four load-bearing ordering rules in a comment, and no
   test asserts them. Two systems inserted at different points in the array
   merge with **no conflict and no failure** while silently violating one — a
   demonstrated case, not a hypothetical. This is now **acceptance criterion 5**
   of the seams spec — ordering constraints must be executable, not just
   documented — so the registry is incomplete until they land, rather than
   merely untested. Roughly ten lines of assertion. **Do this before
   `draw-layer-registry`**, where the same defect has worse consequences.
3. **A plan for `src/main.ts`.** The detector ranks it first — 14 commits, 72
   partners — and it is the sole production caller of both `tick()` and
   `draw()`. No plan covers it. Worth checking whether the registry seams are
   *displacing* contention into it rather than removing it.
4. **The reviewer's second brief** for integration review.

## Further out — live but undecided

Distinct from the list above. Those four items are decided work waiting on a
session. These are not decided, and some may never happen.

**Every entry carries the trigger that would make it live.** An item with no
trigger is a wish, not a plan, and does not belong here. If you find yourself
adding one without a trigger, that is the signal to leave it out.

### Deferred — wanted, blocked on something specific

**Agent teams.** Closes Manager's one real gap: peer-to-peer messaging, so
teammates coordinate without routing everything through the lead. Experimental
and disabled by default today.
*Trigger:* three to five genuinely parallel streams exist — which means after
the seams land. Below that the gap costs nothing, and adopting early would
break Manager to relieve a bottleneck we are not hitting.
*Constraint:* project-scoped only, never `~/.claude/settings.json`.

**A GUI.** Two wants that turn out to be the same one: §16's read-only
cross-project dashboard, and a visual board over parallel sessions. Nimbalyst
supplies the second today — MIT, free for individuals, genuine Windows build —
and a hand-built one remains open.
*Trigger:* multiple streams actually running. A board is a *view*, and there is
nothing worth viewing until there is something to watch.

**Manager's code path as a dynamic workflow.** Would make collection structural
rather than instructed — a script that awaits cannot orphan its children the way
a model's turn can.
*Trigger:* the hang and orphan failures recur. They have not been observed since
the sandbox era. Absent recurrence this is churn, and Manager is the standard
pattern already correctly built.

### Rejected, but the user wants to revisit it

**Control-plane mode** — Synapse-rooted sessions dispatching work into other
projects. Rejected in §16 for good reasons, the deciding one being that the mode
with the largest reach would have had the least oversight.
*Trigger:* a real cross-project need, and a different safeguard than "the user
reviews each proposed change" — because that is exactly what a dispatched
`synapse-coder` writing a batch of files in a worktree defeats. Intended as its own
project rather than a bolt-on. **Do not reopen it casually; the argument is
already written down.**

### Grows on its own

**Seams for composition roots that do not exist yet.** Persistence, audio, a UI
root, networking — each is a plausible future hot file, and each gets the same
pattern. The fix is never a new invention.
*Trigger:* the detector flags one. That is the entire point of generating the
list rather than maintaining it.

**Synapse pointed at a second project.** Everything here claims portability;
none of it has been tested against a second consumer. **No known game coupling
remains** — the hardcoded taxonomy went in `0f34334` and the presumed isometric
projection in `synapse-art-director.md` went after it. Inspection is clean: no
hardcoded paths anywhere, zero game vocabulary in `synapse-planner`/`synapse-coder`/`synapse-reviewer`,
and `synapse-reviewer` discovers the toolchain rather than assuming one. But that is
portability argued, not demonstrated, and a real second consumer would likely
find something inspection missed.
*Trigger:* an actual second project. Not worth doing speculatively — the
examples that look like coupling are often load-bearing failure evidence.
*Constraint:* the art path needs the PixelLab MCP server and produces pixel
art. In a project without it, `synapse-art-director` and `synapse-artist` are inert; the code
path is unaffected.

**Detector refinements.** One rough edge left: `--min` is an absolute count
whose *meaning* changes with window size (3 of 93 commits is a low bar; 3 of 11
is noise). Fixing it means picking a ratio, which is another guess — the
change-coupling literature cited in the seams spec has empirical thresholds
worth consulting first.
*Trigger:* it produces misleading output in real use.

Path filtering **was** the other rough edge and is now fixed. Docs and
lockfiles were taking three of the top six rows against the game repo, crowding
out the real targets. They are excluded from the ranking by default and
reported below the table instead of dropped, because the original reasoning
still stands: a coordination doc touched by every feature genuinely is a
collision point, it just wants a different remedy. `--exclude <regex>` adds
patterns; `--no-default-excludes` restores the old behaviour.

## What this is not

- **Not an orchestrator.** That decision is made; the platform provides it.
- **Not a framework or a dependency.** Nothing imports Synapse.
- **Not a place that edits other repos.** It reads them and publishes to a
  shared directory. That is the whole interface.
- **Not a good candidate for its own medicine.** Synapse is design work — one
  person writing documents serially. It has no parallel streams to deconflict,
  and the seams pattern does not apply to it. Running the detector here is a
  dogfood, not a diagnosis.

## Finding your way around

| Want to know | Read |
|---|---|
| Where things live, what to run | `README.md` |
| Why the seams pattern exists and how to apply it | `specs/composition-root-seams-pattern.md` |
| Why orchestration was adopted rather than built | orchestration spec §17 |
| Why Synapse never writes to other repos | orchestration spec §16 |
| Something broke and I have seen this before | `docs/LESSONS.md` — indexed by symptom |
| What the last session did and what is next | `HANDOFF.md` — newest entry first |
| Sandbox-era history, pre-git | `docs/history/genesis.md` — archive, not continuity |

Note that the orchestration spec's §§3–10 are superseded. Its header says so;
read §17 before them or you will implement something that was abandoned.
