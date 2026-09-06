# Composition-Root Seams — portable pattern

**Status:** Pattern, project-independent.
**Companion:** `stream-orchestration-design.md`, which depends on this pattern
being applied before its parallelism is worth anything.

For the concrete first application of this pattern — the specific files in the
<consumer-repo> codebase — see that project's own spec. This document deliberately
contains no project-specific file names.

---

## The problem this solves

Parallel work streams need to touch disjoint sets of files. In most codebases
they cannot, because a small number of files are touched by *nearly every*
feature:

- the composition root that wires everything together
- the main update/tick pipeline
- the main render/output path
- the primary entity or state constructor
- raw state literals duplicated across test fixtures

Any file-level conflict check will find that every stream collides on these,
queue them all onto one owner, and serialise the work again — behaving
correctly and buying nothing.

**This is not hypothetical.** It is the standard failure of feature-parallel
work, and it shows up first as "why did we have to run these plans in a
specific order?"

## The pattern

**Composition roots become append-only registries. Test fixtures become
factories.**

The shared edit cannot be removed — new work has to reach the running program
somehow. It can be *demoted*: from "rewrite this function" to "append one line
to a list."

Append-only lists merge cleanly. Rewritten pipelines do not.

| Shape | Before | After | Mechanical? |
|---|---|---|---|
| Test fixtures | N raw literals hand-edited per new field | One factory with overrides | **Yes** |
| Entity/state constructor | Every feature adds fields inline | Per-slice fragments | **Yes** |
| Composition root | Every feature edits the literal | Spreads per-slice fragments | **Yes** |
| Update pipeline | Hardcoded sequence, rewritten by each feature | Folds over an ordered registry | **No — see below** |
| Render/output path | Hardcoded call sequence | Ordered layer list | **No — see below** |

**Apply the test-fixture factory first.** Cheapest, lowest risk, independent of
the rest, and it pays for itself immediately.

### The last two are not mechanical — verify before assuming

The first three are shape-preserving edits. The last two are not, and a naive
registry can be actively worse than the hardcoded version it replaces. Both
failure modes below were found in a real codebase *after* this pattern was
written, which is the reason for this section.

**An update pipeline is often a data-flow, not a step sequence.** Steps may
consume each other's output with *heterogeneous intermediate shapes*, and may
accumulate a value across several steps that is applied at the end. A registry
of `(state) => state` cannot express that. It needs an explicit accumulator —
`{ state, ...accumulated }` threaded through the fold — plus a context object
carrying per-tick inputs that are computed once and read by several steps.
**Design the accumulator before planning the refactor.**

**A render path may have more than one transform pass.** If some layers draw
under one transform and others under a different one — a rotated world pass
versus a billboarded screen-space pass, say — then layers are **not
interchangeable**, and a flat ordered list invites registering a layer into the
wrong pass. That failure is silent and visual: things render, just wrongly
transformed. The list must be **pass-aware**, so that a layer declares which
pass it belongs to and cannot be added to a flat sequence by accident.

**General rule: before converting a hot function to a registry, check whether
its steps are actually peers.** If they differ in what they consume, what they
produce, or what ambient state they run under, they are not peers, and a flat
registry will encode a lie about the code.

## Acceptance criteria

1. Adding a unit of behaviour requires **no edit to the body** of the pipeline
   it plugs into — only a new file plus a registry append.
2. Adding a state field requires **one** fixture edit, not one per literal.
3. Ordering stays **explicit and reviewable** — registries are ordered lists,
   not implicit discovery or auto-registration by import side effect. Implicit
   ordering trades a merge conflict for a heisenbug. *Explicit is not the same
   as enforced — see criterion 5.*
4. Behaviour is unchanged: the full suite passes before and after, with no test
   rewritten to accommodate the refactor (fixture migration excepted).
5. **Ordering constraints are executable.** Every constraint on a registry's
   order — "X runs first", "Y must precede Z", "W runs last" — is asserted by
   a test, not only described in a comment. A registry whose order genuinely
   does not matter **says so explicitly**, because that is a claim which can be
   wrong and which the next contributor will otherwise have to guess at.

### Why criterion 5 exists — the merge that does not conflict

Criterion 3 is satisfied by an ordered list with its constraints written above
it in a comment. That is not enough, and the reason is specific.

Two contributors adding entries at **different positions** in the same registry
produce a clean automatic merge. Not a trivial conflict someone resolves
carelessly — **no conflict at all**:

    $ git merge second-change
    Auto-merging registry
    Merge made by the 'ort' strategy.
     1 file changed, 1 insertion(+)

Both entries land, in an order neither contributor chose, and a documented
constraint such as "this one runs last" is now false. Nothing errors. The build
passes, the suite passes, and the comment stating the constraint is still
sitting there, still being read as though it were true.

This is the failure mode the pattern is *supposed* to eliminate, reappearing in
a worse form. The hardcoded function it replaced would have produced a genuine
merge conflict, forcing a human to look. **Demoting the shared edit to an
append is what makes the merge clean, and a clean merge is exactly what removes
the signal.** A comment cannot fail a build; only a test can.

So the ordering constraints are part of the seam, not documentation about it.
Write them as assertions in the same change that creates the registry — a
registry landing without them is incomplete, not merely untested. Each
assertion should carry the *reason* for the constraint, since a bare positional
assertion tells a future reader that the order matters but not what breaks if
it changes.

Where order genuinely is free, assert nothing and record that fact in the
registry instead. The point is that the next contributor never has to infer it.

## Constraints on applying it

- **It runs alone.** By definition it edits every hot file. Nothing else may be
  in flight. This is the last serial piece of work before parallelism is
  usable.
- **Not every shared file needs a seam.** Two features occasionally touching a
  file is normal. **Three or more concurrent is the trigger.**

## Growth

The seam set grows in two ways, and only one matters:

- **Registries growing is the mechanism working.** Ten registered units collide
  no worse than two. Free.
- **New composition roots appearing is real growth.** Persistence, audio, a UI
  root, networking — each is a plausible future hot file. Each gets this same
  pattern; the fix is never a new invention.

**Detect it mechanically, not by collision.** A hand-maintained list of
collision-prone files goes stale exactly when the project is busiest. Generate
it from git history instead.

A composition root is not merely a file that changes often — it is a file that
changes *alongside everything else*. Two signals together identify one:

- **Commit count** in a recent window — how busy the file is.
- **Co-change breadth** — how many distinct other files it has appeared with.

A busy leaf file scores high on the first and low on the second. A composition
root scores high on both, and breadth is the signal that separates them. The
threshold stays as stated: a file reaching 3 or more commits in the window is a
candidate, ranked by breadth.

A third number is **reported but never ranked on**. *Coupled breadth* counts
only those partners that recur across two or more shared commits. Raw breadth
cannot distinguish co-evolution from commit size: a file that merely sat in two
twenty-file commits shows nearly forty partners it will never move with again.
Such a file has high breadth and near-zero coupled breadth, and the gap is
legible on the face of the table.

**It informs; it does not order.** Ranking on coupled breadth was tried and
rejected. A composition root's partners are frequently one-shot by nature — a
feature touches the root and that feature's own files, exactly once — so under
a recurrence bar a real root scores zero while a leaf that always moves with
its own test scores one. The ranking inverts. Measured against a 101-commit
consumer repo the bar behaved well, with the intended roots keeping roughly
half their breadth while commit-size artefacts collapsed by an order of
magnitude; but the inversion is structural, not a small-sample effect, and it
appears whenever history is short. Breadth stays the signal.

Tightening `--max-commit-size` was tried against the same artefact and rejected
for the same class of reason: at a bound of 15 a genuine root drops out of the
top five, and at 10 the ranking promotes a test file. A root legitimately
appears in the wider feature commits — that is what being a root means — so
bounding commit size discards the evidence along with the noise.

**Why git history rather than declared footprints.** An earlier draft sourced
this from path footprints declared by the orchestration layer's planners. That
layer is not being built — see §17 of the companion spec — so depending on it
would have made detection unbuildable. Git history needs nothing but the
repository, works on any project from its first commit, and reports what the
code actually did rather than what a planner predicted.

`scripts/hot-files.mjs` implements this.

## Prior art

**Nothing in the remedy is new.** Every technique above has a name and a
literature, most of it decades old. This section exists so that a reader
reaches the mature version instead of reinventing it — and so that the one
genuinely new claim, in the section that follows, is not mistaken for the
machinery it rests on.

| This spec's move | Established as | Where |
|---|---|---|
| Demote "rewrite this function" to "append one line" | **Open/Closed Principle** — open for extension, closed for modification | Meyer, *Object-Oriented Software Construction*, 1988 |
| The term *composition root* itself | The single place an application's object graph is assembled | Seemann, *Dependency Injection in .NET* |
| Test fixtures become factories | **Object Mother**, then **Test Data Builder** | Object Mother named on a ThoughtWorks project, popularised by Fowler; Test Data Builder, Nat Pryce, 2007, and *Growing Object-Oriented Software, Guided by Tests* |
| Registries instead of hand-edited wiring | Plugin / component registries | Imposed by most frameworks — Django `INSTALLED_APPS`, Spring component scan, pytest plugin hooks |
| Rank files by co-change breadth from git history | **Logical** or **temporal coupling** | Gall, Hajek & Jazayeri, ICSM '98; Zimmermann et al., ICSE 2004; productised as hotspot and change-coupling analysis in Tornhill's *Your Code as a Crime Scene* (2nd ed. 2024) and *Software Design X-Rays*, and in CodeScene |

Two consequences worth acting on rather than merely noting:

- **`scripts/hot-files.mjs` is a small reimplementation of a well-studied
  metric, and its thresholds have now been checked against it.** The 3-commit
  minimum is no longer a guess. Minimum-revision floors in this literature are
  **absolute counts, not ratios**: CodeScene ignores files under 10 revisions,
  and ROSE's association-rule support is a transaction count, evaluated at
  values as low as 3. A ratio was considered and rejected — 3% of a 30-commit
  window rounds to 1, which would admit single-touch noise and break the
  invariant that a file touched once never appears. CodeScene's 10 was rejected
  too: on a 101-commit repo it drops a file with 9 commits and 61 partners, a
  real root lost to a one-commit shortfall. Their 50-file changeset bound,
  which this script already matched, is the one number that transfers
  unchanged. What does **not** transfer is pairwise coupling *strength*: it
  answers "which two files must change together", a different question from
  "which file collides with everything", and importing it inverts our ranking.
- **The fixture factory has a mature ergonomics story** — traits, sequences,
  nested overrides — already worked out by the Test Data Builder line and by
  `factory_bot` (Ruby, 2008). Borrow from it as the factory grows instead of
  re-deriving it under pressure.

**What is not prior art is the reason for doing any of it.** The work above
motivates these techniques by *human* cost: merge pain, coordination overhead
across teams, onboarding time. The claim in the next section is different in
kind — that seams are the binding constraint on **machine** parallelism, and so
a precondition rather than a quality improvement. A human team negotiates a
contended composition root in a chat channel. Parallel agents have no channel
and no judgement to bring to it.

## Why this is a prerequisite, not an optimisation

Without seams, the orchestration layer's dispatch rule finds a collision on
every stream and serialises everything. The machinery would be correct and
useless. Seams first, then parallelism.
