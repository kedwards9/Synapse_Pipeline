# No pipeline, and no gate, for brainstorming sessions

**Status:** DECLINED, 2026-08-29. Karl's call, closing a question reserved to him
across four handoffs. **Off the table — not deferred, not backlogged.** A
brainstorm decision record, not a pipeline artifact.

**What is declined:** any structural apparatus wrapped around a plain
brainstorming session — a subagent pipeline, a dispatch gate, a checklist that
must pass before the session may proceed, or a specialist agent that owns the
exploring. The `Session: brainstorm` trailer, the `HANDOFF.md` /
`BRAINSTORMHANDOFF.md` lock, and the rules in `CLAUDE.md` are unaffected. They
are conventions a session follows, not a gate a session must clear.

---

## 1. What was reserved, and for how long

`BRAINSTORMHANDOFF.md` #4 recorded it as **"a separate project Karl is thinking
about, explicitly his and not to be designed or filed… Do not spec it, do not add
it to a backlog."** He reaffirmed it at `08-29T02:36Z`: *"I am starting to think
I need to make a pipeline for you."*

The prompt was a real asymmetry, and it should be stated fairly before it is
dismissed. **The Manager pipeline has structural checks and a plain session has
none.** Manager enters a worktree, gates dispatch on a committed record, reports
stewardship, runs against an allow-list, and is audited by
`scripts/agent-audit.mjs`. A brainstorm session has a commit trailer and some
prose.

`specs/2026-08-29-skills-and-specialists-evidence.md` §2.6 called that **"the
largest genuine structural gap in the five days"** and deliberately stopped at
it — and then used it: the report's *no new agents* verdict rests partly on the
claim that most apparent agent gaps are really the absence of *this*.

**That inference does not survive this decision, and §2.6 has been amended to say
so.** The verdict itself is unaffected; only its second reason is withdrawn. Its
first reason — that a seventh specialist would answer at the wrong layer — is
strengthened, not weakened, by there being no layer to answer at.

## 2. Why: the field has no such thing, and has never evaluated one

`.claude/research/2026-08-29-agent-assisted-development-sequencing.md` §2.5
investigated exactly this arrangement — a human designing in one session while an
agent implements in another — and returned **a structured null**:

> **State: confirmed it happens · not found (searched) that anyone has evaluated
> it.** … **What is absent, after six distinct search framings:** no name, no
> methodology repo, no benefit claim, no measured result, no postmortem.

**A searched negative from the right instrument.** Huang et al. asked
practitioners directly (survey Q7a) whether they ran one agent at a time or
several in parallel. Every answer described **agent-agent** parallelism. The one
study positioned to catch human-design-alongside-agent-implementation did not
catch it, because the practitioners surveyed were not doing it.

**Say what that null is and is not.** It is an absence of evaluation, not a
measured negative — nobody has found this practice harmful, because nobody has
looked. The honest reading, which the research states in its own Decision A.3, is
that **"Synapse is doing something normal and unexamined."** Declining to build a
pipeline for it is not "the research says don't" so much as **there is nothing to
copy, and no evidence that inventing one would help.** That distinction is the
same *claimed vs evidenced* discipline §3.4 of the research applies elsewhere,
and it applies here too.

**What the field reaches for instead is isolation, not coordination** (research
§2.6). Three vendor lineages converge on it — Anthropic's worktrees with runtime
enforcement, Cursor's cloned repo on a branch, Codex's container per task — and a
repo search of parallel-agent orchestrators returned **12 of 12** using per-task
git worktrees. **Exactly one true coordination mechanism has shipped anywhere**
(Anthropic's cross-session messaging), and no practitioner report of anyone using
it was found.

**Synapse already took the isolation route, on the same day.** Manager runs in a
worktree — `specs/2026-08-29-manager-worktree-isolation.md`. That is the
convergent answer to the two-sessions problem, and it is already built. A gate on
the brainstorm session would be the *coordination* answer, which is the one the
whole field is not reaching for.

## 3. Why: a gate spends the resource that is actually scarce

The one substantive argument against running a design track alongside an
implementation track is **human review capacity**, and two independent
practitioners converge on it (research §2.5) — Simon Willison: *"I can only focus
on reviewing and landing one significant change at a time"*; Armin Ronacher, via
Pragmatic Engineer: *"it's only so much my mind can review!"*

If review attention is the binding constraint, **a gate on the brainstorm session
consumes more of it, not less.** Every check it adds is a thing Karl has to
satisfy, in the session whose entire value is that it does not have to stop and
satisfy things. The apparatus would be paid for out of the exact budget it was
meant to protect.

## 4. Why: it was already rejected once, on the structural argument

2026-08-27, `docs/superpowers/decisions/2026-08-27-design-docs-reach-the-pipeline.md`:

> **Build a brainstorming pipeline to produce better briefs.** Rejected as a
> category error. A pipeline's value is isolation — fresh context per specialist,
> artifact per stage. Exploration runs on continuity and back-and-forth with the
> user, and chopping it into dispatched subagents destroys precisely what makes
> it work.

A **brainstorming agent** was raised separately at `08-25T01:18Z`, deferred that
session, then re-proposed and rejected — settled in `HANDOFF.md`, and therefore
cited here second-hand, as §2.5 of the specialists report also had to.

**And the gate half was withdrawn even earlier, on 2026-08-25**, in
`specs/2026-08-25-session-attribution-design.md` §2 — which reached this
decision's conclusion four days before the question was reserved:

> It is tempting to read the symptom as a coordination problem and reach for
> mutual exclusion — a staged design surface, a promotion gate, a freeze on the
> artifact manager is implementing. That was proposed in the session that
> produced this spec and **withdrawn**. The workflow it would constrain is
> legitimate.

**That spec also states the operating principle this decision rests on**, in §3:
*"the user is the scheduler… No machine ever initiates work"*, and therefore
**"sessions need recognition, not coordination."** A gate is coordination. The
`Session:` trailer is recognition, and it is the mechanism this project already
chose for exactly this problem.

**And nothing in the installed ecosystem does it either.** §2.4 of that report
read all 68 ECC agent definitions; not one gates or structures a design
conversation. The candidates that came closest were **"reviewer briefs wearing
agent costumes."**

## 5. What already covers the gap, without a gate

Every check the reserved idea would have added has an existing home that costs a
brainstorm session nothing at the keyboard:

| The worry | What already holds it |
|---|---|
| Uncommitted records exist on one disk | The commit gate — `specs/2026-08-29-commit-gate.md`. Manager enforces it at dispatch; the session side is a rule, on purpose. |
| Two sessions overwrite each other | Manager's worktree — `specs/2026-08-29-manager-worktree-isolation.md`. Isolation, the convergent primitive. |
| Nobody can tell who wrote a commit | The `Session:` trailer — `specs/2026-08-25-session-attribution-design.md`. |
| The queue drifts from reality | `scripts/queue-audit.mjs`, task 15 — `specs/2026-08-29-queue-audit-script.md`. A script, which is what both investigations independently concluded it should be. |
| Records cite code that moves | The citation-anchor rule — `specs/2026-08-29-citation-anchors.md`. |
| Verification items are unactionable on arrival | The reachability rule in `docs/REVIEW-QUEUE.md`, earned by R22/R23 and R14–R20. |

**The pattern is the point.** Each one is a *rule a person follows* or *a script
that runs*, and neither is a pipeline. Rules beat agents — §2.5 of the specialists
report reached the same conclusion about the verification-item author, on its own
evidence.

## 6. Reverses if

Stated so this is a decision and not a mood:

- **The field produces one.** A named methodology, a repo, or a measured result
  for structuring a human design session against agent implementation. Today
  that is a six-framing searched negative; if it stops being one, re-read it.
- **A measured failure traces to the absence of a gate.** Not a near-miss and not
  an argument — an incident where a brainstorm session damaged something a gate
  would have caught, and the trace runs to the missing structure rather than to
  a rule nobody followed.
- **Review capacity stops being the constraint.** §3's argument is the load-
  bearing one, and it rests on a bottleneck two practitioners assert and nobody
  has measured.

**What does NOT reverse it:** *"the Manager pipeline has checks and this session
doesn't."* That asymmetry is the original prompt, it is fully described in §1, and
it is not new information. Restating it is re-opening, not evidence.

## 7. Rejected alternatives

| Alternative | Why not |
|---|---|
| **Defer it again** | Four handoffs carried it as reserved. A question that survives four carries costs attention every time it is re-read and never gets cheaper. Karl closed it; closing it is the outcome. |
| **File it in `docs/BACKLOG.md`** | A backlog entry is a deferral wearing a decision's clothes, and #4 explicitly said not to. Declined means not on a list. |
| **Keep the gate, drop the pipeline** — a checklist rather than subagents | This is §3's failure exactly. The subagents are not what makes it expensive; the stopping-to-satisfy-it is, and a checklist is pure stopping. |
| **A `synapse-brainstormer` agent** | Already settled twice — the 08-27 category error and the `08-25T01:18Z` rejection. A dispatched agent has no channel to the user and cannot stop and ask, which is the whole of what a brainstorm session does. |
| **Wait for the next Manager run to suggest a shape** | The pipeline does not fix the pipeline, and it does not design the thing standing outside it either. |

---

**Recorded because a decision that lives only in a conversation gets re-opened.**
This one has been raised at least four times across five days. The next session
to notice the asymmetry in §1 should read this and stop, rather than discover it
fresh and propose it again.
