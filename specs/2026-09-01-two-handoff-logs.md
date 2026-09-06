# Two handoff logs, split on something observable

**Decided 2026-09-01, 11:00 AM.** Karl's call, in terms: *"I hate to call it a
brainstorming handoff when it's not purely brainstorming."* Applied under KISS,
which is where the argument actually lands.

---

## 1. What changes

**Three logs become two.**

| Today | After |
|---|---|
| `HANDOFF.md` — code-work sessions | `HANDOFF.md` — **a person's session, whatever it turned into** |
| `BRAINSTORMHANDOFF.md` — brainstorming sessions | *(gone — its entries become `HANDOFF.md`)* |
| `MANAGERHANDOFF.md` — the pipeline | `MANAGERHANDOFF.md` — unchanged |

**The live log keeps the generic name.** That matters beyond taste: `HANDOFF.md`
is the default the shipped commands hand a stranger, so this repo ends up
matching the shipped default instead of diverging from it.

**The old `HANDOFF.md` is archived, not deleted.** Its 23 entries are a real
record of the 2026-08-23 to 08-27 period.

---

## 2. Why the third log has to go

**The split that survives is the one that is observable.**

- *"Is this session brainstorming or code-work?"* — **unanswerable.** A session
  slides between thinking, editing and dispatching with no moment where the mode
  changes. This very session read handoff archaeology, reorganised a folder and
  rewrote two commands; no label fits it.
- *"Did a person write this, or did the pipeline?"* — **crisp, always, and needs
  no judgement.** You know which one you launched.

**Every place this project stopped trying to name a session's kind got simpler,
and every place it kept trying stayed stuck.** Three symptoms, one cause:

1. **The third `Session:` trailer value**, rejected 2026-08-27 after four
   sessions of raising it — *"a distinction the session never actually made."*
   See `specs/2026-08-25-session-attribution-design.md` §4.
2. **Session-type measurement**, attempted 2026-09-01 and abandoned — there is
   no session-kind variable to stratify entry sizes by, because the kind does
   not exist. §3 below.
3. **A log named after a mode**, which is this spec.

**This spec removes the third. It does not re-open the first** — no new trailer
value is proposed here, and the two values stay `manager` and `brainstorm`.

> **The trailer keeps a name this spec retires, and that is deliberate.** The
> trailer's `brainstorm` value means *"not the pipeline"*, which is exactly the
> distinction being kept. Renaming it would be churn across 400+ commits to fix
> a word, and the commit ledger is the one place the value is actually read.

---

## 3. The evidence

**Measured 2026-09-01. Every figure here is reproducible from the tree.**

### The third log was already dead

`HANDOFF.md` #23 was written **2026-08-27 at 8:22 PM**. `BRAINSTORMHANDOFF.md`
#1 was written **the same evening at 9:16 PM — 54 minutes later** — and has
taken **all 16 entries since**, across five days.

**That is not a log falling gradually out of use. It is a log that was replaced
within the hour**, while both files stayed live in the commands and in every
session's instructions.

### What the split costs to maintain

| Location | Bytes doing file-selection |
|---|---|
| `session-hand-off.md` — the "Pick the file first" block through Additional Notes | 3,046 |
| `takehandoff.md` — its own step 1 through step 3 | 2,351 |
| **Total** | **5,397** |

**3,046 of `session-hand-off.md`'s 9,959 bytes — 31% — answer one question:
which of three files does this session write to.** A three-way pick, a lock in
both directions, an *"ask in exactly two cases"* rule, and a *"never bring a new
log into existence by inference"* rule.

**With two logs the picker is one line:** *did the pipeline write this? No →
`HANDOFF.md`.*

### The measurement that failed, and why it is filed as evidence

Entry sizes across `BRAINSTORMHANDOFF.md` #1–16: mean **9,403** bytes for #1–12,
standard deviation **≈1,153**.

Splitting those 16 entries by how pipeline-heavy their content is:

| Group | n | Mean bytes |
|---|---:|---:|
| Pipeline-heavy | 10 | 9,590 |
| Assistant-mode | 6 | 8,446 |
| **Difference** | | **1,144** |

**Session type accounts for roughly one full standard deviation** — the largest
single signal in the data. And #13–#16, the entire post-index-spec sample, all
fall in the assistant-mode group.

Controlling for that: pre-spec assistant-mode entries (#5, #10) mean **8,467**;
post-spec (#13–16) mean **8,436**. **A difference of 31 bytes, 0.4%.**

> **Two consequences, and the second is the one that matters here.**
>
> **`specs/2026-08-30-handoff-as-index.md` §10 is wrong in its number.** It
> reported 4% from an uncontrolled comparison of n=12 against n=2. Controlled,
> the index spec's effect is approximately zero — which **strengthens** its
> conclusion that principle did not bind, while invalidating the figure it used
> to argue it. That correction belongs in that spec and is listed in §6.
>
> **Stratifying requires a session-type variable, and §2 says one cannot exist.**
> So entry-size efficiency is not merely hard to measure here — it is
> **unavailable, permanently.** Correctness is checkable at n=1; efficiency is
> not checkable at all. That asymmetry is a reason to prefer deleting machinery
> over tuning it, which is what this spec does.

**The caveats, stated because the numbers above are weak on their own:** the
grouping proxy is a keyword count, not observed session behaviour, and it
conflates *ran the pipeline* with *talks about the pipeline*. Cells are n=6 and
n=10; the controlled cells are n=2 and n=4. The threshold was chosen after
seeing the data. **None of this would carry a claim on its own. It is filed as
corroboration for a decision made on the structural argument in §2**, which
stands without it.

---

## 4. Migration

**Order matters only in one place: the archive is renamed before the live file
takes its name.**

1. **Archive the old log** as `HANDOFF-ARCHIVE.md`, with a header stating it
   covers 2026-08-23 to 2026-08-27 and that its numbering is its own.
2. **Rename `BRAINSTORMHANDOFF.md` → `HANDOFF.md`** with `git mv`, so history
   follows. **Entry numbering continues from #16** — do not renumber.
3. **Update the file-level preamble**, which currently says numbering is
   independent of `HANDOFF.md` and `MANAGERHANDOFF.md`.
4. **Simplify both commands** — see §5.
5. **Update `README.md` and `CONTEXT.md`**, both of which describe the
   three-log layout.

### The one real hazard: what the archive is called

`watcher/src/main/handoff.mjs` matches candidates with `HANDOFF_FILE_SUFFIX`,
which is `/HANDOFF\.md$/i`, and `selectMostRecentHandoffFile` takes **whichever
matching file was modified most recently.**

- **`HANDOFF-ARCHIVE.md` is safe** — it ends in `ARCHIVE.md` and does not match.
- **`OLD-HANDOFF.md` would match.** Touch it once and Watcher's card silently
  reports a 2026-08-27 entry as the current one.

**Name the archive so it cannot match, and do not improvise a different name.**

### Numbering, and the ambiguity it leaves

`HANDOFF.md` continues at #17 while `HANDOFF-ARCHIVE.md` holds #1–23. **Entry
numbers stay unique within each file**, which is the property `/takehandoff` and
`/handoff-history` actually rely on, so nothing breaks.

**The cost is that "`HANDOFF.md` #12" means different entries in different
eras.** Accepted rather than solved: renumbering 16 entries would rewrite every
existing cross-reference to buy tidiness in a file nobody reads sequentially.

**Existing references to `BRAINSTORMHANDOFF.md #N` will fail loudly** once that
filename is gone, which is this project's stated preference over a path that
silently resolves wrong.

---

## 5. What the commands become

**`session-hand-off.md`** — the three-way pick, the brainstorm/code-work lock in
both directions, *"ask in exactly two cases"*, and *"never bring a new log into
existence by inference"* all collapse into: **write `HANDOFF.md` unless the
`manager` argument was passed.** The `brainstorming` argument becomes a no-op
alias or is retired.

**`takehandoff.md`** — same collapse in its step 1, and its step 2 lock (*"if
this is a brainstorming session, `HANDOFF.md` is off limits in BOTH
directions"*) is deleted outright. It exists to keep two logs from contaminating
each other and there will be one.

**Expected saving: most of 5,397 bytes**, against a rewrite that added 2,932
earlier today. **Measure it the same way** — `wc -c` on the command files,
stated with session startup outside the number.

---

## 6. What this does not change

- **The `Session:` trailer keeps both values**, `manager` and `brainstorm`. No
  third value; that decision is settled and is not re-opened here.
- **`MANAGERHANDOFF.md` is untouched**, including the rule that the pipeline
  cannot invoke `/session-hand-off` itself.
- **`/session-hand-off` stays user-invoked only.**
- **`HANDOFF.md` remains the shipped default** for a project with one log. This
  spec makes the repo match that default; it does not change it.
- **Watcher needs no code change.** Its selection is by recency over a suffix
  match, and both survive.

## 7. Open questions

1. **Does `HANDOFF-ARCHIVE.md` ship?** `docs/history/` does not, and this is the
   same class of file under a different name. Not decided here.
2. **Does the `brainstorming` argument become a silent alias or an error?** An
   alias is kinder to muscle memory; an error tells the user the world changed.
3. **Should `specs/2026-08-30-handoff-as-index.md` §10 be corrected in place**
   with the controlled comparison from §3, or annotated? Its recommendation
   survives; its number does not.
