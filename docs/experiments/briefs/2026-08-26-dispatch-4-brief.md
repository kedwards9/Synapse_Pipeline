# Dispatch 4 brief — `synapse-planner` — 2026-08-26 16:38

Reproduced verbatim from the experiment log
(`docs/experiments/2026-08-26-session-as-orchestrator.md`). Split out to keep
that log readable. Nothing here is edited or summarised.

---

**Task.** Write the implementation plan for the Synapse Watcher's **Walking Skeleton, and nothing else**. Do not write code. The design is approved and three decision records are closed; your job is to turn the skeleton — and only the skeleton — into a numbered, executable plan.

**Project.** The Synapse Watcher is a read-only Electron desktop window that observes N git repositories the user has explicitly listed in a config file, and shows what is happening in each. It ships with Synapse as an optional feature and must work for someone who has adopted none of Synapse.

**Read these, in this order. All four are approved and none of them are yours to revise.**

1. `docs/superpowers/specs/2026-08-26-synapse-watcher-design.md` — the design spec. §2 (settled constraints), §3 (the skeleton), §4 (data arrival), §7.4 (smoothness), §11 (configuration), §11a (what is expensive to retrofit), §13 (out of scope) and §14 (testing) are the sections that bind you. §5, §6, §8, §9, §10 describe features that are **not in this plan**.
2. `specs/2026-08-26-watcher-renderer-structure.md` — the renderer decision, closed today. Its *Consequences* section states the skeleton's boundary explicitly. Treat that boundary as the definition of done.
3. `specs/2026-08-26-watcher-data-arrival.md` — how state arrives.
4. `specs/2026-08-26-watcher-media-card.md` — the media card. **Not in this plan.** Read it only for the two things that touch the skeleton's seams: the tagged card union, and the `protocol.handle` custom scheme it already requires.

`CONTEXT.md` at the repo root holds the canonical vocabulary. Use its terms — *board*, *card*, *live signal*, *error latch*, *mute*, *degraded* — and do not invent synonyms. Note that *row* is listed under _Avoid_.

**Scope — the hardest constraint in this brief, and the one most likely to be violated.**

§3 says: one repository, one git read, one window. Acceptance test: *a configured repository's real git state reaches the window and renders.*

§3 also says, in terms: *"A plan that tries to deliver the card, the layout engine, and the adapter together has skipped the step this skeleton exists to enforce."*

The renderer decision record then bounds it further, and this is the operative list. The skeleton lands: **one `<template>`, one `create`/`update` pair, the keyed id → node map, the compare-before-write setters, and the node-identity test.** It does **not** land tiers, the fit solver, drag, flip, or the overlay.

Therefore **out of this plan**, explicitly: the media card; the Synapse hook-log enrichment adapter; §5.3 content tiers; §6's layout algorithm and column-count solver; §8 stall detection, mute and the error latch; §9's degraded rendering; §10's six-pixel gesture, drag-to-arrange, flip and overlay; §7.2's full state table; the timing ladder; the in-app settings surface; and packaging or distribution of any kind.

The `kind` dispatch table for the heterogeneous card union **exists with one entry**. That is the seam being established, not the feature being built.

If you find yourself believing one of the excluded items is necessary to make the skeleton work, do not add it — **say so explicitly in the plan as a finding**, name what fails without it, and stop there. That is a real result and I want it. Silently widening the plan is not.

**Settled constraints the plan must honour. Do not re-litigate, do not re-derive, do not improve on any of these.**

- **Electron.** Main process is Node. `contextIsolation: true`. All filesystem and git access in the main process; the renderer talks over one IPC channel (§2, §3).
- **Read-only, structurally** (§2): "No write path to any watched repository anywhere in the codebase. Not a convention — an absence." The skeleton is the first code in this project, so it is where that absence is either established or lost.
- **Opaque window** (§2, closed by the user today, 16:31): `transparent: true` is not used; an opaque `backgroundColor` is set at construction. The backdrop is drawn inside the window.
- **Frameless with custom chrome** (§2, §10.1), `titleBarStyle: 'hidden'` rather than `frame: false`. **The skeleton constructs the window, so window-object options belong to it** — but the *drag regions* of §10.1 are interaction work and are not in this plan. Construct the window correctly; do not build the gesture.
- **Always-on-top is a toggle, off by default**, main-process state persisted in `config.json`.
- **Dark** (§7.3). No theme option.
- **No auto-discovery** (§2). Repositories come from explicit user configuration.
- **Design as though a stranger runs it** (§2). No hardcoded paths, no assumed repositories, no Synapse-specific requirement in the substrate. The skeleton must run for someone whose machine has never seen Synapse.
- **Windows-first.** Architect platform-neutral, test on Windows, do not block on Linux. Path normalisation is a correctness concern, not tidiness — NTFS is case-insensitive-preserving and ext4 is not.
- **§7.4 and the renderer decision:** the renderer diffs and mutates in place, never rebuilds. Position is a **style**, never a DOM position — nothing may move a node. Continuous motion is owned by CSS keyframes on their own clock; data changes *which* animation runs, never re-triggers a running one.
- **§11a:** the renderer is a pure function of card state → DOM and holds no state of its own.
- **No build step.** No bundler, no JSX, no TypeScript compile, no dev server. The file on disk is the file that runs. **This is load-bearing, not a preference** — it is what keeps §12.2 (packaging) genuinely open, and the renderer decision states it must be spent knowingly if ever spent. Zero new npm dependencies in the renderer.
- **The Watcher lives in its own package** with its own `package.json`, so the agent pipeline stays dependency-free and an adopter who wants only the agents installs nothing. **Do not create a root `package.json`.** There is none today and the only manifest anywhere in this repo is a test fixture's. Choose the directory and say why.

**The blocking unknown you must resolve first.** The renderer decision record flags this as blocking for you specifically: **whether `<script type="module">` loads from `file://` in the pinned Electron's renderer.** It is believed blocked by Chromium's CORS rules (origin `null`). Two answers are pre-approved: the custom scheme via `protocol.handle` that the media card already requires, or classic scripts. **Neither is a bundler.** The record states this is "the single most likely reason a bundler gets added by accident." Put the check early in the plan as its own task with a concrete command and an expected result, and make the two branches explicit so that whoever executes the plan does not have to invent one. Seven further unverified items are listed at the end of that record — read them and fold any that touch the skeleton into verification steps.

**Testing — the repo's real conventions, not generic ones.** This repository uses **`node:test` with `node:assert/strict`**, in colocated `*.test.mjs` files beside the module they test. See `scripts/deploy-agents.test.mjs`, `scripts/hot-files.test.mjs`, and `scripts/verify-install.test.mjs` for the established shape. Follow it. Do not introduce Jest, Vitest, Mocha, or any other test runner — that would add a dependency and contradict the no-build-step decision.

From §14, in scope for this plan: the **skeleton acceptance test**, and **`RepoSource` contract tests against fixture repositories in known states** — clean, dirty, ahead, mid-rebase, detached, not-a-repo, path-missing. Note that `toy-repos/` already exists in this repo as a fixture directory with an established pattern; look at how `scripts/verify-install.mjs` treats it before deciding whether to reuse or extend it.

The renderer decision adds one test the plan **must** ship: a **node-identity test** — render twice with changed data, assert the same node *objects* survive. The record's reasoning is that the whole decision "rests on a discipline that is otherwise invisible," which is the same standard §2's read-only guarantee is held to. Make it a real test, not a comment.

Also from §14, if it fits the skeleton without pulling excluded features in: the **invalidate-never-inform invariant** — a test that fails if any rendered value derives from a watch event payload. If it cannot be written without the excluded work, say so and assign it to the plan that can.

**How to write the plan — these are requirements, not style suggestions.**

- **Save it to `plans/2026-08-26-watcher-walking-skeleton.md`.** That is this repo's documented convention (`README.md` line 161, `CLAUDE.md`), and it overrides any default path your instructions carry. Match the shape of `plans/2026-08-24-pipeline-specialists.md` — it opens with the spec it serves, the goal, the scope, and an ordering rationale.
- **Contracts before implementations.** For each new module or boundary the plan introduces, the first task defines the interface — `RepoSnapshot`'s shape, `RepoSource`'s signature, the IPC channel's message shape, `config.json`'s schema — with fields and return types fully specified and no implementation. Then a boundary test that exercises it through its public surface only. Then implement. The seams are the point of a walking skeleton; inventing them bottom-up during TDD defeats it.
- **Bite-sized steps.** One action per step, two to five minutes each: write the failing test / run it and see it fail / implement minimally / run it and see it pass / commit. Use `- [ ]` checkboxes.
- **No placeholders.** "TBD", "add error handling", "write tests for the above", "similar to Task N", or a step describing what to do without showing how — each of those is a plan failure. Show the actual code and the actual command. Whoever executes this will have **no context from this conversation** and may read tasks out of order.
- **Exact file paths, exact commands, expected output.** Every verification step states what success looks like concretely enough to fail.
- **Frequent commits.** Note for the commit steps: this repo requires a `Session:` trailer in the same paragraph as any `Co-Authored-By:` line — a blank line between them makes git parse no trailers at all. `synapse-coder` signs `Session: manager`. Do not have the plan instruct `git add -A`, `git add .`, or `git commit -a`; stage explicit paths only. Both rules are in `CLAUDE.md`.
- **Self-review before you return.** Check the plan against §3 and against the renderer record's skeleton boundary: is every skeleton requirement covered by a task, and does any task deliver something on the excluded list? Check that names, types and signatures used in later tasks match what earlier tasks defined. Fix what you find inline.

**Deliverable.** The plan file, plus a summary telling me: the task count, the ordering rationale, anything in the design you found under-specified for the skeleton, anything you deliberately left out and why, and any assumption the plan rests on that you could not verify by reading. If something in this brief conflicts with something in the four documents, say so rather than resolving it silently — the conflict is more useful to me than a smooth plan.
