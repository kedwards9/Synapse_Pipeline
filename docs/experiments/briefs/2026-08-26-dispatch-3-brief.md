# Dispatch 3 brief — `synapse-architect` — 2026-08-26 16:24

Reproduced verbatim from the experiment log
(`docs/experiments/2026-08-26-session-as-orchestrator.md`). Split out to keep
that log readable. Nothing here is edited or summarised.

---

**Task.** Decide the Synapse Watcher renderer's structure, which the design spec lists as a skeleton-time decision and leaves open. Produce a decision record. Do not plan the implementation, do not write code, and do not design the visual appearance of anything.

**Project.** The Synapse Watcher is a read-only Electron desktop window that observes N git repositories the user has explicitly listed in a config file, and shows what is happening in each. It ships with Synapse as an optional feature and must work for someone who has adopted none of Synapse. Read, in this order: `docs/superpowers/specs/2026-08-26-synapse-watcher-design.md` (the design spec), `specs/2026-08-26-watcher-data-arrival.md` and `specs/2026-08-26-watcher-media-card.md` (the two prior decision records, both yours), and `CONTEXT.md` at the repo root for the canonical vocabulary.

**Why you are being dispatched before the planner.** §11a of the spec divides the design into decisions that are free to change later and decisions that are expensive to retrofit. Under *Decide before or during the skeleton* it lists **"The renderer's structure. Hand-written DOM versus a framework."** — and unlike the three items beside it, that one carries no **Decided** marker. §7.4 then adds hard requirements to it and states in terms that they "belong to the skeleton because they are the renderer's structure rather than its styling." The Walking Skeleton (§3) is the next implementation plan and it constructs the renderer. If this is not decided now, the planner or the coder decides it by default, silently, in the one place the spec says is expensive to undo.

**The fork.** Hand-written DOM with a bespoke diff, versus a framework or library that owns reconciliation (React, Preact, Solid, lit-html, or any other you judge relevant), versus any third structure you consider real. These are structurally different, they are not interchangeable later, and the spec does not choose between them.

**Settled constraints that bind your answer. Do not re-litigate any of these.**

- **Electron**, main process is Node, `contextIsolation: true`. All filesystem, git and OS access lives in the main process; the renderer talks over one IPC channel (§2, §3).
- **§3, the Walking Skeleton is plan 1 and lands alone:** one repository, one git read, one window. Its seams are `RepoSource`, `RepoSnapshot`, one IPC channel, and `config.json`. Acceptance test: a configured repository's real git state reaches the window and renders. The spec says explicitly that a plan delivering the card, the layout engine and the adapter together "has skipped the step this skeleton exists to enforce."
- **§11a's protection rule:** the renderer is a pure function of `RepoSnapshot` → DOM and holds **no state of its own**. This is the single thing that keeps every visual decision cheap, and the spec states the guarantee is gone the moment the renderer holds state the main process does not have.
- **§7.4, in full, and it is the crux of your decision.** The renderer must **diff against the existing DOM and mutate in place, never rebuild** — a rebuilt element restarts its CSS animations from frame zero, so the breathing dot hitches and the travelling sweep jumps back to its start on every poll tick, forever, at exactly the poll interval. **State drives animation by class, not by re-creation.** **Continuous motion is owned by CSS keyframes on their own clock** — data changes *which* animation runs and never re-triggers a running one. Note the tension you must resolve: §11a asks for purity of the *mapping*, and §7.4 says that purity must not be obtained by discarding nodes.
- **§7.1, the motion rule:** every pixel of motion traces to a fact. Ambient motion that runs regardless of truth is stated to be strictly worse than a static window.
- **§5.3, §6, §10** are the load the structure must eventually carry, though none of them are in the skeleton: content tiers that resize cards between sizes, a layout engine choosing column count to maximise card area, cards reflowing around a dragged card, a card flip, and an overlay. §7.4 names tier changes and reflow as "the first places a replace-the-DOM renderer would betray itself." §11a names §6's layout engine and §10's drag, flip and overlay behaviours as the parts that would be rewritten if the structure changed.
- **The board is heterogeneous.** The media card decision record (yours) established a tagged card union — `RepoSnapshot` is no longer the only thing a card renders. Whatever structure you choose must express that union without special-casing.
- **Packaging is an open question and adding dependencies is not free.** Synapse has no root `package.json`; your data-arrival record already established that the Watcher needs its own package because `chokidar` ends Synapse's zero-dependency property, and the media card adds a spawned helper process on top. If your answer adds an npm dependency, a build step, or a compile stage, say so explicitly and state the consequence for packaging rather than leaving it implied.
- **Windows-first.** Architect platform-neutral, test on Windows, do not block on Linux.

**The structural questions to decide.**

1. **Which structure, and why it beats the others under §7.4 specifically.** Not which is more popular or more pleasant to write. The test is: given the same `RepoSnapshot` arriving on a slow poll that never turns off, which structures leave an unchanged element's running CSS animation untouched, and which need discipline or escape hatches to do so? Where a framework can do it, say what it costs — keys, memoisation, refs, an explicit opt-out of reconciliation — and be concrete about whether that discipline is enforceable or merely conventional, because §2's read-only guarantee is held to exactly that standard elsewhere in this design.

2. **Whether a build step enters the project, and what that does to the skeleton.** JSX, TypeScript, bundling, and dev-server tooling are the usual companions of the framework options. State plainly whether your choice requires one, whether the skeleton can be run and tested without it, and how it interacts with the open packaging question.

3. **Where the diff boundary sits.** Whole board, per card, or per field within a card. The answer has to survive cards being added and removed, cards changing tier and therefore changing what they contain, and the order array in `config.json` reordering cards without re-creating them.

4. **How "the renderer holds no state" is kept true in practice**, given that any real renderer holds *something* — node references, a keyed map, a framework's internal fibre or signal graph. Draw the line between bookkeeping that is compatible with §11a's rule and state that violates it, in terms a reviewer could check a diff against.

5. **How this is tested.** §14 requires an invariant test that fails if any rendered value derives from a watch event payload, and asks for tier selection and column count to be unit-testable as pure functions without a window. State what your structure makes testable, what it makes hard, and whether the renderer can be exercised headlessly at all.

6. **The migration cost if this decision is wrong.** §11a claims restyling is free either way and restructuring is not. Say what specifically would have to be rewritten to move from your choice to the main alternative after the skeleton lands, so that the user is choosing with the reversal cost visible rather than implied.

**Explicitly out of scope for you.** The visual design (palette, typography, card composition, animation timings) — all of it is §11a free-to-change and none of it is yours. The layout algorithm's parameters. Anything in §12's open questions: packaging and distribution is question 2 and stays open; the two deferred visual questions are 3 and 4. Do not decide the window's transparency or translucency — the orchestrator has surfaced that to the user as a separate gap, and it is a construction-time window-object question rather than a renderer-structure one.

**Deliverable.** A decision record covering the above, with rejected options and why, and the consequences the Walking Skeleton's implementation plan will have to honour. Follow this repo's existing convention for where decision records live; `specs/` holds dated design and decision documents, and your two prior records are there. Note explicitly anything you could not verify and that the plan must confirm before relying on.
