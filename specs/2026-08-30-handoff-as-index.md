# A handoff is an address book, not a copy

**Status: design note for a future rework of `/session-hand-off` and
`/takehandoff`. Not a plan, nothing dispatchable.**

Karl's framing, 2026-08-30, and it is better than anything either of us had
said earlier in the day:

> *"It's kind of the reason why I have the session handoffs — so that you have
> an idea that something is there. You just don't know exactly what, because
> you haven't seen it in two days."*

**A handoff does not carry context forward. It carries POINTERS to where the
context lives**, so the next session knows something exists and can go read it
surgically instead of not knowing to look.

---

## 1. Why this matters beyond the handoff

It is the same principle as three other things built or tightened on
2026-08-30, and none of us noticed they were one idea until the last hour:

| Scale | The rule |
|---|---|
| A line of code | **Cite by symbol, never by line number.** A symbol is an address you can jump to. |
| A repository | **`CONTEXT.md` as a map.** Do not search the tree when the address is written down. |
| A file edit | **Aim before you cut.** `grep -n SYMBOL` → slice → `Edit`. The finding costs more than the cutting. |
| A session | **The handoff.** Know what exists and where, not what it said. |

**Know the address before you travel.** Four scales, one idea.

## 2. The test every line of a handoff should pass

**Point at anything that has an artifact. Carry only what has none.**

That is mechanical enough to apply while writing, and it splits the current
template cleanly:

**Pointer-shaped, and already right:**

- **Repo State** — branch, commit, tree status, suite counts. Cheap,
  verifiable, and the next session re-runs it anyway.
- **Files Changed & Why** — paths. Exactly an address book.
- **Commands to Run** — reproducible, and it is how the state gets checked.

**Narrative-shaped, and mostly reproducible from artifacts:**

- **Key Decisions & Why** — usually a spec or a record exists. Point at it.
- **Task Status & Next Steps** — the queue and the dispatch queue already hold
  this. A handoff that restates them will disagree with them within a day.

**Narrative-shaped and NOT reproducible — this is the part worth keeping:**

- **Tried & Rejected.** A dead end that was never written up exists nowhere
  else. There is no artifact to point at, because nobody writes a record for
  an approach they abandoned. **This is the irrecoverable part**, and it is
  what stops the next session re-treading ground.

## 3. What was observed, rather than assumed

**Handoff #11 was long and carried conclusions as well as pointers, and some of
those conclusions died within hours of being written.** The entry recorded
"R42 challenged and upheld"; the record it points to contains three paragraphs
written that morning and killed by observations later the same day. The
handoff's own *Tried & Rejected* section documents two of them.

**That is the failure mode the index framing avoids.** A pointer to a record
does not rot, because the next session reads the record. A conclusion
transmitted in prose arrives as certainty the reader did not earn.

**What this session actually used from #11**, since it is the only evidence
available: the repo state (verified, matched), the next-steps list (diagnostic
4, R47), and Files Changed. The narrative sections were read once and mostly
not returned to — except that *Tried & Rejected* did stop R42 being
re-litigated, which is §2's point about the irrecoverable part earning its
place.

## 4. Karl's own note on provenance

> *"I wrote those commands at the very early stages of messing with Claude, so
> my knowledge wasn't really refined at all."*

The commands work and have been in daily use. **This is not a defect report.**
It is that the template was designed before the principle in §1 existed, and a
rework can now aim at something specific rather than at "capture what
happened."

## 5. Do this with the generalisation, not separately

`specs/2026-08-30-handoff-commands-ship.md` records the same day's decision that
these commands **ship with Synapse**, which requires generalising them off
Karl's three-log scheme, entry numbering and `Session:` trailer conventions.

**That is the same edit.** Restructuring the template and generalising it are
one pass over the same files, and doing them separately means writing the
template twice.

## 6. The growth is in the FILE, not the entries — measured

Karl's impression, 2026-08-30: *"my handoffs are starting to get out of
control, you can see where the content is getting bigger and bigger every
session."*

**Measured across all eleven entries of `BRAINSTORMHANDOFF.md`, that is not
happening.**

| Entries | Bytes |
|---|---|
| #1 – #3 | 9,996 · 12,161 · 8,189 — **avg 10,115** |
| #9 – #11 | 9,765 · 8,830 · 9,092 — **avg 9,229** |

Flat at roughly 9k throughout, and if anything slightly **down**. The longest
entry is #2.

**What is growing is the file: 11 × ~9k = 107KB, linearly, forever.** That is
the thing being felt, and the diagnosis matters because the remedies are
opposite — one calls for writing less per session, the other for pruning or
archiving a file nobody reads whole.

**And nothing does read it whole.** `/takehandoff` reads the topmost entry;
`handoff.mjs` is bounded to it as of 2026-08-30. **The growth is archival, not
operational**, and costs nothing per session today.

**The real opportunity is entry size, and it exists regardless of growth.**
~2,300 tokens is a great deal for a document whose job is pointing. An index
could plausibly be 600–800.

## 7. The fat is duplication, not verbosity

**Handoff #11 restated every open item from #10** — `R28`/`R45`, `R41`, `R40`,
`R37`, `R2`–`R6`, Manager's step 0 heuristic — under a heading saying they were
still open and untouched.

**That is `docs/REVIEW-QUEUE.md`, copied.** It is not a session writing too
much; it is a session **saying something a second time that an artifact already
says**, which fails §2's test exactly: it has an artifact, so point at it.

**The mechanism is compounding.** Unresolved items carry forward, so every
future entry restates a list that only grows, and every restatement is a second
copy that can disagree with the first. A pointer cannot go stale that way — the
queue is read at the moment it is needed and says whatever is true then.

**This is where the token reduction actually lives.** Not in writing tersely,
but in deleting the sections that duplicate a file the next session can open.

## 8. A verbosity argument — and why the DEFAULT is the real decision

Karl's idea: an argument on `/session-hand-off` selecting the level of record —
pointers-only, light, or the current full detail.

**Worth having, but the knob is the smaller half.** It is chosen at the end of a
session, by someone tired and out of budget, and whatever the default is will be
taken almost every time.

**So make terse the default and `--full` the opt-in.** The failure mode being
corrected is over-writing, not under-writing, and the default should be the
common case rather than the exceptional one.

**Most sessions do not earn `--full`.** 2026-08-30 would have — it reversed a
standing decision, ran a pre-registered experiment and changed eleven agent
definitions. That is the exception the flag exists for.

## 9. Open questions

1. **How short can a handoff get before it stops working?** The index framing
   argues for much shorter, and §7 says most of the fat is duplication rather
   than length. Nobody has tried it.
2. **Should old entries be pruned or archived?** §6 says the file grows
   linearly and nothing reads it whole, so the cost is zero today — but it is
   107KB after eleven entries and it never stops.
2. **Does *Tried & Rejected* deserve promotion** to the top, given §2 says it
   is the only irreplaceable section?
3. ~~**Should the template enforce the test in §2** — a prompt asking "does this
   have an artifact? then link it" — or is stating the principle enough?~~
   **ANSWERED 2026-08-31: stating it was not enough, and there is a number.**
   See §10.
4. **Do the three logs survive generalisation?** Carried from the ship spec,
   because the answer shapes the template.

---

## 10. Question 3, answered by measurement — 2026-08-31

**Entry sizes in `BRAINSTORMHANDOFF.md`, measured in bytes** — the unit that
maps to tokens, rather than lines, which move with wrapping:

| Entries | Mean bytes |
|---|---|
| #1–#12 (written before this spec) | 9,403 |
| #13–#14 (written under it) | 9,008 |

**Four percent.** §6 put a target on this: an index *"could plausibly be
600–800"* tokens against ~2,300 actual. **The target was set and missed by
roughly 4×.**

**So the answer to question 3 is enforcement, not principle.** A document the
command's author read once does not constrain the command. If the test in §2 is
to bind, it has to live in the command's own instructions.

> **Two corrections to how this was first written up**, kept because the spec
> should not be defended with a claim it never made. §6 measured entries as flat
> at ~9k and said so — so *"the spec changed nothing"* attacks a claim this file
> never advanced; the spec predicted flat entries and got them. And **#14 is not
> the longest entry**: longest by lines (183), fourth by bytes, behind #2 at
> 12,174.

**Harvested from** `docs/history/2026-08-31-spitball-notes.md` §1a, archived
dead — do not load that file.
