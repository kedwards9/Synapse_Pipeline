# Dispatch 8 brief — `synapse-coder` (fresh, revised plan) — 2026-08-26 18:44

Reproduced verbatim from the experiment log
(`docs/experiments/2026-08-26-session-as-orchestrator.md`). Split out to keep
that log readable. Nothing here is edited or summarised.

---

**Task.** Implement the approved plan at `plans/2026-08-26-watcher-walking-skeleton.md`. **Read the plan from that path before starting anything.** You are a **fresh** coder — you did not work on this before and you have no context from the earlier attempt. Work the tasks in order.

The plan is the Walking Skeleton for the Synapse Watcher — a read-only Electron desktop window that observes git repositories listed in a config file. Everything you need is in the plan: a revision note at the top, a pre-flight, a declared footprint of every file it creates or modifies, its findings, and its known limitations.

**This is revision 2 of the plan, and part of it has already been executed.** Read the state below before you run anything, because the plan is not being applied to an empty directory.

- **Task 1 is done and committed** at `5674d65` — `watcher/package.json`, `watcher/package-lock.json`, `watcher/README.md`, `watcher/config.example.json`. **The revised plan's Part C corrects two of those committed files**; that is an edit to existing code, not a fresh write.
- **`watcher/node_modules/` exists** and `electron@44.0.0` is installed. `npx electron --version` works.
- **Three files from the previous attempt are on disk and uncommitted**: `watcher/src/main/main.mjs`, `watcher/src/renderer/index.html`, `watcher/src/renderer/renderer.mjs`. They are byte-for-byte the *previous* revision's Task 2 text, which has since been rejected and rewritten. **Treat them as stale, not as progress.** Reconcile them to whatever the revised plan actually specifies — that may mean rewriting, moving, or deleting them.
- Tasks 3–18 have not been started. Nothing else exists under `watcher/src/`.

**Why the plan was revised, so you know what the sharp edge is.** A reviewer returned `REJECTED(plan)` on revision 1. Its Task 2 fused two independent unknowns into one probe — whether Electron 44 evaluates an ESM main entry containing a top-level `await app.whenReady()`, and whether `<script type="module">` loads over `file://` — so failure of the first made the second unobservable. It failed, and **it failed silently**: `npx electron .` hung indefinitely with zero bytes of output, reproduced four times across two agents including once outside the tool sandbox with Chromium logging enabled. The revised Task 2 splits that into Probe A then Probe B, with stated time budgets and printed verdicts precisely so a hang is *output* rather than a stall. Respect those budgets. If something hangs past its budget, that is the branch the plan wrote for you, not a reason to wait longer.

**Four things from the plan I am repeating because they are the ones most expensive to get wrong.**

1. **The plan's pre-flight comes first.** Run it. If the existing test suite is not green before you start, stop and say so — something unrelated is broken and this work will be blamed for it.

2. **No build step.** No bundler, no JSX, no TypeScript compile, no dev server, zero new renderer dependencies. This is a settled architectural decision, not an oversight, and it is what keeps this project's packaging question open. If you find yourself reaching for any of them, **stop and report it** rather than reaching.

3. **This machine corrupts backslashes written through the Bash tool.** Author file contents with the `Write` tool, never through a heredoc, `printf`, or `sed`. Several planned files contain `\r`, `\n` and `\\` inside regular expressions. Bash remains correct for running commands.

4. **Test steps come before the implementation steps they cover, as written.** Do not batch tests at the end.

**Commits.** Stage explicit paths only — never `git add -A`, `git add .`, or `git commit -a`. Sign every commit `Session: manager`; if you add a `Co-Authored-By:` line it must sit in the same paragraph, with no blank line between them, or git parses no trailers at all. **Note that the working tree contains files that are not yours**: `GUIquick.md` at the repo root, untracked, which is the user's and must be left alone. If you find anything else you did not create, leave it and say so.

**If the plan is wrong, say so rather than working around it.** A step that contradicts another, a step too underspecified to implement, or a step that cannot be carried out as written is a real result and I want it reported, not silently repaired. The last coder stopped for exactly this reason and was right to; the reviewer's words were *"the coder stopping was the plan's instruction correctly followed, not a defect."*

**Report accurately, including what you changed that the plan did not anticipate.** Your summary is what the next agent routes on, and it is not checked against the artefact by default. If you touch a file the declared footprint does not list, or skip one it does, say so explicitly.

**Return** a short summary of what you changed and why, with the exact file paths you touched. Do not paste file contents.
