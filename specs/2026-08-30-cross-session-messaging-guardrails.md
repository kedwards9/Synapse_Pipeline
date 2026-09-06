# Cross-session messaging — the isolation premise has changed

**Date:** 2026-08-30
**Status:** open question. **Not a design, and not ready to dispatch.**
**Covers:** `agents/synapse-manager.md`, `CLAUDE.md`'s concurrent-sessions rules
**Revisits:** `specs/2026-08-25-session-attribution-design.md`,
`specs/2026-08-29-manager-worktree-isolation.md`,
`specs/2026-08-29-commit-gate.md`
**First and only data point:** `R47` in `docs/REVIEW-QUEUE.md`

> **Routed outside the pipeline, by standing rule.** This record would edit
> `agents/synapse-manager.md`, so it is implemented by a plain session and never
> dispatched to `synapse-manager`. A Manager session changing its own definition
> runs the old text for the whole run and cannot exhibit what it just approved —
> see *"The pipeline does not fix the pipeline"* in `CLAUDE.md`.

> **Deliberately not in `docs/REVIEW-QUEUE.md`.** That queue is Watcher-facing.
> This is about the pipeline and the Manager agent, and nothing here is a
> Watcher defect. `R47` stays in the queue as the verification of one specific
> relay; it could reasonably move here later, and that is Karl's call, not a
> tidying job for the next session.

---

## 1. What happened

On 2026-08-30 the brainstorm session `synapse-1d` sent Karl's answer on task 22
directly to the Manager session `synapse-3e` using `SendMessage`, rather than
Karl pasting it into that window. The message carried a long verdict, six
observations, and six instructions about what the pipeline should and should not
do next.

**It appears to have worked.** That is the whole of the evidence, and it is not
enough. Karl, immediately after: *"I think it would need a much stronger review
than one instance and I'm more than sure there are guard rails missing to make
it effective."*

**One pass on a state-dependent question is the `R34` shape**, which this
project has now been bitten by five times in three days. A relay that worked
once, between two sessions started by the same person, on the same machine, in
the same repository, with a human watching both, proves approximately nothing
about the mechanism.

## 2. The gap that is measured rather than argued

**`synapse-manager.md` grants `SendMessage`, and its body grounds that grant for
exactly one thing: continuing its own subagents.** Two sites — resuming an
existing coder, and sending a reviewer back for a revision, both passing context
forward within the pipeline it owns.

**Its definition has no notion of a peer session message at all.** It received
this one as an unmodeled input: no instruction on how to authenticate the
sender, what authority a peer's message carries, whether a peer may override the
queue, or what to do when a peer contradicts the user.

By `CLAUDE.md`'s *"nothing half-built"* test the grant is **live and correctly
grounded** — for a use other than the one just made of it. That is not an audit
failure. It is a capability being exercised outside the envelope its own
definition describes, which `scripts/agent-audit.mjs` cannot see, because the
audit asks whether a definition contradicts itself and this one does not.

## 3. Two existing designs assumed sessions cannot talk

This is the part that makes it a spec rather than a to-do.

**`specs/2026-08-25-session-attribution-design.md`** exists because *"neither
session can see the other, so without attribution each one reads the other's
commits as unexplained drift."* Its entire remedy is a `Session:` trailer in git
history — a **ledger**, readable after the fact, because live coordination was
assumed impossible.

**`specs/2026-08-29-manager-worktree-isolation.md`** gives the pipeline its own
tree so *"neither session can overwrite the other's uncommitted work"* — and is
explicit that a worktree *"separates working trees, never history."*

**A relay punches through both.** Two sessions now coordinate live, and:

- **Nothing lands in the ledger.** No commit, no trailer, no trace. The command
  `CLAUDE.md` tells a reader to run to reconstruct who did what will not show
  that this dispatch happened at all. The relay is invisible to the exact
  instrument built to make concurrent sessions legible.
- **The worktree still separates the trees, and that is now a hazard rather
  than only a protection.** A message can name work the receiving session's
  worktree cannot see, and neither party is told.

Neither spec is wrong. Both were written against a premise that no longer holds,
and neither has been revisited.

## 4. The gaps, as observed

**4.1 Addressing is a guess.** `ListAgents` returns per-session arbitrary names
(`synapse-3e`). There is no way to address a **role** — "the Manager session
working task 22." The target here was inferred from a timestamp and an
`interactive` flag. A wrong guess delivers a long directive into an unrelated
session's context.

**4.2 The guard line is a convention, not a mechanism.** The message opened with
*"if you are not the synapse-manager session working task 22, ignore this and
say who you are."* That was improvised thirty seconds before sending. It has no
enforcement, no schema, and no reason to survive into the next relay except that
someone remembers it.

**4.3 `success: true` means queued.** Not delivered, not read, not understood,
not obeyed. There is no receipt and no acknowledgement. Three of `R47`'s six
checks exist solely to compensate for this by hand.

**4.4 Authority laundering.** The receiver sees `from="synapse-1d"` and nothing
more. **Nothing distinguishes "the user decided this, relayed" from "a peer
agent decided this."** The attribution in this message was hand-written into the
body; nothing required it, verified it, or would have noticed its absence.

The `SendMessage` contract warns about **permission** laundering — asking a peer
to perform what your own session was denied. **This is the authority version and
it is not covered.** A Manager that treats a peer's message with the weight of a
user instruction has had its human-in-the-loop removed by a mechanism designed
for coordination.

**4.5 It bypasses the commit gate.** `specs/2026-08-29-commit-gate.md` exists so
that the pipeline builds only what was committed — because an uncommitted record
*"exists on exactly one disk, has no history, and is invisible inside the
pipeline's worktree."* **A relayed instruction has all three properties and can
carry the weight of a queue entry anyway.** `R46` was committed before the relay
by discipline, not because anything enforced it.

**4.6 No idempotence.** A message sent twice is acted on twice. The result
carries a `msg_id`; nothing consumes it.

## 5. What is NOT being proposed here

- **Not a ban.** The mechanism is useful and the one observed use was a good
  one: it carried a verdict the pipeline was blocked on, in seconds.
- **Not a protocol design.** Naming the gaps is not the same as choosing
  remedies, and choosing them before a second data point exists would repeat the
  error this record is about.
- **Not an `agents/*.md` edit yet.** Nothing changes in Manager's definition
  until the questions below are answered, because a rule written now would be
  written against a single instance.

## 6. Open, not decided here

1. **Does Manager's definition need a peer-message section at all**, or is the
   correct answer that Manager should **refuse** peer messages and route
   everything through the user and the queue? Refusal is a real option and is
   cheaper than a protocol.
2. **What carries authority?** If a peer message may relay a user decision,
   something must distinguish that from a peer's own opinion — and whatever it
   is, a peer session can forge it. This may have no good answer, which would
   argue for (1)'s refusal branch.
3. **Should a relay leave a ledger entry**, and what would that even be? A
   commit costs a round trip and is the only durable record this project trusts.
4. **Does the commit gate extend to messages?** "Do not relay an instruction
   naming a record that is not committed" is a one-line rule and would close 4.5
   entirely.
5. **Is role addressing worth building** — some convention by which a session
   announces what it is — or is the guard line, written down properly, enough?

## 7. Evidence

`R47` in `docs/REVIEW-QUEUE.md` is the verification of the single relay this
record is built on. **It is one data point and must not be read as a review.**
Its six checks are independent by design, so a failure names a specific gap
above rather than a mood.

**A second data point should be a deliberate one**, not the next time it happens
to be convenient.
