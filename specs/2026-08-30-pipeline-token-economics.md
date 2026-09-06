# Pipeline token economics

**Status: one verified finding, one corrected claim, three proposals, and
several open questions. Not a design, and not ready to dispatch.**

Written outside the pipeline by a brainstorm session, per CLAUDE.md's *"the
pipeline does not fix the pipeline."* Every proposal here would edit
`agents/*.md`, so none of them may be dispatched through Manager.

---

## 1. The observation

Karl, 2026-08-30, watching a Max 5x weekly allotment: *"every run I'm just
watching money fly out the window."*

**What was actually measured that day**, which is why this document exists
rather than a hunch:

| Work | Route | Cost |
|---|---|---|
| Tasks 19 and 20, plus a batched code review, plus seven review fixes | Direct, one warm session | **Under 1%** of the weekly allotment |
| One task | Manager pipeline | **70,893 tokens**, observed in Manager's own status line |

Karl's summary: *"the pipeline is burning tokens at an even worse rate than
just doing things from an open session."*

**The comparison is not clean and should not be quoted as though it were.**
A warm session had already read the design record and the surrounding code;
Manager started from nothing. That is precisely the mechanism below, not a
confound to be excused — but the ratio is "warm versus cold", not "good versus
bad".

---

## 2. The mechanism: orientation, paid five times

The pipeline's cost is **context re-establishment per agent**. Manager,
Architect, Planner, Coder and Reviewer each start cold and re-derive what the
task is and where the code lives. A warm session pays that once and amortises
it across every task in the session.

**This gets worse as a project grows.** Orientation cost is a function of how
much of the project a task has to navigate, and the pipeline multiplies it by
the number of agents dispatched. Watcher was cheap to work in at fifty files
and is not at its current size.

**Two honest counterweights, recorded so this document is not one-sided:**

- **The warm advantage has a ceiling.** A long session fills its context,
  compacts, and starts re-orienting anyway — without the pipeline's structure
  to show for it. Amortisation is bounded by the context window.
- **The pipeline's cost is bounded and predictable.** Each agent reads what one
  task needs and dies. A warm session accumulates everything, relevant or not,
  and its cost per task is invisible until the window fills.

**And the multiplier buys something real.** On 2026-08-30 a single batched
review of tasks 19 and 20 — both of which had full test coverage and passed 786
tests — returned **seven findings including a HIGH**: a self-removing ratchet
that had failed to fire, because it matched `field\s*:` and the new assignments
were ES shorthand properties carrying no colon. No amount of the author's own
testing would have caught it. **Independence is what the multiplier is for, and
it demonstrably works.**

---

## 3. Finding — verified: no agent definition reads the project map

    grep -l 'CONTEXT.md' agents/*.md      # returns nothing

Not one of the seven agent definitions mentions `CONTEXT.md`. Every dispatched
agent orients by searching from scratch, on every dispatch.

## 4. Correction — and it substantially reduces §3's value

**§3 was first reported in conversation as "Synapse has a project map and the
agents don't read it." That was wrong, and the error is kept here rather than
edited away.**

`CONTEXT.md` in this repository is a **glossary** — canonical vocabulary,
*"Definitions only — what a term is, not how it works."* It says a **Board** is
the viewing area and that *card* is the term while *row* is to be avoided. It
does **not** say where any code lives.

`state_machines.md` and `data_flow.md`, the other two files
`superpowers:bootstrap-project-context` produces, **do not exist in this
repository at all.**

**So the consequences split in two, and only one of them is cheap:**

- **Wiring `CONTEXT.md` as it stands buys vocabulary consistency.** Worth
  having — an agent that calls a card a row writes prose the next reader has to
  translate — but it is **not** an orientation saving, which was the entire
  argument for doing it.
- **The navigation map that would cut orientation does not exist.** Building it
  is real work, it has to be kept true as the code moves, and a stale map is
  worse than none: it sends a cold agent confidently to the wrong file.

**This correction matters because §2 identifies orientation as the term that
scales.** The cheap fix addresses the wrong term.

---

## 5. Three proposals

### A. Gate Planner on an existing record — the largest single saving

Manager **already does this for one case**. Its definition: *"If the user gives
a path to a written plan rather than a task to be planned, skip step 1 entirely
and start at step 2."*

**The gate is too narrow.** `watcher/docs/2026-08-29-watcher-card-back.md`
already specified tasks 19, 20 and 21 down to the field shapes, the caps, the
tie-break requirement and the empty-repository case. Dispatching Planner
against that pays a cold agent to re-derive a document that already exists.

Evidence: both tasks were built straight from that record on 2026-08-30 and no
plan was wanted at any point.

**Shape of the change:** extend the existing skip so it fires on a *record that
specifies the task*, not only on a document whose filename says "plan". One of
five agents dropped on any task a design record already covers — which, in this
project, is most of them.

**The risk, stated:** "the record already specifies it" is a judgement, and
Manager cannot read the record to check — it reads only summaries. So the
judgement falls to whoever queues the task. That is a weaker gate than the
existing one, and it is the main thing to argue about.

### B. Build a navigation map, then wire it

Per §4 this is two pieces of work, not one, and the second depends on the
first. **Not costed here.** The questions it raises are in §6.

### C. Manager states the dispatch shape before spending it

The research-confirmation gate added to `synapse-manager.md` on 2026-08-30
(`a0a9ef9`) is the right shape applied to one case: state what would be spent,
what it buys, and what you would do instead, then wait for an explicit yes.

**The general version:** before dispatching, Manager names which agents it
intends to run and why each one, including any it is skipping. Karl approves or
trims.

**This reduces nothing by itself.** It converts an invisible cost into a
decision. That is worth saying plainly rather than counting it as a saving.

---

## 6. Open questions — Karl's, not the next session's

1. **Does §5A's gate belong to Manager or to the queue?** Manager cannot read
   the record. Either the queue entry declares "this record is the plan", or
   Manager asks the user per task. The first is cheaper and forgeable by
   inattention; the second spends a round-trip every time.
2. **Is a navigation map worth maintaining?** It is only useful while it is
   true, and a stale map actively misdirects a cold agent. What keeps it
   honest — a script, a Reviewer brief, or nothing?
3. **Should `CONTEXT.md` be wired anyway**, on the vocabulary argument alone,
   given §4 says it buys no orientation saving?
4. **Is there a task-weight notion Manager should have at all?** Step 0 gates
   Architect on task difficulty. Nothing gates the pipeline itself, so a pure
   parser and a subsystem redesign cost the same five contexts.
5. **Does any of this change where the pipeline is worth using**, rather than
   how much it costs? That is a positioning question about the flagship, and it
   is better answered before a public ship than after.

---

## 7. Explicitly not proposed

- **Capping or narrowing research.** Karl ruled on this on 2026-08-30: *"I
  don't want to handicap the pipeline if I don't have to."* The findings are
  worth their cost; the gate makes the spend visible, not smaller.
- **Removing or weakening Reviewer.** §2 records why: it found seven issues,
  one HIGH, on two fully-tested tasks that the author believed were clean.
  Reviewer is the part of the multiplier that most clearly earns its cost.
- **Any change made through the pipeline.** CLAUDE.md forbids it, and a green
  pipeline run under the old definitions would prove nothing about the new
  ones.
