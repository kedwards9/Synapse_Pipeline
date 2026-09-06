# `scripts/queue-audit.mjs` — the dispatch queue checks itself

**Status:** decided, dispatchable. A brainstorm decision record, not a pipeline
artifact.

**Amended 2026-08-29, before dispatch.** Two things were added: a **Currency**
family of checks — *is what the file says still true* — and a decision about
parsing a queue whose landed and un-landed tasks have different shapes. Checks
2, 4 and 8 below are **superseded in place**, with the original text kept and
fenced. Everything else stands. Start at *The second kind of check* if you have
read the rest before.

**This is the one build recommendation of
`specs/2026-08-29-skills-and-specialists-evidence.md`.** Two investigations ran
independently over 2026-08-24 → 2026-08-29 — one asking whether Synapse needs new
skills, one whether it needs new agents. Both found queue drift as the
highest-occurrence pain in the window, and **both routed it away from their own
question.** It is neither. It is a script.

---

## The evidence

Ten-plus occurrences in two days, all repairs to
`watcher/docs/DISPATCH-QUEUE.md`:

| Commit | What was wrong |
|---|---|
| `6ab4a5b` | *"the queue said nothing was in flight while task 11 was running"* — and its body: *"**This is the second time today** a status line in this file went stale while being read as current."* |
| `9583283` | *"task 11 landed — and my in-flight note was stale when I wrote it."* Body: *"The status line has now been wrong **in all three possible ways in a single day**."* |
| `2663e9d` | *"tasks 12 and 13 had no dispatch prompts, and 11 was out of order"* — found *"by **auditing the file mechanically rather than reading it**."* |
| `b980b7d` | Four stale claims, one written earlier the same day. |
| `930a3c6` `a2c4d3d` `b8e2562` `2ee2160` `537c96b` `6fc9a8f` `e721d76` | Recurring resync-with-reality repairs. |

**The measured cost, in Karl's words at `2026-08-28T20:40Z`:** *"Well, I fucked
up because I went with number three before number six. I was going in order of
dispatch queue, not the status queue."* And `e721d76`'s body: *"the two findings
that would have caused real harm if task 12 had been sent."*

**An eleventh occurrence landed after the standing warning was added to the
file.** On 2026-08-29 the queue's own artifact was found to be missing dispatch
prompts 9–13 entirely — including task 12, the next one to send — plus cards for
9 and 10. Found by mechanical comparison against the markdown, not by reading it.
**A warning that people then fail to act on is the argument for mechanising the
check**, not for writing a louder warning.

---

## Why a script, not a skill and not an agent

`9583283` names the exact procedural bug: *"I checked
`<my-last-commit>..HEAD`, which is empty whenever the other session's commit is
OLDER than mine."* Every check that has failed is deterministic. There is no
judgement in any of them.

**The in-repo precedent already won this argument.** `scripts/commit-task.mjs`,
in its `WHY THIS EXISTS` header:

> *"This script decides nothing about timing. It exists so the mechanical half
> stops being re-derived by a model on every invocation."*

`CLAUDE.md` says the same thing for agent definitions — **"Audit mechanically,
not by reading"** — and this extends that rule to the queue. `scripts/` holds
**seven** tested modules; an eighth fits the established shape exactly.

> **This said "eight tested modules; a ninth" when written, and the count is
> wrong.** Counted 2026-08-29: `commit-task`, `deploy-agents`, `hot-files`,
> `investigation-window`, `orchestrator-boundary`, `prompt-record`,
> `verify-install` — **seven**, each with a `.test.mjs` beside it, fourteen
> files. The error is inherited verbatim from
> `specs/2026-08-29-skills-and-specialists-evidence.md`, where Brainstorm
> Handoff #4 had already refuted it — *"`scripts/` holds **seven** tested
> modules, not eight"* — and this record copied the sentence before the
> correction reached it. **A refuted claim that survives because it was quoted
> forward is the same failure this script exists to catch**, one document over.

**And the cheap alternative was already tried and works, which is the point.**
Two `general-purpose` audits on 2026-08-29 found the harmful items; `e721d76`
records *"Both were found by fresh-context agents reading the files, not by me
re-reading them."* That proves the checks are findable. A script makes them free
and repeatable instead of costing a dispatch and a context.

---

## The second kind of check

**Added 2026-08-29.** Research the same day into how other spec-driven tools
handle this found that GitHub's `spec-kit` ships **two structurally different
commands, and they are not interchangeable**:

| Command | What it validates |
|---|---|
| `/speckit.analyze` | *"Cross-artifact consistency & coverage analysis"* — the artifacts against **each other** |
| `/speckit.converge` | *"Assess the codebase against spec/plan/tasks and append remaining work as new tasks"* — the code against the **artifacts** |

AWS Kiro's *Sync Files* and OpenSpec's `archive` are both of the second kind.
Two commands exist because one cannot do both jobs: the first asks *do these
documents agree*, the second asks *is any of this still true*.

**This amendment was proposed on the reading that the record was weighted toward
the first kind. That reading is half wrong, and the half that is wrong is worth
correcting rather than quietly acting on.** The *Factual* section below is
already explicitly "the file against the repository", and checks 5, 6, 7 and 9
are all of the second kind. Four of nine, in a section that says so in its own
heading. Nothing here is a missing category.

**The real gap is narrower and sharper: every existing repository check verifies
that what the file cites is REAL. None verifies that what the file says is still
CURRENT.** A hash that existed still exists. A path that existed still exists. A
count measured at commit `X` still measures the same at `X` forever — that is
what makes check 7 reproducible, and it is also why check 7 cannot notice how
far behind `HEAD` `X` has drifted. **Those checks are green by construction on a
queue that is entirely stale**, which is precisely the state the queue was in
when the audits found it.

**Measured on this repository, 2026-08-29, at `e1acc69`:**

- 33 commit hashes are cited in `watcher/docs/DISPATCH-QUEUE.md`. **All 33
  exist. All 33 are ancestors of `HEAD`.** Check 5 finds nothing, and never has.
- 30 `.md` paths are cited. **All 30 resolve on disk**, once you try both the
  repository root and the queue file's own directory. Check 6 finds nothing.
- The count table's eleven rows **all re-measure correctly**. Check 7 finds
  nothing.
- The newest commit the file cites anywhere is **`f144992`**. `HEAD` is
  **`e1acc69`** — **four commits later**, and those four commits are
  `020d1d6` `e468728` `06a4414` `e1acc69`, which are **task 16 landing**. The
  run order still reads `16 ⏳` and the status line still reads **"Task 16 is IN
  FLIGHT. Next to send: 17."**

**Nine checks, zero findings, and the queue is wrong about the next thing to
dispatch.** That is the argument for the *Currency* family below.

**It is also the class the hand audit hit.** The 2026-08-29 audit was reported
as eight defects, seven of them claims about work that had already landed.
Brainstorm Handoff #4's *Additional Notes* list the `DISPATCH-QUEUE.md` half by
name and they are all of that shape — *"several code claims went stale when
tasks 3 and 6 landed."* **I could not reconstruct the exact eight from the
repository**, since only two were fixed (`e721d76`) and the rest live in the
handoff as prose; the seven-of-eight ratio is taken on report, not verified
here. The shape of them is not in doubt.

---

## What it checks

**Deterministic only. Every check below is a parse or a `git` query.**

### Structural — the file against itself

1. **Every task number in the run order has a row** in the *Proof without you*
   table.
2. **Every *un-landed* task number has a `### N — ` prompt section, and no
   landed one does.** This is the check that would have caught `2663e9d`.

   > **Superseded 2026-08-29. It said: *"Every task number has a `### N — `
   > prompt section."*** True of the queue as it stands — all 21 sections are
   > present and the numbers run 1…21 — and false the moment the restructure
   > lands, because a landed task's prose moves into its design record and its
   > prompt goes with it. **Under the new format a leftover prompt section for a
   > landed task is not harmless residue; it is the drift**, and it is invisible
   > today because the old format demands the section be there. See *Two shapes
   > in one file* below for how the script decides which side a task is on.

3. **Prompt sections are in ascending numeric order.** The file states they are
   sorted for lookup, not for running; assert it rather than trusting it.
4. **Done-marking agrees in all four places** — the `✓` in the run order, the
   `DONE`/strikethrough in the table row, the presence of a row in the
   per-commit count table, and (after the restructure) the **absence** of a
   dispatch prompt.

   > **Amended 2026-08-29 from "all three places".** The fourth signal only
   > exists in the new format. Measured today the first three already agree
   > perfectly — the run order's `✓` set, the table's `**DONE**` set and the
   > count table's row set are the same eleven tasks, `{1,2,3,6,8,9,10,11,12,13,14}` —
   > **so this check has never fired and would not have caught anything the
   > audits found.** Keep it; it is nearly free. But do not mistake it for a
   > load-bearing check. Three signals maintained by the same hand in the same
   > edit go stale together.

### Factual — the file against the repository

5. **Every commit hash the file claims exists** — `git cat-file -e <sha>^{commit}`.
   A typo'd hash currently survives indefinitely.
6. **Every spec path the file names exists on disk.** Manager forwards a path
   without opening it, so a wrong path fails at dispatch time, in front of a
   planner. **Resolve against two roots, in this order: the repository root,
   then the queue file's own directory.** The *Spec* column mixes both — task 10
   reads `specs/2026-08-28-boundary-hook-machine-wide.md` (repo-rooted) and task
   14 reads `2026-08-29-watcher-clean-value-guard.md` (a bare name that only
   resolves under `watcher/docs/`). Resolving against one root alone reports
   roughly half the queue as missing.
7. **The count table is re-measurable** — re-run
   `git grep -hoE "^test\(" <commit> -- 'watcher/src/**/*.test.mjs' | wc -l` per
   row and compare. The regex is the file's own, stated beside the table.

   > **The cells are not uniformly shaped, and a naive parser reads two of the
   > eleven rows wrong.** Measured 2026-08-29. Four shapes are in the table
   > today: a bare number (`422`), a number with emphasis and a comment
   > (`**539 — unchanged**`), a transition (`540 → **542**`), and a *commit
   > range* in the commit column (`` `56d7d6a` … `cc287ac` ``). **The rule the
   > file actually follows is: measure at the LAST commit of the range, and
   > compare against the number AFTER the arrow.** A parser taking the first
   > hash and the first number reports tasks 9 and 14 as disagreeing — 542 vs
   > 586, 593 vs 596 — when the file is right and the parser is wrong. **A false
   > failure on a correct queue is worse than no check**, because it trains the
   > reader to skip the output.

### Status — what the file asserts about right now

8. **In flight — report the plan files, and report that the signal is broken.**
   List every plan file under `plans/` and `watcher/docs/*-plan.md` with its
   tracked state from `git ls-files`. **Do not label an untracked plan
   "in flight."**

   > **Superseded 2026-08-29, by measurement. It said: *"Untracked plan files
   > under `plans/` and `watcher/docs/*-plan.md` are the signal."*** That signal
   > is the queue's own — *"a committed plan is the signal that separates
   > 'landed' from 'in flight'"* — and **the queue has since documented, in a
   > table of its own, that it is wrong five times out of six.** Re-measured
   > against `git ls-files` at `e1acc69`:
   >
   > | Plan file | State | Its task |
   > |---|---|---|
   > | `plans/2026-08-29-boundary-hook-machine-wide.md` | untracked | 10 — **landed** |
   > | `watcher/docs/2026-08-28-watcher-drop-order-space-plan.md` | untracked | 11 — **landed** |
   > | `watcher/docs/2026-08-29-watcher-hook-log-adapter-plan.md` | tracked | 9 — landed |
   >
   > **A script implementing check 8 as originally written would report tasks 10
   > and 11 as in flight today. Both landed days ago.** And a third untracked plan
   > exists that this table missed — **task 16's**, the very task the queue still
   > shows in flight. So the first real run is **2 false, 1 true, out of 3** — not
   > two out of two. A 1-in-3 signal is still not a check, so the demotion stands;
   > the re-measurement that missed a third of the matching files does not. Out
   > of two, on the first real run. Tasks 12, 13 and 14 landed with no plan file
   > at all, so the signal is silent on them as well.
   >
   > **This is not a defect the script can fix and it must not pretend
   > otherwise.** The queue states the choice plainly — *"Either the plans get
   > committed or the signal gets replaced — it cannot keep being cited while
   > being false"* — and that is Karl's, not the script's. Until it is made, the
   > honest output is the table above: the files, their tracked state, and no
   > inference. **Check 10 is the in-flight answer that actually works.**

9. **Landed since a baseline.** `git log <baseline>..HEAD` reading `Session:`
   trailers — **not `<my-last-commit>..HEAD`**, which is the bug that produced
   `9583283`. The baseline is an argument, defaulting to the last commit that
   touched the queue file: `git log -1 --format=%H -- <queue path>`.

   > **The default said "the merge-base of the file's last modification", and
   > there is nothing for that to be a merge-base of.** This repository has one
   > branch — `master`, with `origin/master` tracking it — so a merge-base is
   > either `HEAD` or meaningless. The intent was clearly "where the file was
   > last edited", and that has an exact command, given above. Today it returns
   > `e721d76`, **18** commits behind `HEAD`. (An earlier draft said twelve; 12
   > is the path-filtered count under `-- watcher/`, which check 9 deliberately
   > does not do — it reads `Session:` trailers repo-wide. The true figure is
   > worse for the baseline, not better.)

### Currency — the file against *now*

**New 2026-08-29. This is the family the record was missing.** Checks 5–7 ask
whether the file's citations are real; these ask whether they are current. They
answer *"is any of this still true"*, which is the `/speckit.converge` question.

10. **The high-water mark — the newest commit the file cites, against `HEAD`.**
    Collect every backticked 7–40 character hex token, keep those that resolve,
    and take the one that **every other cited commit is an ancestor of** — fold
    the set with `git merge-base --is-ancestor`. Report
    `git rev-list --count <newest>..HEAD` and list those commits with their
    subjects and `Session:` trailers. **If no single such commit exists**, the
    citations straddle a fork; report every tip rather than picking one. That
    cannot happen on this repository today — `master` is the only branch, with
    `origin/master` tracking it — but the script should not assume it.

    **This is the whole amendment in one check.** Every "as of now" sentence in
    the queue — the in-flight line, the suite totals, the "next to send" — was
    written no earlier than the newest commit it cites. If `HEAD` has moved,
    **all of them are at least that stale, simultaneously**, and no other check
    in this document notices. Measured 2026-08-29: newest cited `f144992`,
    `HEAD` `e1acc69`, **four commits between them, all four task 16**, while the
    file says task 16 is in flight.

    **It reports; it does not conclude.** A four-commit gap does not prove the
    queue is wrong — it proves nobody has re-checked it against four commits.
    Which is exactly what a reader about to dispatch needs told.

11. **Cited commits are ancestors of `HEAD`, not merely present** —
    `git merge-base --is-ancestor <sha> HEAD`. Check 5's `cat-file -e` passes on
    a commit that has been rebased out of the branch and survives only in the
    reflog; the queue would then be citing work that is no longer in the
    history. All 33 pass today. This is cheap insurance, like check 5 — **say so
    rather than letting a green line read as a finding.**

12. **A landed task's record actually received its prose.** After the
    restructure, the one-line row cites a record path; that record must exist
    (check 6) **and contain each commit hash the row cites.** This catches the
    half-done migration — the row was shortened and the prose never landed
    anywhere — which is the specific way this restructure can lose information.

    **A warning, not a failure, and the reason is a convention that does not
    exist yet.** Nothing requires a record to name its commits, and most
    existing records do not. If the restructure settles that a landed record
    names its commits, this becomes a hard check; until then a miss means
    "go look", not "this is wrong."

---

## What it must not do

- **Not judge.** It reports disagreements; it never decides which side is right.
  "Row says DONE, run order says pending" is output, not something to fix.
- **Not rewrite.** No `--fix`. The queue is prose with arguments in it, and a
  script that edits prose will flatten reasoning it cannot read.
- **Not infer order.** Ordering constraints are arguments — *"#3 before any other
  card work"* — and are not derivable from the file's structure.
- **Not touch `~/.claude/` or any consumer repo.** Read-only, everywhere.

---

## Two shapes in one file — parsing the restructured queue

**Added 2026-08-29.** The queue is being restructured, separately and
concurrently: a landed task's prose moves into the design record it was
dispatched against, the queue keeps a **one-line row** — number, title, commits,
record path — and un-landed tasks keep their full prose and dispatch prompts.
The script therefore parses a file where landed and un-landed tasks look
different.

### Decision 1 — detect the shape **per task**, never per file

The restructure is a hand edit across **eleven** tasks the queue marks landed — `{1,2,3,6,8,9,10,11,12,13,14}` — plus **task 16, which landed after those markers were last written** and is still shown in flight. Twelve in total; eleven marked. It will not land
in one commit, and the queue's own history says so: `2663e9d` was two tasks
missing prompt sections, `b980b7d` was four stale claims in one file. **A
whole-file format flag would be wrong for however long the migration takes**,
which is exactly the window in which the queue is most likely to be lying.

Per-task detection also makes the migration itself auditable: "task 11 is
landed, has a one-line row, and still carries a prompt section" is a finding the
script can state, and it is the residue check 2 now exists for.

### Decision 2 — the shape is read off the row, not guessed from the prose

**Landed** is `**DONE**` or `~~strikethrough~~` in the *Proof without you* row,
corroborated by the run order's `✓` and by a row in the per-commit count table.
**Measured 2026-08-29: this already works.** The eleven landed tasks all carry
both markers; the ten un-landed tasks carry neither; there are no partials.
Length of the row is not the signal — a landed row today can still be long.

### Decision 3 — tolerate the old format; do not hard-require the new one

The script may land before the restructure, after it, or in the middle. **A
script that hard-fails on the old shape cannot run during the migration**, and
the migration is a hand edit of the most drift-prone file in the repository —
the moment the checks are worth most. The cost of tolerance is small and
bounded: exactly one check (2) has a different expectation on each side, and the
side is already known from Decision 2.

**The one thing that does hard-require the new format is check 12**, and it
degrades honestly: a landed task whose prose has not moved yet has nothing to
compare, so the check reports "not migrated" rather than failing.

### Decision 4 — what the restructure must preserve, stated as a contract

These are not preferences. Each one is a hazard measured against the file as it
stands on 2026-08-29, and each would silently break the parser.

1. **Tables need their header row as the anchor.** There is no other unique key.
   A regex for `^\| (\d+) \|` matches the *Proof without you* table **and** the
   per-commit count table, returning 32 rows for 21 tasks. The scope table at
   the top dodges it only by writing `| **7** |` with emphasis. **Every table
   the script reads must be found by its header line** — `| # | Task | Proof
   without you | Spec |` and `| Task | Commit | Count |` — and read until the
   first non-row line. If the restructure renames a header, the script must be
   told; that is a one-line change and an unannounced one is a silent
   mis-parse.

2. **The run order stays an indented code block directly under its heading.**
   Parsing the block by scanning forward for `\d+ *(✓|⏳)?` overruns into the
   prose below and picks up "**16 and 17–21 are the Watcher work now**" as two
   more run-order entries. **Anchor on `### Run order`, take the indented block,
   stop at the first blank line after it.**

3. **The row keeps number, commits and record path machine-findable** — the
   number first in the row, commits as backticked hex, the record as a
   backticked `.md` path. **The current rows already satisfy this**, which is
   the good news in this section: task 14's row is already
   `| 14 | ~~…~~ **DONE** \`f144992\` … | … | done \`2026-08-29-watcher-clean-value-guard.md\` |`.
   The restructure mostly deletes narrative paragraphs above the table rather
   than reshaping the table, so **the parse targets largely survive it.**

4. **Column count must not be assumed.** If the landed row drops *Proof without
   you*, landed and un-landed rows have different widths in the same table.
   Read by position from the left and by content, not by expecting four cells.

> **The word `done` in the *Spec* column means the record is written, not that
> the task is.** Every row says it, including tasks 4, 5, 15 and 17–21, none of
> which have started. Anything keying on `done` as a landed marker inverts the
> entire audit. Decision 2's markers are the landed signal; this one is not.

---

## Shape

- `scripts/queue-audit.mjs` + `scripts/queue-audit.test.mjs`, matching the
  existing seven.
- **Path is an argument**, defaulting to `watcher/docs/DISPATCH-QUEUE.md`. The
  file already outgrew Watcher; the script should not assume the name.
- **Exit non-zero on any inconsistency**, zero when clean, so it can gate.
- **Three result tiers, not two: `pass` / `fail` / `warn`, and only `fail`
  affects the exit code.** This is `verify-install.mjs`'s existing contract —
  it declares `pass`, `fail` and `warn` helpers and ends on
  `process.exit(result.failed.length ? 1 : 0)` — and reusing it costs nothing.

  **The Currency checks are warnings, and that is deliberate.** Checks 10 and 11
  measure *age*, not contradiction. Failing the build because a commit landed
  after the queue was last edited would fail on almost every run, and a gate
  that always fails is a gate nobody reads — which is how the standing warning
  already in the queue earned an eleventh occurrence. Structural and factual
  disagreements are `fail`; "four commits have landed since this file last
  measured anything, here they are" is `warn`.
- **Output names the check, the expectation and what it found** — the same shape
  `verify-install.mjs` already prints, since that is the report Karl already reads.
- **Fixtures, not the live file.** Tests run against small crafted queue
  documents with known defects — a missing prompt section, a bad hash, a
  disagreeing `✓`. Testing against the real queue makes the suite fail whenever
  the queue legitimately changes.
- **Fixtures in both shapes, and one mixed.** Added 2026-08-29. The migration
  state is a real state, not an edge case, so it gets a fixture: a queue where
  some landed tasks have one-line rows and others still carry full prose and
  prompts. Plus the four measured parse hazards as their own cases — two tables
  with `| N |` rows, prose immediately below the run-order block, a bare record
  filename that only resolves under the queue's own directory, and a count cell
  written `540 → **542**` against a commit range.
- **`git` only, no `gh`.** The GitHub CLI is not installed on this machine, and
  every check above is a local `git` query or a file read. Nothing here needs
  the network.

---

## Rejected

| Option | Why not |
|---|---|
| **A skill that teaches the audit procedure** | The procedure has no judgement in it. And the evidence-discipline skills already installed fired **zero times in 40 transcripts** — a new one would very likely make it eleven documents nobody loads. |
| **A `synapse-reviewer` brief** | Reviewer runs inside a Manager dispatch. The queue is edited by brainstorm sessions, when Manager is not running at all. |
| **Fold it into `verify-install.mjs`** | That script answers *"is the install ready"* and is run at session start. This answers *"is the queue honest"* and is run before a dispatch. Different question, different moment. |
| **A `--fix` mode** | See *What it must not do*. |
| **Parse with a Markdown AST library** | Adds a dependency to a zero-dependency repo for a file whose structure is stable and line-oriented. R4 has not been decided. |
| **Flag `file.mjs:NN` line-number citations as rot risks** *(2026-08-29)* | Mechanical, and it targets a real defect — `repo-card.mjs:167` went stale when tasks 3 and 6 landed. But it fires **8 times (5 distinct citations)** on the queue today and **at least two of those are deliberate keeps**: the queue holds `repo-card.mjs:167` on purpose, saying *"Kept as written because it is the argument that changed the run order, not a pointer to chase."* Mostly noise. **And the stated blocker is now stale**: `specs/2026-08-29-citation-anchors.md`, written the same day, supplies exactly the convention this row says does not exist — three named exemptions, one of which is the historical fence that covers the queue's own deliberate keeps. **Re-argue this rejection against that spec before treating it as settled.** **It also cannot check the thing that matters** — that line 167 still means what the sentence says. Not worth the exit code or the reader's attention. |
| **Hard-require the new format** *(2026-08-29)* | See *Two shapes in one file*, Decision 3. The script would be unable to run during the migration, which is the window it is most needed in. |
| **Re-run the suites and compare the totals** *(2026-08-29)* | Tempting, because the queue asserts *"644 pass / 0 fail; scripts 178"* and those go stale like everything else. But `npm test --prefix watcher` is minutes, not milliseconds, and it makes an audit meant to run before every dispatch something you avoid running. **Check 10 covers the same ground cheaply**: if `HEAD` has moved past the commit those totals were measured at, the totals are suspect and the script says so without running anything. |

---

## Reverses if

- **The queue stops being one Markdown file.** If it ever becomes structured data
  the checks become trivial and most of this script becomes unnecessary.
- **The dispatching habit moves into the pipeline.** If Manager ever owns the
  queue directly, its stewardship stage is the right home and this is redundant.

> **The 2026-08-29 restructure is NOT that first trigger, and it would be easy
> to read it as one.** Moving landed prose into design records leaves the queue
> a Markdown file with the same run order, the same tables and the same prompt
> sections. It changes one check's expectation (2) and enables one new one (12).
> **It makes the file shorter, not structured.** The trigger is a queue that
> stops being prose — JSON, YAML, a database — and nothing proposed does that.

---

## What this still cannot catch — say it before someone trusts a green run

**Added 2026-08-29, because the hand audit's findings do not all reduce to
checks.** Of the eight defects that audit found, the ones this script would have
caught are the ones with a citation in them. The rest are prose claims about
code, and they are the majority:

| Defect found by hand | Mechanisable? |
|---|---|
| *"the application has no clock"* — task 6 added three | **No.** A sentence about a codebase, with nothing in it to resolve. |
| *"`RepoSnapshot` carries no time field"* — `fetchAgeMs` exists | **Almost.** A backticked identifier could be grepped, but "carries no X" is a negation the script cannot evaluate. |
| Three `PERMITTED_WRITES` statements contradicting each other — one says *"grew to its second entry"*, two say *"exactly one"* | **No.** Three English sentences disagreeing. |
| `repo-card.mjs:167` now a different line | **No** — see the rejected lint above. |
| Task 7 needing nobody in one place and the phone in three others | **No.** |
| Task 16 still marked `⏳` after landing | **Yes**, via check 10 — as a warning naming the four commits, not as a verdict. |

**So the honest claim is: the script closes the citation-shaped half of the
defect class and leaves the sentence-shaped half open.** That half is what
`specs/2026-08-29-skills-and-specialists-evidence.md`'s Candidate C routed to a
`CLAUDE.md` rule — *"check the condition before writing the claim"* — and it
stays there. **A clean `queue-audit` run must not be reported as "the queue is
correct."** It means the queue's citations resolve and its tables agree. The
output should say so in those words, the way `verify-install.mjs` already says
*"A clean run means the pipeline is ready to be tested, not that it works."*

---

## Open, not decided here

- **Whether the plan-file signal gets fixed or replaced.** Check 8 is demoted to
  a report because the signal is wrong five times out of six, and the queue
  names the choice — commit the plans, or replace the signal. **That is Karl's
  call and this script must not pre-empt it by picking one.** If plans start
  being committed, check 8 becomes a real check again with no code change.
- **Whether a landed record must name its commits.** Check 12 is a warning
  purely because no convention says it must. The restructure is the natural
  place to settle it, and if it does, say so here and promote the check.
- **What anchors the tables after the restructure.** Decision 4.1 requires a
  header line the script can find. Which headers survive is the restructure's
  decision, not this one — but it needs to be *a* decision, told to the script,
  not an accident.
- **Whether `docs/REVIEW-QUEUE.md` gets the same treatment.** Unchanged from the
  original *Consequences* below: it drifted too, and shares none of this file's
  structure. Still a second decision, made once this one is working.

## Consequences

- **Synapse work, not Watcher work.** It joins task 10 as the second item in the
  queue's scope table that changes no `watcher/` source.
- **It audits the file that lists it.** That is fine and slightly useful — the
  first real run should be against the live queue, and any finding is a finding.

  > **The first finding is already known, which makes it a usable acceptance
  > test.** At `e1acc69` the queue's newest citation is `f144992` and four
  > commits sit between them — `020d1d6` `e468728` `06a4414` `e1acc69`, task 16
  > landing — while the run order reads `16 ⏳`. **If a finished `queue-audit`
  > run against the live file at that commit reports nothing, check 10 is not
  > working.** Everything else in the file was measured clean on the same day:
  > 33 hashes all resolving and all ancestors, 30 `.md` paths all present,
  > eleven count rows all re-measuring, and the run order, `**DONE**` markers and
  > count table agreeing on the same eleven landed tasks.
- **Scripts suite grows.** It was 99, then 150, then 178 after task 10's checks;
  this adds its own.
- **It does not close the review-queue drift**, only the dispatch queue.
  `docs/REVIEW-QUEUE.md` had its own audit findings on 2026-08-28 and shares
  none of this file's structure. If the shape generalises later, that is a second
  decision made with the first one working.
