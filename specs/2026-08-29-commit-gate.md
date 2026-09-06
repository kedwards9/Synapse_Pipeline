# The commit gate — the pipeline builds only what was committed to

**Date:** 2026-08-29
**Status:** design record, ready to dispatch
**Covers:** `agents/synapse-manager.md` (allow-list and step 1), `CLAUDE.md`, and the queue-entry rule
**Depends on:** nothing. **Strengthened by:** `specs/2026-08-29-manager-worktree-isolation.md`
**Sibling, different problem:** `specs/2026-08-29-plan-persistence.md`

> **Routed outside the pipeline, by standing rule (2026-08-29).** This record
> edits `agents/synapse-manager.md`, so it is implemented by a plain session,
> not dispatched to `synapse-manager`. A Manager session changing its own
> definition runs the old text for the whole run and cannot exhibit what it just
> approved — see *"The pipeline does not fix the pipeline"* in `CLAUDE.md`.
> Run `node scripts/agent-audit.mjs` on the edit, then deploy, restart, and let
> the next Manager session be the test.

---

## 1. The idea, in one sentence

**A `git commit` is a declaration, and the pipeline should only build what has been declared.**

Not *"the record is finished."* Not *"every question is answered."* A record can be committed
carrying three `Open, not decided here` sections and still be a legitimate thing to build. What the
commit says is narrower and more useful: **this is the version I am standing behind — go.**

## 2. Why this is the right gate, and completeness is not

Research on 2026-08-29 (`.claude/research/2026-08-29-agent-assisted-development-sequencing.md`)
found that **no framework in agent-assisted development gates on plan completeness.** They say so in
their own documents — Spec Kit **contradicting itself twice in one file**:

> GitHub Spec Kit: *"Code generation begins as soon as specifications and their implementation plans
> are stable enough, but they do not have to be 'complete.'"*
>
> Anthropic: *"If you could describe the diff in one sentence, skip the plan."*
>
> agent-os: *"Keep shaping fast — Don't over-document. Capture enough to start, refine as you build."*

**But every one of them gates on a phase boundary.** The boundary is what makes the difference, not
the document's maturity.

**A commit is the best available phase boundary**, for three reasons that completeness cannot match:

1. **It is mechanical.** `git ls-files` answers it. No judgement about whether a record is "ready."
2. **It does not require completeness.** You can commit an admittedly-partial record. The gate and
   the document's maturity are orthogonal, which is exactly what the research says they should be.
3. **It is reversible but visible.** You can amend and re-commit; the history shows you did. A gate
   you cannot reverse is a gate people route around.

**Also measured, and the duller reason:** a study screening 36,710 repositories found 85 plan files
in ten of them. Essentially nobody commits these. The population norm is not evidence the norm is
right — but it does mean this is a deliberate practice, not a correction of negligence.

## 3. What is actually broken today

**The pipeline is built to accommodate uncommitted records, not to reject them.**
`agents/synapse-manager.md` says so in its own words:

> The moment a child returns a path, run `git hash-object <path>` and keep that hash beside the
> path. **It works on an uncommitted or untracked file, which is what these are during a run.**

That is the gap written down and mitigated instead of closed. The fingerprint detects a record
*changing* mid-run — genuinely useful — but it has nothing to compare against and no history if the
file is lost.

**Measured at `e1acc69`, 2026-08-29:** 15 untracked paths, of which **13 are design records or
plans**, and 15 modified paths, of which **9 are tracked design records**. Every record written by **this brainstorm
session** exists on exactly one disk with no history. (One 2026-08-29 record *is* tracked —
task 9's plan, committed by the concurrent Manager session.)

## 4. Decisions

### Decision 1 — the gate attaches to the queue entry, not to the dispatch

**A task does not go into `watcher/docs/DISPATCH-QUEUE.md` until the record it names is committed.**

Three reasons this beats gating at dispatch:

- **It fires earlier.** You find out while writing the queue entry, not with a pipeline session
  waiting on you.
- **It is already checkable.** `specs/2026-08-29-queue-audit-script.md` check 6 verifies every
  record path in the queue resolves. **"…and is tracked" is one more `git ls-files` over a list it
  already builds.**
- **It strengthens what the queue means.** Today the queue guarantees a task points at a file that
  exists. Under this rule it guarantees **every task points at a document someone committed to.**

### Decision 2 — Manager checks at dispatch too, and needs one allow-list entry to do it

The queue rule is a convention, and conventions fail. **The evidence is external and weaker than
an earlier draft of this record claimed** — `anthropics/claude-code` #88862, one team running 3–6
sessions against one clone, reporting *"two of our three incidents happened to sessions that had
read the mitigation and followed it correctly."* **Zero reactions, a single author; one careful
measurement, not a corroborated finding.** Synapse has not measured this itself. So Manager
verifies before handing a path to Planner:

    git ls-files --error-unmatch <path>

**This requires adding `git ls-files` to Manager's allow-list, which today holds exactly **eight**
commands and does not include it.** The addition fits the allow-list's own stated principle without
straining it:

> *"commands that return metadata about the repository are allowed; anything that returns the
> contents of a file is not."*

`git ls-files` returns whether a path is tracked. It is metadata by that definition, returns no file
content, and cannot write. **Name the consumer, per `CLAUDE.md`'s hard rule: Manager's step-1
pre-dispatch check, wired in the same change.**

> **A contradiction to fix in the same edit.** Manager is instructed at step 1 to run
> `git hash-object <path>`, and its allow-list — eight commands, introduced as *"the only commands
> you may run unprompted"* — **does not contain `git hash-object`.** The instruction and the
> allow-list have disagreed since both were written. Add it too, with the fingerprint step as its
> named consumer.
>
> **And there is a second, worse one an audit found.** The same step instructs Manager to run
> `head -1 <path> | grep -c "synapse-pipeline-artifact"` — against an allow-list whose forbidden
> list reads *"`cat`, **`head`**, `tail`, `less`, **`grep`**, `sed`, `awk`, `find`, `ls` of source
> trees … and **any pipe** or redirect whose effect is to print file contents."* **Three forbidden
> elements in one instructed command**, and unlike `hash-object` this one is *explicitly* forbidden
> rather than merely omitted. **Fix both in the same edit**, or Manager still ships carrying a
> command its own rules prohibit.

### Decision 3 — the worktree is the backstop, and it cannot be skipped

`specs/2026-08-29-manager-worktree-isolation.md` proposes running the Manager pipeline in a git
worktree. **That change makes this gate self-enforcing**, because a worktree is a checkout of a
commit and uncommitted work simply is not present.

**Measured live on 2026-08-29 by this session**, not by the worktree record — which contains two
named-file probes rather than a listing. Inside a probe worktree at `HEAD`, `ls specs/` returned
**six files**, the committed ones. All five specs written that day were **absent**, including the
worktree record itself. Reproducible without creating a worktree:
`git ls-tree --name-only e1acc69 specs/ | wc -l` → 6.

So the two changes are one idea seen from two sides:

| | Mechanism | Fails | Can be skipped? |
|---|---|---|---|
| **This record** | `git ls-files` check | **early**, with a clear message | yes — it is an instruction |
| **Worktree** | file is not there | **late**, as "record not found" | **no** — it is physics |

**Adopt both.** The check gives a good error at the right moment; the worktree guarantees the rule
holds even when the check is skipped, missed, or edited away.

**This record does not depend on the worktree.** If that change is never made, the gate still stands
on Decisions 1 and 2 — it just loses its un-skippable backstop.

### Decision 4 — "committed" means committed at its current content

**Tracked is not enough.** A record that is tracked but **modified** is "committed" under a loose
reading while its *older* committed version is what a worktree would carry — and what a reader would
recover. Measured at `e1acc69`: of 15 modified tracked files, **nine are dated design records** — and
`DISPATCH-QUEUE.md` is a **tenth** modified tracked file, not one of the nine.

`git status --short -- <path>` alone separates all three states: empty for tracked-and-clean,
` M <path>` for modified, `?? <path>` for untracked. **So an earlier draft of this record was wrong
twice** — it split the job across two commands that one command already does, and it claimed Manager
"already runs it" at dispatch. It does not: Manager runs `git status --short -- <path>` **only inside
the marker-present branch**, and its rule for an unmarked file is *"No marker — carry the path
through unchecked… the naming is the authorization."* **A brainstorm design record carries no
marker**, so for exactly the class of document this gate targets, no check runs today. A new
instruction is required.

> **The real argument for `git ls-files`, which the earlier draft missed.** `git status --short`
> returns **empty** for a path that does not exist — indistinguishable from tracked-and-clean. So a
> typo'd or deleted record silently passes a status-only gate:
>
>     git status --short -- specs/does-not-exist.md   → empty, exit 0
>     git ls-files --error-unmatch specs/does-not-exist.md
>       → error: pathspec ... did not match any file(s) known to git, exit 1
>
> **That is the grant's justification** — catching a path that names nothing — and it survives the
> objection `specs/2026-08-29-plan-persistence.md` raises against it (below). The status-vs-ls-files
> split the earlier draft argued does not.

> **Direct conflict with a sibling record, stated rather than buried.**
> `specs/2026-08-29-plan-persistence.md` **rejects** this grant: *"an allow-list that grows for a
> capability already present is the kind of unnecessary grant `CLAUDE.md` asks to be argued for
> rather than assumed."* On its own terms it is right — for a path known to exist, `git status
> --short` answers everything. **Two records written the same day, editing the same agent file,
> reaching opposite conclusions about the same command.** Whoever dispatches these must resolve it,
> not discover it. This record's case rests entirely on the nonexistent-path gap above; if that is
> judged not worth a grant, drop Decision 2's `git ls-files` and gate on `git status --short` alone.

### Decision 5 — this is a rule for people, and it is the only one here that is

Everything else designed on 2026-08-29 constrains an agent. **This constrains the person writing the
record**, which is why it belongs in `CLAUDE.md` rather than only in an agent definition — and why
the enforcement is deliberately soft at the point of writing and hard at the point of building.

## 5. What this does not change

- **It does not change how Manager or Planner read a record.** They read the filesystem, before and
  after. There is no "read from git" path and none is proposed. What changes is that the file on
  disk now corresponds to something declared.
- **It does not require pushing.** Manager reads locally. Pushing is for durability and for the
  remote being current; it is not part of the gate.
- **It does not touch `synapse-planner` or `synapse-coder`.** Neither reads the queue and neither
  chooses what to dispatch.
- **It does not replace the fingerprint.** `git hash-object` still catches a record edited mid-run.
  The commit gives it a baseline it has never had.
- **It is not the plan-persistence fix.** `specs/2026-08-29-plan-persistence.md` addresses a
  different document (the *plan*, written by Planner) lost for a different reason (a seam between two
  correct rules). Same word, different problem. **Do not merge them.**

## 6. Open, not decided here

- **Whether the queue check should fail or warn.** `queue-audit.mjs` is three-tier — and note it is **not** report-only on exit codes; its spec says *"Exit non-zero on
  any inconsistency, zero when clean, so it can gate"*. It is report-only in the sense of not
  judging or rewriting, which is a different claim — and
  three-tier (`pass`/`fail`/`warn`, only `fail` exits non-zero). An untracked record in a queued task
  is arguably a `fail`. Not decided, because the audit script's own scope was amended the same day.
- **What Manager does when the check fails.** Stop and report is the obvious answer, and it matches
  the halt behaviour Manager already has for a pipeline-artifact marker. Whether it should offer to
  commit the record is a separate question — it currently cannot, and `git commit` is deliberately
  absent from its allow-list.
- **Whether design records should follow plans into a naming convention.** Records currently land in
  `watcher/docs/` and `specs/` by subject, which `README.md` argues for. Untouched here.
- **Whether this rule should apply retroactively.** Thirteen untracked records exist right now. They
  can be committed in one pass, or left and only new work gated. Not decided.

## 7. Consequences

- `CLAUDE.md` gains the rule, short, with the argument staying here.
- `agents/synapse-manager.md` gains two allow-list entries (`git ls-files`, `git hash-object`), one
  pre-dispatch check, and one fixed contradiction. **Requires `node scripts/deploy-agents.mjs` and a
  session restart** — a running Manager session holds the old text.
- `specs/2026-08-29-queue-audit-script.md` check 6 grows a tracked-ness assertion.
- **One habit changes for the user:** commit the record before adding its task to the queue.
