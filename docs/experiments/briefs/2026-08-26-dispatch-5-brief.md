# Dispatch 5 brief — `synapse-coder` — 2026-08-26 17:27

Reproduced verbatim from the experiment log
(`docs/experiments/2026-08-26-session-as-orchestrator.md`). Split out to keep
that log readable. Nothing here is edited or summarised.

---

**Task.** Implement the approved plan at `plans/2026-08-26-watcher-walking-skeleton.md`. **Read the plan from that path before starting anything.** It is 18 tasks and 90 steps; work them in order.

The plan is the Walking Skeleton for the Synapse Watcher — a read-only Electron desktop window that observes git repositories listed in a config file. Everything you need is in the plan file, including a pre-flight section, a declared footprint of every file it creates or modifies, and its own findings and known limitations.

**Four things from the plan I am repeating because they are the ones most expensive to get wrong.**

1. **The plan's pre-flight comes first.** Run it. If the existing test suite is not green before you start, stop and say so — something unrelated is broken and this work will be blamed for it.

2. **Task 2 resolves a blocking unknown before any `import` statement is written** — whether ES modules load from `file://` in Electron's renderer. The plan writes out both pre-approved branches concretely. Take whichever branch the check actually produces and say which one you took. **Neither branch is a bundler.** If you find yourself reaching for a bundler, a build step, JSX, or a TypeScript compile, stop and report it instead — the absence of a build step is a settled decision, not an oversight, and it is what keeps this project's packaging question open.

3. **This machine corrupts backslashes written through the Bash tool.** The plan's pre-flight covers it: author file contents with the `Write` tool, never through a heredoc, `printf`, or `sed`. Several planned files contain `\r`, `\n` and `\\` inside regular expressions. Bash remains correct for running commands.

4. **Test steps come before the implementation steps they cover, as written.** Do not batch tests at the end. The plan orders them deliberately.

**Commits.** Stage explicit paths only — never `git add -A`, `git add .`, or `git commit -a`. Sign every commit `Session: manager`; if you add a `Co-Authored-By:` line it must sit in the same paragraph, with no blank line between them, or git parses no trailers at all.

**If the plan is wrong, say so rather than working around it.** A step that contradicts another, a step too underspecified to implement, or a step that cannot be carried out as written is a real result and I want it reported, not silently repaired. Implement what the plan says; where you genuinely cannot, stop at that task and tell me which one and why.

**Return** a short summary of what you changed and why, with the exact file paths you touched. Do not paste file contents.
