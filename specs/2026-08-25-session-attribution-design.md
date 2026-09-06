# Session attribution — design spec

**Date:** 2026-08-25
**Status:** adopted
**Supersedes nothing.** Narrows §4 and §11 of
`2026-08-23-stream-orchestration-design.md` by recording why their
mechanisms are out of scope rather than merely unbuilt.

## 1. The problem

Two sessions work in one consumer repo at the same time:

- a **brainstorm** session — a plain session rooted in the consumer, reading
  code and talking with the user, producing design decisions and the prompts
  that later become manager tasks;
- a **manager** session — the pipeline, implementing what it was handed.

Neither knows the other exists. Each therefore reports the other's commits as
an anomaly:

- `synapse-manager.md` stewardship step (d) treats any commit it did not dispatch as
  "something outside this pipeline has been editing the repo";
- `/takehandoff` step 5 flags a moved `HEAD` as drift before doing anything
  else.

**Both rules are correct and both are firing on a legitimate sibling.** The
gap is not a missing agent or a missing lock. It is that Synapse models
exactly one legitimate writer per repo.

## 2. What this is not

It is tempting to read the symptom as a coordination problem and reach for
mutual exclusion — a staged design surface, a promotion gate, a freeze on the
artifact manager is implementing. That was proposed in the session that
produced this spec and **withdrawn**.

The workflow it would constrain is legitimate. Design runs *ahead* of
implementation; the user brainstorms the next thing while the pipeline builds
the last thing. That is a pipeline, not a race. During skeleton and framework
work the design is *supposed* to keep moving, and a promotion gate would be
pure friction with nothing bought.

The only genuine hazard — redesigning the artifact manager is **currently**
mid-task on — is already bounded by the fact that manager tasks are short and
the user is the one handing them over. It needs no mechanism.

## 3. The principle — the user is the scheduler

Brainstorming produces the prompt. The user hands it to manager. **No machine
ever initiates work**, so no machine needs to know about another session's
in-flight state.

This is §16's operating model at a different layer. Deploy mode was chosen
because "the user sees each proposed change and can stop it." The user
standing between the two sessions is that same safeguard, and it is why
cross-session state has no consumer.

Sessions need **recognition, not coordination**.

> **Reconsidered 2026-08-29 with new information. Still no.**
>
> This section was written before the mechanism existed. It now does: Claude Code
> ships **cross-session messaging** (v2.1.224+), and its documentation describes
> this exact setup — *"when sessions work the same repository in separate
> worktrees, Claude can tell the other sessions what landed"* and *"when one
> session settles a question another is blocked on, Claude can send the answer
> across."* It also carries the safeguard this section would have demanded:
> *"a message from another session never counts as your consent."*
>
> **Two things were weighed and the decision did not move.**
>
> Research on 2026-08-29 found **no practitioner report of anyone using it** —
> built, shipped, and as far as that search reached, unused. That is not evidence
> against it, but it means adopting it would be exploration, not adoption of a
> proven practice.
>
> More decisively, the argument above is untouched. The mechanism enables
> *coordination*; this section rules that out on the grounds that **the user
> standing between the two sessions is the safeguard**, not an inconvenience to
> route around. Nothing about the feature existing changes who the scheduler is.
>
> **Karl's call, 2026-08-29: dropped, explicitly not rejected forever** — "that
> may have a place for testing in the future," and a long way off.
>
> **Written down so it is not re-raised from the research file.** The findings in
> `.claude/research/2026-08-29-agent-assisted-development-sequencing.md` name this
> as an unexplored opportunity and say Synapse is the canonical use case. A future
> session reading that, and not this, would propose it again — which is exactly
> what happened four times to the third-trailer-value question before `CLAUDE.md`
> had to say *"do not propose a third value again."*

## 4. Mechanism — a commit trailer

Every commit carries a `Session:` trailer naming the session kind that
produced it:

    Session: brainstorm
    Session: manager

### Two values, and the third mode is deliberately not distinguished

**Decided 2026-08-27, after being raised in four consecutive sessions.**

There is a third thing that happens often and has no value of its own: a plain
session that **dispatches Synapse specialists by hand** rather than launching
the pipeline. It is neither a Manager run nor a session doing all its own work.
A third value — `direct` — was proposed for it and **rejected**.

`brainstorm` covers it. The scheme stays at two values.

**Why.** The boundary the third value would mark does not exist in practice.
In the user's words: *"sometimes what happens is I get to brainstorming, and
then I just change stuff — because it's quick, easy, and I get it done right
away."* A session slides between thinking, editing, and dispatching without a
moment where the mode changes, so a trailer chosen at commit time would be
recording a distinction the session itself never made. A field that records a
judgement call nobody actually makes fills up with noise and stops being
evidence.

**What the values therefore mean.** `manager` means *the Manager pipeline
produced this*. `brainstorm` means *a plain session produced this* — whether it
wrote the code itself or dispatched a specialist to. That is the whole
taxonomy, and both halves are now true, which was not the case before the
dispatcher-supplied fix above.

**Consequence for a plain session that dispatches Coder: supply your own value.**
The dispatcher passes the kind of session *it* is, so a brainstorm session
dispatching Coder tells it `brainstorm`. Passing `manager` because Coder is a
pipeline agent is exactly the error that produced the 28 false records.

Read back with:

    git log -10 --format='%h [%(trailers:key=Session,valueonly,separator=)] %s'

Labelled commits print the label; unlabelled ones print empty brackets, so
**unattributed is visibly distinct from attributed** — which is the entire
mechanism. The trailer coexists with `Co-Authored-By:` and does not disturb
the conventional-commit subject line.

**Git log is the ledger.** There is no new file, nothing to keep in sync,
no stale entry to reap, and no release condition to get wrong.

### Granularity — attribution, not content

A reader of the ledger learns **that** a sibling committed and **which paths**
it touched. It never learns what the sibling wrote. This is what keeps the
mechanism compatible with manager: see §6.

## 5. Who writes it

| Session kind | Who adds the trailer | Where the rule lives |
|---|---|---|
| manager | `synapse-coder`, using the value Manager supplies at dispatch | `agents/synapse-coder.md`, `agents/synapse-manager.md` |
| brainstorm | the plain session itself — and `synapse-coder`, when a plain session is what dispatched it | the **consumer repo's** `CLAUDE.md` |

**The dispatcher supplies the value; Coder never picks one.** Coder cannot see
who dispatched it — a Manager pipeline run and a plain session hand-dispatching
it are identical from inside — so any value Coder chose would be a claim about
something it cannot observe. It takes the value it was given and stops if it was
given none.

This was not always so, and the cost is measurable. `agents/synapse-coder.md`
previously hardcoded `Session: manager`, which produced **28 commits in
Synapse's own history trailered `[manager]` in a repository where no
`claude --agent synapse-manager` session had ever run.** Every one came from a
plain session dispatching Coder by hand. The trailer read as evidence about
which mode produced the work and was in fact evidence only about which agent
typed the commit.

The consumer half is deliberately not Synapse's to write. Synapse publishes
the pattern; a session rooted in the consumer adopts it. Same split as §16.

## 6. Who reads it

**`synapse-manager.md` stewardship step (d)** becomes three-way:

1. commits it dispatched → normal, no comment;
2. commits it did not dispatch but which **carry a sibling's trailer** → one
   informational line, no alarm;
3. commits it did not dispatch and which are **unattributed** → the drift
   alarm, unchanged.

The alarm keeps its full value. It stops firing at the user's other session
and keeps firing at everything else.

### Amendment, 2026-08-26 — the window is anchored, not fixed

As first written this section left the reading window at `git log -10`, and
that carried a defect the spec did not notice: **the default state of the
world is untrailered.** Every repository that has not adopted this convention
— which is every repository, at the moment it adopts Synapse — has ten
untrailered commits behind HEAD. Bucket 3 therefore fired on the whole of
existing history, on the first task, for every new adopter. The mechanism
designed to distinguish siblings from intruders instead classified *the repo's
own past* as an intruder.

Manager now records `git rev-parse HEAD` before its first dispatch and reads
`git log <anchor>..HEAD`. Commits that predate the session are never examined.

This is a strict improvement to bucket 3 rather than a relaxation of it.
Untrailered-and-old and untrailered-and-just-now were previously
indistinguishable, so the alarm was mostly noise; now the only commits it can
fire on were made while the pipeline was running. **It also makes the trailer
optional rather than a prerequisite** — a solo adopter never needs §5's
consumer half at all, and only someone genuinely running two sessions does.

The same defect was present in the consumer-side prompt and is fixed there
too; see the Appendix.

**`/takehandoff` step 5** takes the same three-way split, so a brainstorm
session resuming after manager committed reads context instead of an alarm.

> **Note.** `/takehandoff` and `/session-hand-off` live in
> `~/.claude/commands/`, not in Synapse. They are load-bearing to this
> workflow but outside Synapse's source of truth, so a change there is
> versioned nowhere. Whether they should move into Synapse is a separate
> open question, deliberately not settled here.

### Why this costs manager no new capability

Manager already runs `git status --short` and `git log --oneline -10` in
stewardship steps (c) and (d). Git metadata is **already in its diet**. This
change is a different `--format` string on a command it already runs — not a
tool grant, not a relaxation of "never reads files."

That matters beyond convenience: it means this problem is solved without
touching Handoff #6's open question about granting manager `Agent(Explore)`.
The two are independent.

## 7. One discipline rule

**No session runs `git add -A` or `git commit -a` in a shared repo.** Commit
only your own declared paths.

Attribution cannot fix the observed failure where a brainstorm session sweeps
up manager's uncommitted work into a commit of its own — that commit is
*correctly* attributed to brainstorm and still contains another session's
half-finished work. Only staged discipline prevents it.

## 8. Explicitly not built

Heartbeats, session status files, and §4's registry.

These are **out of scope by the operating model**, not deferred pending
demand. §4's registry and §11's stateless-router manager are both parts of the
autonomous design whose premise §16 rejects; a registry exists so that
machines can schedule each other, and in Synapse the user schedules.

A future session proposing in-flight visibility is proposing autonomy. That
may be a legitimate thing to propose, but it is a change to the operating
model and must be argued as one — not adopted as a convenience.

This also closes the trap Handoff #6 flagged in §11's manager row.

## 9. Success criteria

1. `git log -10 --format='%h [%(trailers:key=Session,valueonly,separator=)] %s'` returns
   a label for new commits from both session kinds.
2. A brainstorm commit appears in manager's stewardship report as an
   attributed informational line, not a drift alarm.
3. A commit made by hand with no trailer, **while the session is running**,
   still raises the drift alarm.
4. No agent gains a new tool, and manager's never-reads-files constraint is
   unchanged.
5. A repository with untrailered history that has adopted nothing raises **no**
   alarm on its first task. This is the criterion the original four missed;
   all four passed while the mechanism was unusable by a new adopter.

## Appendix — consumer adoption prompt

§5 leaves the consumer half to a session rooted in that consumer, and a prompt
hands it over. It is deliberately self-contained: the session receiving it has
never seen this spec.

**That prompt now lives at `adoption/session-attribution.md`.** It was
promoted out of this appendix on 2026-08-26, because an artifact you have to
go find inside a design document is one nobody hands over. Two changes came
with the move: a preamble saying when adoption is and is not needed — after
the §6 amendment, most adopters need nothing — and a correction to its
ledger-reading step, which had inherited the identical fixed-window defect and
would have taught every consumer repo to flag its own history as drift.

Note that placing the *reading* rule in the consumer's `CLAUDE.md` also
sidesteps the unversioned-command problem in §6 — `CLAUDE.md` is a user
instruction and outranks a slash command's built-in drift step, so
`/takehandoff` needs no edit for this to work.
