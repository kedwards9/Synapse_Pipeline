# Dispatch 7 brief — `synapse-planner` (fresh, revision) — 2026-08-26 18:09

Reproduced verbatim from the experiment log
(`docs/experiments/2026-08-26-session-as-orchestrator.md`). Split out to keep
that log readable. Nothing here is edited or summarised.

---

**Task.** Revise an existing implementation plan that a reviewer has rejected. You are a **fresh** planner — you did not write this plan and you have no context from the session that did. That is deliberate: a planner that produced a flawed plan is not well placed to spot the flaw. Do not write code.

**The plan:** `plans/2026-08-26-watcher-walking-skeleton.md`. Read it. It is 18 tasks for the Walking Skeleton of the Synapse Watcher — a read-only Electron desktop window that observes git repositories listed in a config file. Tasks 1 and 2 have been attempted; Tasks 3–18 have not.

**Read these for the design the plan serves. None of them are yours to revise.**

1. `docs/superpowers/specs/2026-08-26-synapse-watcher-design.md` — the design spec. §2, §3, §7.4, §11, §11a, §13, §14 bind you.
2. `specs/2026-08-26-watcher-renderer-structure.md` — the renderer decision. **Its no-build-step conclusion is settled and is load-bearing**: no bundler, no JSX, no TypeScript compile, no dev server, zero new renderer dependencies. It is what keeps this project's packaging question open, and it is not on the table.
3. `specs/2026-08-26-watcher-data-arrival.md` and `specs/2026-08-26-watcher-media-card.md` — context for the seams; neither is in this plan.

`CONTEXT.md` at the repo root holds the canonical vocabulary.

**The reviewer's verdict, verbatim and complete. This is the reason for the revision.**

> REJECTED(plan): Task 2 cannot answer its own question in this environment, and the fix is a plan fix, not a code fix. The probe at Step 3 conflates two independent unknowns — whether Electron 44 evaluates an ESM main entry containing a top-level `await app.whenReady()`, and whether `<script type="module">` loads over `file://` — so failure of the first makes the second unobservable. I reproduced the failure myself: `npx electron .` hangs indefinitely with zero output (exit 124 under `timeout`, twice, once unsandboxed with `ELECTRON_ENABLE_LOGGING=1`), never reaching renderer load, which is neither Branch A nor Branch B, and Step 4 routes that to "stop". The coder stopping was the plan's instruction correctly followed, not a defect, and it correctly refused to pick a main-process module form on its own since Task 15/16 and the already-committed `"type": "module"` depend on that choice. Respecify Task 2 as two sequential probes: first a main-entry probe that establishes which module form (`.then()`, top-level `await`, or CJS) actually reaches `app.whenReady()` resolution under Electron 44, stating the chosen form as a plan decision; then the existing `file://` module-loading probe layered on top of whichever form survived. Also correct Step 3's "fails here and loudly" — the observed failure mode is a silent hang, so the revised Task 2 needs a stated timeout and a "no output within N seconds" branch rather than an open-ended run.

**The reviewer's findings that bear on the revision, verbatim:**

> - `<synapse>\plans\2026-08-26-watcher-walking-skeleton.md:284` — "if Electron 44 will not run an ESM main process, this fails here and loudly" is false on this machine. I reproduced the failure independently: it deadlocks silently and forever, with Chromium logging on and outside the tool sandbox. **Blocks.**
> - `<synapse>\plans\2026-08-26-watcher-walking-skeleton.md:252-292` — Task 2 fuses two independent unknowns into one probe: (a) can Electron 44 evaluate an ESM main entry that top-level-`await`s `app.whenReady()`, and (b) does `<script type="module">` load over `file://`. (a) failing makes (b) unanswerable, and Step 4's A/B/"stop" trichotomy has no cell for it. **Blocks** — this is the reason for the verdict.
> - `<synapse>\watcher\package.json:5,7` (committed at `5674d65`) — Task 1 commits `"type": "module"` plus `"main": "src/main/main.mjs"`, i.e. it *pre-commits* to an ESM main process, before Task 2 tests whether one runs. That contradicts the plan's own ordering rationale ("the blocking unknown first"). Whichever way Task 2 is respecified, check whether this line stays.
> - `<synapse>\watcher\README.md:11` — says "Node >= 20", but the pinned `electron@44.0.0` declares `engines: node >= 22.12.0` (`package-lock.json`, electron entry). Plan-authored (Task 1 Step 5), faithfully transcribed; a Node 20 user gets `EBADENGINE` and a non-working install. Non-blocking, fix when Task 2 is revised.
> - I could **not** independently verify the coder's isolation claim that the `.then()` form works and only the top-level-`await` form hangs — confirming that needs a throwaway entry file, and I am not permitted to create one. I verified only the hang itself, which is the load-bearing half. Treat the `.then()` result as the coder's report, not as reviewed fact.
> - `<synapse>\watcher\src\main\main.mjs:8` — `on('console-message', (_e, _lvl, message))` uses positional args that `node_modules/electron/electron.d.ts:16207-16231` marks `@deprecated` in favour of a single `details` object. Still functional in 44, so Branch B would have printed a real message — not the cause of anything here. Flagging because this handler is carried into Task 16's real `main.mjs`.
> - security — when Task 15 introduces `webPreferences`, `contextIsolation`, `nodeIntegration` and `sandbox` must be restated explicitly rather than relied on — an options object that omits them reads identical to one that disables them.

**What the coder observed, marked as its report rather than as reviewed fact** — the reviewer was explicit that it could not confirm this half:

> - Identical window-creation + `loadFile` logic in a **CommonJS** `main.js` (`app.whenReady().then(...)`) works instantly — window created, local HTML loaded, resolves.
> - The **same logic rewritten in ESM but using `.then()` instead of top-level `await`** also works instantly.
> - Only the **top-level `await app.whenReady()`** form — exactly what Task 2 Step 3 specifies — hangs, every time.

Note the standing of that claim carefully. **One agent reports it; no agent has verified it.** If your revised plan depends on which module form works, the plan must establish that itself rather than inherit it — that is precisely what the reviewer asked for in its first sentence of prescription.

**State on disk right now.**

- `5674d65` is committed and holds Task 1's four files: `watcher/package.json`, `watcher/package-lock.json`, `watcher/README.md`, `watcher/config.example.json`. **Task 1 is done and its output is real.** Two of those files carry defects the reviewer found.
- Task 2's three files are on disk and **uncommitted**: `watcher/src/main/main.mjs`, `watcher/src/renderer/index.html`, `watcher/src/renderer/renderer.mjs`. They are byte-for-byte the plan's Task 2 Steps 1–3 text.
- `watcher/node_modules/` exists; `electron@44.0.0` is installed and `npx electron --version` works.
- Tasks 3–18 have not been started. Nothing under `watcher/src/` other than the three files above exists.

**Scope of the revision — read this twice.**

Revise **Task 2, plus whatever Tasks 1 and 3–18 must change because of it, and nothing else.** This is a revision, not a re-plan. Tasks 3–18 were not rejected; they were never reached. Rewriting them because you would have written them differently discards work the reviewer did not fault and is not what you are here for.

Specifically in scope:

1. **Task 2, respecified as two sequential probes**, per the reviewer's prescription: first establish which main-process module form actually reaches `app.whenReady()` resolution under Electron 44, stating the chosen form as a plan decision with its reasoning; then layer the `file://` module-loading probe on whichever form survived. Both probes need a **stated timeout and an explicit "no output within N seconds" branch** — the observed failure is a silent hang, not a loud error, and an open-ended run is what produced a 45-second stall with nothing to show for it.
2. **Task 1's committed `watcher/package.json`.** `"type": "module"` and `"main": "src/main/main.mjs"` are already committed and pre-decide the thing Task 2 is meant to establish. Decide whether they stay, and if a change is needed, add the task step that makes it — the file is committed, so this is an edit to existing code, not a fresh write.
3. **Task 1's committed `watcher/README.md:11`** — Node >= 20 versus `electron@44.0.0`'s `engines: node >= 22.12.0`.
4. **Any of Tasks 3–18 whose text depends on the module form** — the reviewer names Tasks 15 and 16 specifically. Check them; change only what the decision actually forces.
5. **The deprecated `console-message` signature**, if the handler survives into Task 16.
6. **The `webPreferences` note** — when Task 15 introduces it, `contextIsolation`, `nodeIntegration` and `sandbox` are to be restated explicitly rather than inherited, because an options object that omits them is indistinguishable from one that disables them.

**Out of scope.** The design spec and all three decision records. The no-build-step decision. The skeleton's boundary — one `<template>`, one `create`/`update` pair, the keyed id→node map, the compare-before-write setters, the node-identity test; no tiers, fit solver, drag, flip or overlay. Packaging and distribution. Any task the reviewer did not fault and the module-form decision does not touch.

**If you conclude the reviewer is wrong**, say so plainly with your reasoning rather than complying silently or working around it. That is a real result and I want it. Equally, if the revision forces a change the reviewer did not anticipate, name it.

**How to write it.**

- **Write the revised plan to the same path, `plans/2026-08-26-watcher-walking-skeleton.md`.** The previous version is committed at `14b48d9`, so git holds the history and nothing is lost by replacing it. **You have `Write` but not `Edit`**, so this means re-emitting the whole file. Budget for that: it was 1,295 lines and 83,578 bytes, and it must come back complete, not summarised. Do not shorten tasks you are not revising in order to fit — if that pressure arises, say so rather than silently compressing.
- Add a short dated note near the top recording that this is a revision, what was rejected, and what changed. A future reader must be able to tell which version they are holding.
- Everything the original plan does well, keep: contracts before implementations, bite-sized one-action steps, **no placeholders** (no "TBD", no "add error handling", no "similar to Task N" — show the actual code and the actual command), exact file paths, exact commands with expected output, test steps ordered before the implementation steps they cover, and the declared footprint.
- Keep the repo conventions the original carried: `node:test` with `node:assert/strict` in colocated `*.test.mjs` files; no other test runner; explicit staging in commit steps, never `git add -A`, `git add .` or `git commit -a`; `Session: manager` on commits, in the same paragraph as any `Co-Authored-By:` line; and the pre-flight instruction to author file contents with the `Write` tool rather than heredocs, because this machine's Bash tool collapses backslash pairs.
- **Self-review before returning.** Does the revised Task 2 answer one question at a time? Does every task the module-form decision touches actually agree with it? Do names, types and signatures still match across tasks you did and did not revise?

**Deliverable.** The revised plan at that path, plus a summary telling me: what you changed and why, what you deliberately left alone, whether you agreed with the reviewer's diagnosis, and any assumption the revision rests on that you could not verify by reading.
