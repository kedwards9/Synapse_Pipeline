# Stream Orchestration — design spec

**Date:** 2026-08-23
**Status:** SUPERSEDED IN PART — see §17. The problem statement (§1-§2) and the
seams dependency (§12) stand. The orchestration machinery in §§3-§10 was never
built and will not be: those capabilities now ship in Claude Code, and §17
records what was adopted instead. Read §17 before §§3-10.
**Home:** the Synapse repo itself (git). Earlier drafts of this file lived in
`<sandbox>`, a scratch directory that was never a git repo; that location is
historical and no longer authoritative.

**Companion spec:** `composition-root-seams-pattern.md`. That one is
a prerequisite — see Dependencies.

---

## 1. Goal

Let many work streams (art, combat, camera, class system, ...) run at once,
with the system detecting collisions itself and routing colliding work to the
stream that already owns those paths — rather than spawning a second agent
onto the same files and asking the user to arbitrate.

**Portability is a first-class requirement.** This is intended to be reused on
future projects, not just the current game. Nothing in this design may encode
game-specific knowledge: no hardcoded file lists, no game vocabulary. It reads
only git history, plan footprints, and its own registry.

## 2. What is being fixed

Two observed failures, both traced to the same root cause — a single Manager
session holding orchestration state in its own context:

1. **Manager hangs** waiting for work it owns to finish.
2. **Manager cancelled all subagent tasks.** This is the orphaning failure
   already documented in the user's `agents.md`: when a parent's turn ends,
   its children die and their results are lost.

A third constraint, established in conversation: the user must not be the
conflict detector. The system knows what collides; it does not ask.

## 3. Core decision — a protocol over files, not a supervisor process

**Manager stops owning work.** State lives on disk in a registry. Manager
reads it, routes, and returns immediately. Nothing supervises anything, so
nothing can hang on or cancel anything.

Consequences that fall out of this, and which are the point:

- A stream dying leaves its claim in a file, not in a dead session's context.
  Recovery is reading the file.
- Nothing is the parent of anything, so there is no tree to collapse.
- Multiple sessions can coexist without a coordinating process.

## 4. The registry

One file, the single source of truth.

```
stream-id
  status:     working | awaiting-review | blocked | merged
  worktree:   path + branch
  owns:       declared path footprint
  queue:      tasks waiting on this stream
  claimed-at: timestamp (for staleness)
```

`blocked` is a required status, not a nicety: a silently stuck stream is worse
than a failed one, because it holds its claim and serialises everything behind
it invisibly.

**Stale claims need a release condition.** A crashed stream otherwise holds its
paths forever. Claims release on merge or on explicit release, and the registry
surfaces claim age so a zombie is visible rather than inferred.

## 5. Footprint declaration

**Planner gains one required output: the set of paths its plan will touch.**

Planner already reads the codebase and already writes plans to disk, so this is
a small addition — and it is the data every other mechanism in this spec runs
on. Without it, nothing here works.

## 6. Dispatch rule

New task arrives → planner runs → footprint compared against every `owns` in
the registry:

- **No overlap** → new stream, its own git worktree and branch, runs
  independently.
- **Overlap** → the task is appended to the owning stream's `queue`. That
  stream picks it up when it finishes its current task.

This is the user's stated requirement — "put it into the queue of another
subagent that's already running" — made mechanical. No human judgment.

## 7. Batch planning

Planner is read-only, so **planning is the most parallel-safe stage**. N
planners reading one codebase do not collide; they need only distinct plan
filenames, which the stream id supplies.

**Fan planners out as a batch and route with all footprints in hand.** Planning
five tasks at once reveals that tasks 2 and 4 collide *with each other* before
either starts — routing one at a time cannot see that. Batch planning gives
strictly better arbitration.

Fan-out is safe here specifically because planning is short: the dispatching
session stays alive through it and collects results, satisfying the Delegation
Completion Contract in the user's `agents.md` (the parent waits and integrates
rather than ending its turn on running children).

### Known cost — queued plans go stale

A plan queued behind a stream was written against a codebase that stream is
about to change. On reaching the front of the queue it may need **re-planning,
not just execution**. The registry must mark a queued plan as needing
revalidation once the stream ahead of it merges.

This is the `tick()`/`featureFlags` problem the game repo already hit, moved
from merge time to plan time.

### Known cost — planning is not free

Routing cannot be decided until a planner has read the code, so every task pays
a planning step before it can be parallelised. With planner on Opus at high
effort, **budget is the practical ceiling on concurrency, not architecture.**

## 8. Review batching

Established constraint: review sessions must be **substantial**. Being pulled
in to judge one small change ("I removed the club from the goblin, go look") is
worse than useless — review has fixed overhead, and below some batch size the
overhead exceeds the value of the feedback.

**Nothing pulls the user in.** The registry tracks what is parked and makes the
size of the pile visible. The user calls the session. Review bandwidth is the
user's own time; the system does not get to schedule it.

**A review session is one build plus one checklist.** Parked streams merge to a
`review` branch which builds; the user plays one build containing everything
ready. Items are judged independently but *experienced together* — which is
where feel problems actually live. A camera that is fine alone can be wrong
with new art in front of it.

**The checklist is the real deliverable.** Each line carries four fields:

| Field | Purpose |
|---|---|
| What changed | one line |
| What to do to see it | concrete — "walk north into the hills", not "check the terrain" |
| What to judge | the actual question being asked |
| What the stream expected | so the user confirms or contradicts a stated claim |

The fourth field is what removes "go see if it's okay" — the user is not
reverse-engineering what to look for.

Each item resolves to **accept / reject-with-note / defer**. Accept merges to
master. Reject returns to the owning stream with the note attached. Defer stays
parked.

**Merge conflicts between parked branches must be surfaced, never quietly
resolved.** A conflict at merge time means the footprint system failed, and
that is information the user needs.

## 9. Direction checks — gate by risk, batch by review cost

Not all work carries equal risk of being wrong. Mechanical work needs a
checklist line, not a gate. Work that is subjective and expensive to redo needs
an early cheap look.

The cheap artifact differs by medium:

- **Art:** the image. Already generated; showing it costs nothing.
- **Code:** the plan, *not* the result. There is no cheap visual for code —
  producing one means building and running, which is the expensive path being
  batched. Planner already returns a ~10-line abstract and Manager already
  smell-tests it; for high-risk work that abstract goes to the user instead.
  Ten seconds of reading, before implementation.

## 10. Hot-file detection

The collision set grows as the project grows. **The user should not discover
this by collision.** A hand-maintained touchpoint table goes stale exactly when
the project is busiest.

Since footprints are declared anyway, count them: **any file appearing in 3+
recent or concurrent footprints is flagged as becoming a composition root and
wants a seam.** The touchpoint table stops being maintained and starts being
generated.

Threshold rationale: two plans occasionally touching a file is normal; three or
more *concurrent* is what costs time.

Portable — reads only git history and plan footprints.

## 11. Agent definition changes required

| Agent | Change |
|---|---|
| planner | Emit a declared path footprint alongside the plan path and abstract |
| manager | Becomes a stateless router: read registry, route, return. Stops owning work, stops waiting on it |
| reviewer | Unchanged in role; still the gate, now per-stream inside its own worktree |
| coder | Unchanged |

**Integration review is an open question** — reviewer validates a stream inside
its own worktree, but integration problems appear at merge. See §13.

## 12. Dependencies

**The seam refactor is a prerequisite, not an optimisation.** Five files in the
current game codebase are touched by nearly every feature. Without seams, the
dispatch rule in §6 would find that every stream collides, queue them all onto
one owner, and serialise the work again — behaving correctly and buying
nothing.

The seam work must land first, alone. See the companion spec.

## 13. Resolved decisions

- **Registry file format: JSON.** Machine-writable and diffable. Markdown was
  considered for readability and rejected — this file is written and read by
  machines far more often than by a person.
- **Who runs a stream: one Manager session per stream, launched by the user.**
  A dispatcher that spawns streams as background subagents is rejected — it
  rebuilds the exact orphaning failure in §2, where children die when the
  parent's turn ends. **The single pane of glass comes from the registry, not
  from a supervisor**; visibility is reading state, supervision is owning
  processes, and this design deliberately separates them. Any session can read
  the registry from anywhere.
  *Deferred alternative:* a launcher that starts **detached OS processes**
  rather than subagents would give one entry point with full crash isolation.
  It is an ergonomics win, not a correctness one, and should not be built
  before the protocol is proven.
- **Footprint granularity: file-level.** Directory-level is safer but coarser
  and would serialise more, defeating the purpose. **This choice takes on a
  known risk** — see interface drift in §14 — which is why integration review
  is mandatory rather than optional.
- **Integration review is run by the existing `synapse-reviewer` agent under a second,
  distinct brief** — not a separate `integrator` definition. Reviewer already
  has the code-reading tools and the typed-verdict vocabulary, and is already
  Opus 5 / high. A seventh agent would add a definition and a deploy surface to
  keep in sync for no capability reviewer lacks. The brief must be explicitly
  scoped to the three merge-time classes in §14, since the per-stream gate and
  the merge gate ask different questions.
- **Operating model: deploy, not control plane.** Synapse publishes the agent
  definitions and you work inside the target project; Synapse-rooted sessions
  never write to another repository. A control plane that dispatches work into
  other projects is rejected — see §16 for the full argument and for the
  read-only dashboard that replaces it.
- **Home: a dedicated git repo, holding the agent definitions and these specs
  together.** The agent definitions in `~/.claude/agents/` are currently
  version-controlled nowhere (flagged as a risk in Handoff #4; `.bak` copies
  are not a substitute). One repo fixes the spec's home and that gap at once,
  and is what makes the system portable to the next project.

## 14. Integration review — required

Reviewer validates one stream inside one worktree, on top of whatever base it
branched from. Three classes of problem appear at merge that no per-stream
reviewer saw:

1. **Semantic conflicts that git merges cleanly.** Two streams each append a
   system to a seam registry. Git merges both lines without complaint — no
   conflict markers, nothing to resolve — but execution order is now wrong, or
   both mutate the same state field in one tick. Clean merge, real bug. This is
   the dangerous class precisely because nothing flags it.
2. **Interface drift.** Stream A changes a signature in a file A owns; stream B
   calls it from a file B owns. Footprints do not overlap, so §6 correctly ran
   them in parallel. The build breaks only after merge. **This is the gap that
   file-level granularity leaves open by design.**
3. **Behavioural interaction.** Both correct; the combination feels wrong.
   This one belongs to the user and is what §8's review session is for.

Classes 1 and 2 are code problems, not judgment calls, and must not consume a
review-session slot.

**The step:** after parked streams merge to the review branch, and *before* the
user is asked to look — full build and full test suite against the
**combination**, and reviewer inspects the merged diff with attention focused on
the seam registries, since that is where independent streams meet by design.
Failures return the responsible stream(s) to blocked before the user sees them.

The seams make this both necessary and tractable: integration review has a
specific place to look rather than an entire diff.

## 15. Remaining open questions

None outstanding for this spec. See Resolved decisions (§13).

**Carried as work, not as questions:**

- Narrow `agents/synapse-art-director.md`'s hardcoded
  `characters/monsters/items/spells` taxonomy so it does not assume the
  consumer is a game. Decided 2026-08-23; not yet done. The goblin anecdotes in
  `synapse-art-director.md`, `synapse-artist.md`, and `synapse-manager.md` stay as written — they are
  failure evidence, not coupling.

**Resolved since drafting:** repo name and layout — the home is the Synapse
repo, laid out per its `README.md`, and the sandbox-era log is archived at
`docs/history/genesis.md`. (`agent-backups/` moved in at the time and was
deleted on 2026-08-26; git supersedes it.) The deploy-versus-control-plane
question is settled in §16.

## 16. Operating model — deploy, not control plane

There are two ways this repo can serve another project. Only one of them
writes, and the write half is **explicitly rejected**.

### The two modes

**Deploy mode — chosen.** `scripts/deploy-agents.ps1` publishes the agent
definitions into `~/.claude/agents/`, which is machine-global. You then open a
session *rooted in the target project* and work there. Synapse builds and
publishes the workflow; it does not operate the workflow on your behalf.

**Control-plane mode — rejected for writes.** A registry in Synapse holding
stream state for several projects, with Synapse-rooted sessions dispatching
work into those projects through subagents.

### Why write-orchestration is rejected

**1. It inverts the user's visibility exactly where the blast radius grows.**
The working safeguard today is that the user sees each proposed change and can
stop it. That holds for direct edits, turn by turn. Control-plane work is not
direct edits — it is a dispatched `synapse-coder` writing a batch of files inside a
worktree, which is far less visible per-edit. The mode with the largest reach
would be the mode with the least oversight. That trade is backwards.

**2. Per-project configuration does not travel, and this has already cost a day.** MCP
servers, `CLAUDE.md`, hooks, and `settings.json` are per-directory. A
Synapse-rooted session driving another project loads *Synapse's* configuration,
not the target's. See the historical note in `agents/synapse-manager.md` — PixelLab was
registered at local scope, private to one project directory, and `claude mcp
list` run from the game project did not show it. That is the same failure class,
and control-plane mode would institutionalise it.

**3. Reviewer must build and run the target.** §14 requires a full build and
test suite against the merged combination, inside a worktree. From a session
rooted in the target project this is the native toolchain doing the obvious
thing. From Synapse it is a foreign toolchain invoked in a foreign tree.

**4. The need is speculative.** The motivating case for parallelism is several
streams inside *one* project. Simultaneous work across *different* projects is
not a problem currently held. Building the risky half before the need is felt
is speculative generality.

**Drift cannot be prevented reliably while writes are allowed.** Any
"which project am I bound to" check is an agent consulting a file before each
write. That holds almost every time; the failure case is an edit in the wrong
repository, which is precisely the outcome the constraint exists to prevent.
Removing write capability makes the guarantee structural rather than
behavioural.

### What replaces it — a read-only dashboard

Reading is safe; writing is not. The two were bundled together in discussion
and nothing requires them to ship together.

Synapse may **read** every project's stream registry and render a combined
view: which streams are working, blocked, or awaiting review, across all
projects, and how large the review pile is. This delivers the "single pane of
glass" §13 already asks for, without Synapse ever holding a write claim on
another repository.

Reading is not limited to registries. A Synapse-rooted session may read any
project's source — to inform a spec, to mine `docs/LESSONS.md` entries, to
compare patterns. The restriction is on writes alone.

### Consequences

- **The stream registry lives per-project**, beside the code it describes — not
  in Synapse. A crashed stream's claim is recovered from the project that owns
  it.
- **Footprints stay repository-relative.** No project key is needed, because
  claims are never compared across projects. Cross-project collision is
  impossible by construction: two projects share no files, so the filesystem
  already provides the disjointness §5 and §6 work to establish *within* a
  project.
- **The boundary rule becomes derivable rather than special-cased.** "A Synapse
  session does not modify project X" is not a per-project prohibition; it is
  what deploy mode means. It generalises to every future project at no cost,
  and Synapse is not an exception to its own rule — work on Synapse happens in
  a Synapse-rooted session, like everything else.
- **Genericising Synapse's game-flavoured content becomes live sooner.** Deploy
  mode publishes machine-globally, so every project on the machine receives the
  same six agents. `agents/synapse-art-director.md` hardcodes a
  `characters/monsters/items/spells` taxonomy, which assumes the consumer is a
  game. The `synapse-planner`/`synapse-coder`/`synapse-reviewer` core carries no such assumption and is
  already portable.

### Reversibility

This is deliberately the reversible direction. Deploy mode can later grow
write-orchestration if a real cross-project need appears, designed against
experience rather than anticipation. The opposite path — retrofitting
containment onto a system already writing everywhere — is the hard one.

---

## 17. Orchestration — adopted, not built

**Decision: adopt the platform's orchestration primitives and keep the existing
Manager. Stop designing our own.** Sections 4 through 10 are superseded as an
implementation target and retained only as a record of the reasoning.

This section was written after a survey of what exists, prompted by the right
question: *am I reinventing something?* Largely, yes.

### What was surveyed

Measured on Claude Code v2.1.221, Windows 11.

**First-party, already installed:**

- **Worktrees** — `--worktree`, `isolation: worktree` as one line of subagent
  frontmatter, four enforced checks that block a worktree-bound agent from
  writing the main checkout, automatic locking and stale-lock sweeps,
  `.worktreeinclude`. This is the isolation half of §5, solved and maintained.
- **Dynamic workflows** — a deterministic script holding the plan instead of a
  model's turn-by-turn judgment. Fan-out, pipelines, budget caps, resume.
- **Agent view** (`claude agents`) — dispatch background sessions, each
  auto-worktreed.
- **Agent teams** — experimental, disabled by default. A lead plus teammates
  with a shared task list, mailbox messaging, dependency tracking, and
  file-locked task claiming. This is §4, §6, §7 and §9, built.

**Third-party, rejected:**

- **Conductor** — macOS only.
- **Crystal** — deprecated 2026-02, succeeded by Nimbalyst.
- **Vibe Kanban** — Apache-2.0 and Windows-capable, but its vendor wound down
  in 2026-04 and handed it to the community. Do not adopt a sunsetting tool.
- **Claude Squad** — terminal/tmux-oriented; poor Windows fit.
- **Nimbalyst** — MIT, free for individuals, genuine Windows build, active.
  The only viable third-party option, and **deferred, not rejected** — see
  *Deferred: a GUI* below.

### Why orchestrator-worker is the answer everywhere

The field has converged on one lead plus three to five specialists. Anthropic's
own Research system is exactly that shape and beat single-agent Opus 4 by 90.2%
on their internal eval. Independent write-ups land on the same numbers: 3-5
workers per orchestrator, roughly one reviewer per 3-4 builders.

The shape exists to answer four failure modes:

1. **Orchestrator context overflow.** The lead accumulates context from every
   worker and past ~4 workers routinely exceeds the window. Context rot begins
   around 100k tokens — degradation has been measured at ~125k inside a 500k
   window. *Mitigation: the lead never ingests the work, only summaries.*
2. **Lead as single point of failure.** Misrouting compounds.
   *Mitigation: plan approval before code exists.*
3. **Lead as coordination bottleneck.** *Mitigation: peer-to-peer messaging.*
4. **Verification debt.** *Mitigation: reviewer ratios and WIP limits — never
   run more agents than can be meaningfully reviewed.*

**`agents/synapse-manager.md` already implements 1 and 2.** It never reads code, edits
files, or produces art; it reads only returned summaries; planner returns a path
and a ten-line abstract rather than the plan body; its Bash grant is repo state,
never repo content. That is the textbook mitigation for the failure mode that
kills orchestrators, and it predates this survey.

Manager does **not** implement 3. That is its one real gap, and agent teams are
what would close it.

### What this supersedes

- **§4 the registry** — superseded by the agent-teams shared task list.
- **§6 dispatch rule** — superseded by lead assignment and self-claim, whose
  claiming already uses file locking against races.
- **§7 batch planning** — superseded by the teammate plan-approval gate.
- **§9 direction checks** — superseded by the `TaskCreated`, `TaskCompleted`
  and `TeammateIdle` hooks, which reject with feedback on exit code 2.
- **§3's core decision** — "a protocol over files, not a supervisor process" —
  is **wrong in its conclusion, right in its diagnosis.** The diagnosis in §2
  (a single session holding orchestration state in its own context) is correct,
  and is the field's consensus failure mode. The conclusion is not: dynamic
  workflows *are* a supervisor process, and a script that awaits cannot orphan
  its children the way a model's turn can. The reason to avoid a supervisor was
  never that supervisors are wrong; it was that ours would have been.

### What survives

- **The composition-root seams pattern** — the companion spec. Untouched by any
  of this, and made *more* load-bearing by it. See below.
- **`agents/` — all six definitions.** They are reusable as workflow workers via
  `agentType`, and as agent-team roles, which honour a definition's `tools` and
  `model`. Note that `skills` and `mcpServers` frontmatter are ignored in
  teammate mode.
- **Manager, unchanged.** It is the standard pattern, correctly built. Porting
  its code path to a dynamic workflow would make collection structural rather
  than instructed, and is worth doing **only if the §2 hang and orphan failures
  recur.** They have not been observed since the sandbox era. Absent
  recurrence, the port is churn.
- **The art path.** `synapse-art-director` dispatching `synapse-artist` is judgment-heavy and
  iterative, and plain subagents nest where teammates cannot. Leave it.

### The binding constraint is decomposability, not orchestration

The survey's most useful finding is a caveat, not a tool. Anthropic's stated
lesson is that **architecture follows task structure: multi-agent wins only when
the work decomposes into independent parallel threads.** Where the work fits one
context window, a single well-prompted agent is simpler, cheaper and easier to
debug. Cost follows the same line — the orchestrator adds decomposition and
aggregation calls on top of every worker call, and token usage alone explains
roughly 80% of performance variance.

The platform states the requirement and supplies no mechanism for it. **Agent
teams do not isolate teammates in worktrees**; the documented instruction is to
partition the work so each teammate owns a different set of files, because two
teammates editing one file overwrite each other.

Partitioning is exactly what a codebase with hot composition roots cannot do.
**No orchestrator — native, third-party or ours — fixes that.** The seams
pattern does, which promotes it from a prerequisite of *our* design to the
missing prerequisite of a shipped feature.

**Consequence: orchestration was never the blocker. Decomposability is.** The
next work is the seams pattern and its detector, not this document.

### Agent teams — available, not adopted

Enabled by `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`. **Never set it in
`~/.claude/settings.json`.** While teams are on, a subagent the model *names*
launches as a teammate, and teammates return only an idle notification rather
than their output — so Manager's dispatches become fire-and-forget and the §2
orphaning failure returns machine-wide. Project scope only.

Not adopted yet, deliberately. Teams close the peer-messaging gap, and that gap
costs nothing below three to five genuinely parallel streams — which do not
exist until seams land. Adopting teams now would break Manager to relieve a
bottleneck we are not hitting.

Further limits, for when this is revisited: teams cannot nest, which flattens
manager → art-director → artist; in-process teammates do not survive `/resume`;
task status can lag and block dependents; one team per session.

### Deferred: a GUI

The read-only dashboard of §16 and a visual board over parallel sessions are the
same want. Nimbalyst supplies it today under MIT on Windows; a hand-built one
remains open. Neither is on the path — a board is a *view*, and there is nothing
worth viewing until multiple streams actually run.

### Reversibility

Adopting platform primitives is the cheap direction. Nothing here is written
into the codebase; the choice is only which existing tools get used. If agent
teams leave experimental and the peer-messaging gap starts to bite, they turn on
with one project-scoped variable. If the platform's shape stops fitting,
§§4-10 remain on record with their reasoning intact.
