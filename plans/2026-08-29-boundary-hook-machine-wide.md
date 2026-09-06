# Making the boundary hook cover every repository

**Implements:** `specs/2026-08-28-boundary-hook-machine-wide.md` (decided,
dispatchable). That record is the approach of record; where it settled
something, this plan follows it. Where it left a detail open, this plan decides
and says so under *Decisions this plan made*.

**Plan location.** Written to `plans/` rather than `docs/superpowers/plans/`
because this project already holds implementation plans there — three dated
files under the same `YYYY-MM-DD-slug` scheme, and `README.md`'s Layout block
names `plans/` as "Implementation plans (point-in-time; stale by design)". That
is an existing convention, pointed at rather than invented.
`docs/superpowers/decisions/` exists and holds Synapse's own decision records,
but this task's record was written into `specs/`, which is where the Layout
block sends design specs.

**Documentation read before planning.** No `docs/README.md` exists. Per
`docs/superpowers/decisions/2026-08-27-design-docs-reach-the-pipeline.md`, the
index for Synapse itself is `README.md`'s Layout block, which was read, along
with the decision record above, `.claude/settings.json`, `deploy-agents.mjs`,
`orchestrator-boundary.mjs`, and the `docs/OVERVIEW.md` passage describing the
hook.

**Reuse check.** Not applicable in the usual sense — this is not a net-new
capability. Every mechanism involved already exists in this repo and the work is
to extend it: the ownership-manifest guard in `deploy-agents.mjs`, the hook
script, and the `adoption/` document pattern. No package or external
implementation was searched for, because there is nothing here that an
off-the-shelf component would supply. The one thing worth naming as prior art is
internal: `~/.claude/hooks/` already holds eight of the user's own hooks
installed by ECC, which is the precedent the decision record leans on for
user-scope hook installation.

---

## FOOTPRINT

    scripts/orchestrator-boundary.mjs
    scripts/orchestrator-boundary.test.mjs
    scripts/deploy-agents.mjs
    scripts/deploy-agents.test.mjs
    scripts/verify-install.mjs
    scripts/verify-install.test.mjs
    .claude/settings.json
    adoption/boundary-hook.md
    docs/OVERVIEW.md
    docs/VERIFYING.md
    docs/BACKLOG.md
    README.md

**Do not touch** the concurrent session's files: `.gitignore`,
`BRAINSTORMHANDOFF.md`, `watcher/docs/DISPATCH-QUEUE.md`, `watcher/docs/README.md`,
or anything untracked under `watcher/docs/` and `specs/`. `DISPATCH-QUEUE.md`
line 19 describes this very task and would be a natural thing to tick off — do
not, it is checked out by another session.

**Do not modify** `specs/2026-08-28-boundary-hook-machine-wide.md`. A decision
record is a point-in-time artifact; implementing it does not amend it.

---

## Five constraints that must survive

These came down with the task and are not negotiable by this plan or by the
implementer.

1. **Never write to `~/.claude/settings.json`.** Not by the deploy script, not
   by a test, not by hand. The deploy prints a fragment; the user pastes it.
   Reading that file is permitted (step 14 does), writing it is not.
2. **Reuse the existing manifest guard** in `deploy-agents.mjs`. Do not add a
   second guard, do not weaken the existing one, do not add a code path that
   writes into a shared directory without consulting it.
3. **Remove the project-scope hook** in the same change, so the behaviour is not
   registered twice.
4. **Add `SYNAPSE_BOUNDARY_OFF`.**
5. **No log rotation.** Out of scope by explicit decision. Do not add it, do not
   add a size check, do not add a TODO for it.

---

## Decisions this plan made where the record left the detail open

**A. The hook source file stays at `scripts/orchestrator-boundary.mjs`.** It is
not moved to a new top-level `hooks/` directory and not renamed. The deployed
name is `synapse-orchestrator-boundary.mjs`, so source basename and target
basename differ, and the deploy carries an explicit source→target table. The
alternative — a `hooks/` source directory deployed by globbing `*.mjs`, mirroring
how `agents/` works — was rejected for one concrete reason: the test file
`orchestrator-boundary.test.mjs` also ends in `.mjs`, so a glob-based lister
would deploy a test file into the user's live hooks directory. An explicit table
makes it impossible to deploy something by accident, which is the right default
for a directory shared with the user's own hooks. Keeping the source path also
avoids disturbing `scripts/investigation-window.mjs`, which reads the same log.

**B. `SYNAPSE_BOUNDARY_OFF` treats a small set of values as "not off".** The
record says "no-op on any truthy value". Taken literally in JavaScript, the
string `"0"` is truthy, so `SYNAPSE_BOUNDARY_OFF=0` would *disable* the hook —
the opposite of what anyone typing it intends, and silently, since the hook is
designed never to complain. So: unset, empty, or one of `0`, `false`, `no`,
`off` (case-insensitive, trimmed) leaves the hook active; any other value
disables it. Four lines and one test table, and it removes a silent failure.

**C. The manifest goes to version 2 with a separate list per artifact kind.**
`manifestPath()` derives from the target's parent, so `~/.claude/agents` and
`~/.claude/hooks` both resolve to the same `~/.claude/.synapse-deployed.json`.
One flat `deployed` list would conflate the two, and the orphan logic — which
filters manifest names against the *agents* source listing — would report every
deployed hook as an orphan of the agents deploy. Keep `deployed` meaning agents,
add a `hooks` array. A v1 manifest on disk reads as `{deployed: [...], hooks: []}`.

**D. Deploying the hook is default-on**, part of a plain
`node scripts/deploy-agents.mjs` run. The script's name becomes slightly narrow;
it is deliberately not renamed, because the name appears throughout the docs and
in muscle memory, and renaming buys nothing. One comment in the header covers it.

---

## Risk to state plainly

**Between the deploy and the paste, logging stops entirely.** Step 13 removes
the project-scope hook, and until the user pastes the fragment into
`~/.claude/settings.json` there is no registration anywhere — Synapse included.
This is inherent to constraint 1 and is the correct trade, but it must not be
silent. Two things cover it: the deploy prints the fragment prominently (step
11), and `verify-install.mjs` reports whether the paste has happened (step 14).

**A related hazard the fragment itself must handle.** The user's
`~/.claude/settings.json` **already has a `PreToolUse` array** with their
`research-guard.sh` entry in it. If the printed fragment is a whole
`"hooks": { "PreToolUse": [...] }` block and the user pastes it as such, it
replaces their existing hooks and silently disables `research-guard`. **The
fragment must therefore be the single matcher object, with instructions to
append it as a new element of the existing `PreToolUse` array.** This applies
identically to the printed output and the adoption document.

---

## Steps

Tests come before the implementation they cover throughout. The suite is
`node:test` with `node:assert/strict`, flat `test('title', ...)` calls, no
`describe`/`it`, per-test `try/finally` cleanup. Match that style exactly.

### Phase 1 — the off switch

**1. Write the off-switch unit tests** in `scripts/orchestrator-boundary.test.mjs`.
Use the existing `scratch()` helper (`mkdtempSync(join(tmpdir(), 'orch-boundary-test-'))`),
the `mainSession(...)` payload builder, and `FIXED_CLOCK`. Add:

- `'the off switch suppresses the record entirely'` — call `runHook` with the
  switch set to `1` and a payload that would otherwise log a would-deny Edit;
  assert `existsSync(logPath) === false`.
- `'the off switch still exits 0 and still prints nothing'` — same call; assert
  `out.exitCode === 0` and `out.stdout === ''`. This is the invariant that must
  not regress: disabled is still silent and still non-blocking.
- `'values that mean "not off" leave the hook recording'` — a table over
  `undefined`, `''`, `'0'`, `'false'`, `'FALSE'`, `'no'`, `'off '` (note the
  trailing space, to pin trimming) asserting a record IS written for the first
  four-through-seven per decision B. Be explicit about which side each value
  falls on rather than looping blindly.
- `'any other value disables it'` — a table over `'1'`, `'true'`, `'yes'`,
  `'please'` asserting no record is written.

Pass the switch through an injectable option on `runHook` so these need no
child process — `runHook(text, { logPath, clock, env })`, defaulting to
`process.env`.

**2. Write the entry-point off-switch test.** Copy the shape of the existing
`'spawned as a real hook process, it writes a record'` test (it uses `spawn`
from `node:child_process` with `env: { ...process.env, SYNAPSE_BOUNDARY_LOG: logPath }`).
Add `'spawned with the off switch set, it writes nothing and still exits 0'`:
same spawn, with `SYNAPSE_BOUNDARY_OFF: '1'` added to `env`, asserting exit code
`0`, `stdout === ''`, and `existsSync(logPath) === false`. This covers the real
path a user's shell takes; the unit tests alone would not.

**3. Implement the switch** in `scripts/orchestrator-boundary.mjs`.

- Export `isBoundaryOff(env = process.env)` returning a boolean, implementing
  decision B: read `env.SYNAPSE_BOUNDARY_OFF`, trim, lowercase, return `false`
  for `undefined`/`''`/`0`/`false`/`no`/`off`, `true` otherwise.
- In `runHook`, accept `env = process.env` in the options object and return the
  existing `silent` value immediately if `isBoundaryOff(env)` — before parsing
  stdin, before `mkdirSync`, before any write.
- Leave the entry-point block reading `process.env` as it does today; it will
  pick up the switch through `runHook`'s default. Do not add a second check
  there.
- Add a short comment saying why the switch exists: a user-scope hook logs every
  repository on the machine, and `detail` carries verbatim command bodies.

**4. Run** `node --test scripts/orchestrator-boundary.test.mjs` and confirm the
new tests pass and all 21 existing ones still do.

### Phase 2 — deploy-agents grows a hooks artifact kind

**5. Write the manifest-migration and guard tests** in
`scripts/deploy-agents.test.mjs`, using the existing `scratch()` and
`writeAgent(dir, name, body)` helpers. `scratch()` currently returns
`{ root, sourceDir, targetDir, cleanup }`; extend it to also return a
`hooksTargetDir` at `join(root, 'home', '.claude', 'hooks')`, left uncreated so
creation is testable. Note that `manifestPath` resolves both targets to the same
manifest file, which is the point. Add:

- `'a v1 manifest still owns its agents after the hooks list is added'` — write
  a v1 manifest (`{version: 1, deployed: ['synapse-coder.md']}`) plus a matching
  deployed agent file, run a deploy, assert the agent is `writable` not
  `foreign`. **This is the migration test and it is the most important one in
  this phase:** if it fails, every existing install's next deploy refuses all
  seven agents and exits 3.
- `'a v1 manifest reads as owning no hooks'` — same setup, assert the hook is
  treated as not-yet-deployed rather than owned.
- `'refuses to overwrite a hook it did not deploy'` — write a foreign file at
  the hook's target name, assert it appears in the hook `foreign` list, is not
  written, and its bytes survive verbatim. Mirror the assertion style of the
  existing `'refuses to overwrite a file it did not deploy'` test.
- `'--force overwrites a foreign hook'` — the escape hatch must exist for hooks
  as it does for agents.
- `'a corrupt manifest is read as owning no hooks either'` — write
  `'{ this is not json'`, assert `corruptManifest === true` and the hook is
  refused, matching the existing agent-side test.
- `'a deployed hook is not reported as an orphaned agent'` — deploy both, then
  re-run; assert `orphans` is empty. This is the cross-contamination guard for
  decision C.
- `'--prune does not delete a deployed hook while pruning agents'` — rename an
  agent in the source, prune, assert the hook survives on disk and stays in the
  manifest.
- `'deploying twice is a no-op for hooks too'` — idempotency.
- `'the manifest round-trips both lists'` — deploy, read the manifest, assert
  `version === 2`, `deployed` holds only agent names, `hooks` holds only the
  hook name.

**6. Write the source→target mapping test** — `'the hook deploys under its
synapse- prefixed name'`: assert the file written into the hooks target is
named `synapse-orchestrator-boundary.mjs` and its bytes equal
`scripts/orchestrator-boundary.mjs`. The prefix is the namespace that keeps
Synapse out of the way of the user's own hooks; assert it rather than assume it.

**7. Implement the manifest change** in `scripts/deploy-agents.mjs`.

- `readManifest` returns `{ version, deployed, hooks, corrupt? }`. Parse
  `parsed.hooks` as an array or default to `[]`; keep the existing
  `Array.isArray` defensiveness for both. Preserve the existing corrupt
  behaviour exactly — corrupt means *owns nothing*, for both lists.
- `writeManifest(targetDir, agentNames, hookNames)` writes
  `{version: 2, deployed: [...sorted], hooks: [...sorted]}`.
- Keep the comment explaining why the manifest exists; extend it with one
  sentence on why hooks are a separate list.

**8. Implement hook deployment.** Add near the top:

```js
export const DEFAULT_HOOKS_TARGET = join(homedir(), '.claude', 'hooks')
export const HOOKS = [
  { source: 'orchestrator-boundary.mjs', target: 'synapse-orchestrator-boundary.mjs' },
]
```

with `DEFAULT_HOOKS_SOURCE = SCRIPT_DIR` (the hook source lives in `scripts/`).
Factor the ownership decision out of `deploy()` so both kinds use one
implementation — a helper taking a list of `{sourcePath, targetName}` pairs, the
owned-name set, and the target dir, returning `{changed, same, foreign, writable}`.
Do not duplicate the foreign/writable logic; the whole point of the guard is
that there is one of it.

`deploy()` gains `hooksTargetDir` and `hooksSourceDir` options and returns
hook-side results under distinct keys (`hookChanged`, `hookSame`, `hookForeign`,
`hookWritable`, `hooksTargetDir`, `hooksTargetExisted`). Create the hooks target
with `mkdirSync(..., {recursive: true})` when absent and not in check mode,
exactly as the agents target is created.

Hook orphans: compute them against `HOOKS` target names, and keep them separate
from agent orphans so `--prune` cannot cross the streams.

**9. Extend `parseArgs`** with `--hooks-target <dir>` (needed by the tests, and
symmetric with `--target`), and update `USAGE` to describe hook deployment,
`--hooks-target`, and the fact that a plain run now deploys both. Keep the
existing `-Check` alias working. Add the `parseArgs` tests alongside the
existing three.

**10. Extend `report()` and `reportHazards()`** to cover hooks: a `Deployed to
<hooksTarget>` line, `updated:` lines, a hook-specific REFUSED block naming the
files, and hook orphan reporting. Ensure `result.hookForeign.length` also
triggers `process.exit(3)` in `main()` — a refusal that exits 0 is the silent
failure the existing code comments call out by name.

**11. Print the settings fragment** at the end of a successful non-check deploy
that wrote the hook. It must:

- print the single matcher object, not a whole `hooks` block,
- say explicitly: **append this as a new element of the existing
  `hooks.PreToolUse` array in `~/.claude/settings.json`; do not replace the
  array, you have other hooks in it**,
- say that Synapse deliberately does not write that file,
- state that until it is pasted, nothing is logged anywhere.

The fragment:

```json
{
  "matcher": "*",
  "hooks": [
    {
      "type": "command",
      "command": "node \"$HOME/.claude/hooks/synapse-orchestrator-boundary.mjs\"",
      "timeout": 10
    }
  ]
}
```

Print it only when the hook was actually deployed or is already in sync — not
when it was refused as foreign.

**12. Run** `node --test scripts/deploy-agents.test.mjs`. All 22 existing tests
must still pass unchanged; if any needed editing, that is a signal the change
altered agent-side behaviour and should be re-examined rather than accommodated.

### Phase 3 — remove the project-scope hook

**13. Rewrite `.claude/settings.json`.**

- Delete the entire `hooks` key. The file keeps only `$comment`.
- Rewrite `$comment` so it no longer claims the scope limit exists. It should
  say: the boundary hook is now installed machine-wide from
  `~/.claude/hooks/synapse-orchestrator-boundary.mjs`; it was removed from here
  because project and user settings both contribute `PreToolUse` hooks and
  leaving both registered logs every call twice; see
  `specs/2026-08-28-boundary-hook-machine-wide.md` and `adoption/boundary-hook.md`;
  set `SYNAPSE_BOUNDARY_OFF` to disable. Keep the existing pointers to the
  script header and its test file — they are still true.
- Do not leave the old SCOPE LIMIT paragraph in any form. A reader finding it
  will believe the gap still exists, which is precisely the failure the decision
  record names.

Add a test to `scripts/deploy-agents.test.mjs` — or, if it reads more naturally
there, `scripts/verify-install.test.mjs` — named
`'the project settings register no PreToolUse hook'`, which parses
`.claude/settings.json` and asserts it declares no `hooks.PreToolUse`. That is
the cheap mechanical guard against the duplicate coming back, and it is the
testable half of the record's "duplicate-record test"; Claude Code's own hook
merging cannot be unit-tested from here. Write this test before making the edit.

### Phase 4 — verify-install reports the hook

**14. Write the check tests first** in `scripts/verify-install.test.mjs`,
following its existing style of asserting `pass`/`fail` status on specific named
entries. Then implement `checkHookDeployment(hooksSourceDir, hooksTargetDir,
settingsPath)` in `scripts/verify-install.mjs`, returning three entries:

- `Boundary hook deployed` — fail if the target file is absent, naming
  `node scripts/deploy-agents.mjs` as the fix; fail if present but drifted from
  source bytes, same fix. Reuse the byte-comparison approach `checkDeployment`
  already uses via `classify` rather than inventing a second comparison.
- `Boundary hook registered` — **read** `~/.claude/settings.json`, parse it, and
  look for a `PreToolUse` entry whose command mentions
  `synapse-orchestrator-boundary`. `warn` (not `fail`) when absent, with the
  remedy being to paste the fragment. A warn is right: the paste is a deliberate
  human step, and a machine that has just deployed has legitimately not done it
  yet. Treat unreadable or absent settings as a `warn` too, never an exception.
- `Boundary hook recording` — `warn` if the log file does not exist. This is the
  only check that would catch the `$HOME` expansion failing on Windows, which
  would otherwise be perfectly silent.

**This function reads `~/.claude/settings.json` and must never write it.** Say
so in a comment on the function.

Register it in `runAllChecks` as a new section, `['Boundary hook',
checkHookDeployment()]`, placed after `Deployment`.

**15. Run** `node --test scripts/verify-install.test.mjs` and then
`node scripts/verify-install.mjs`, and record the new total check count — it
moves from 18 to 21. That number is prose in four places and nothing computes
it; step 17 fixes them.

### Phase 5 — documentation

**16. Write `adoption/boundary-hook.md`.** Per the decision record this is
*not* the paste-into-every-repo shape that `adoption/session-attribution.md`
uses — consumer repos need no per-repo change. Match that file's tone and its
framing conventions (H1 as a gerund phrase, bold-lead paragraphs, a "you
probably do not need this" caveat, a pointer to the spec) but the payload is a
one-time user-scope install, not a prompt to hand an agent. It must contain:

- what the hook does and that it only observes — never denies, never prints,
  always exits 0,
- the install: run `node scripts/deploy-agents.mjs`, then paste the fragment,
  **with the append-don't-replace warning from the risk section above stated in
  bold**,
- the fragment verbatim, identical to what step 11 prints,
- **honest disclosure, which is the part that is not decoration.** State plainly
  that once installed it records every tool call in *every* repository on the
  machine — including client work and private repositories — that `detail`
  contains verbatim command bodies measured up to 7,219 characters, that the log
  is plain-text JSONL at `~/.claude/synapse-orchestrator-boundary.jsonl`, and
  that nothing truncates or rotates it. Do not soften this; the record is
  explicit that disclosure is the honest alternative to a filter.
- how to turn it off: `SYNAPSE_BOUNDARY_OFF`, including which values count as
  off per decision B, and that removing the settings entry is the permanent
  version,
- how to relocate the log with `SYNAPSE_BOUNDARY_LOG`,
- what to do if no records appear: check that `$HOME` expanded, and try an
  absolute path.

**17. Update the four stale prose counts and descriptions.**

- `README.md:108` — "passed all 18 checks" → 21.
- `README.md:135` — "Eighteen checks" → "Twenty-one checks", and extend the
  one-line summary to mention the boundary hook.
- `README.md:165` — the Layout line `.claude/settings.json  Project hook
  wiring. Observes only; never denies a call.` is now wrong; the file holds only
  a comment. Rewrite it, and add a line for `adoption/boundary-hook.md` if the
  Layout block's `adoption/` entry does not already cover it adequately.
- `docs/VERIFYING.md:53` — "Eighteen checks across four areas" → twenty-one
  across six. **Note this line is already stale:** the script has five sections
  today, not four, and `VERIFYING.md`'s bullet list omits `Fixture suite`. Fix
  both while there, and add the boundary-hook section to the bullet list.

**18. Update `docs/OVERVIEW.md:172-186`.** The sentence *"Wired in
`.claude/settings.json`, so it covers Synapse-rooted sessions only; a consumer
repo would need its own"* becomes false. Replace it with the machine-wide
install, the deploy path, a pointer to `adoption/boundary-hook.md`, and a
mention of `SYNAPSE_BOUNDARY_OFF`. Also add the hook to whatever the "The tools"
section says about `deploy-agents.mjs`, since it now deploys two artifact kinds.

**19. Update `docs/BACKLOG.md:80`.** The entry describes the boundary log as
having a live data source nothing reads and is framed around the pre-machine-wide
state. Add a short note that the machine-wide hook has landed and which document
records it. Do not delete the entry — the reading half (Watcher task 9) is still
outstanding, and the record explicitly flags that task 9's bounded-tail read is
now load-bearing because instrumenting every repository multiplies the growth
rate. Say that in the note. **Do not add rotation** — constraint 5.

### Phase 6 — verification

**20. Run the full suite:** `node --test scripts/*.test.mjs`. Everything green.

**21. Run `node scripts/deploy-agents.mjs --check`** and confirm it reports the
hook as pending without writing anything, including not creating the hooks
target directory.

**22. Run `node scripts/deploy-agents.mjs`** for real. Confirm: the hook lands
at `~/.claude/hooks/synapse-orchestrator-boundary.mjs`; the manifest is version
2 with both lists; the seven agents are unaffected; the eight pre-existing hooks
(`research-guard`, `research-output-guard`, `session-env`, `studio-agent-check`,
in `.sh`/`.js` pairs) are untouched — none collides with the `synapse-` name, so
the guard should not fire, and if it does, stop and report rather than reaching
for `--force`.

**23. Run `node scripts/verify-install.mjs`.** Expect `Boundary hook deployed`
to pass and `Boundary hook registered` to warn, because the user has not pasted
yet. That warn is the correct end state for this task.

**24. Commit.** Conventional commit, and sign it `Session: brainstorm` as the
last line of the body — that is this dispatch's value. Do not use `git add -A`
or `git commit -a`; stage only the twelve files in the footprint. The working
tree contains another session's uncommitted work; leave it alone.

**25. Report to the user, in the summary, that a manual paste is required**,
with the fragment and the append-don't-replace warning. This is the one step no
script performs, and the task is not finished until the user knows it is waiting
on them.

---

## What is deliberately not here

- **Log rotation.** Constraint 5, and the record's Decision 6 says the reader is
  the wrong owner. Not a TODO, not a size warning, not a comment suggesting it.
- **An allow-list or deny-list of repositories.** Decision 5 rejects it as
  speculative generality; one switch plus disclosure covers the case that exists.
- **A `.sh` wrapper** matching the neighbouring hooks. Rejected in the record —
  it adds a bash dependency on Windows to launch a Node script `node` already
  runs directly.
- **Any edit to `~/.claude/settings.json`.** Constraint 1.
- **Renaming `deploy-agents.mjs`** despite it now deploying a non-agent.
- **Deduplicating the `DEFAULT_LOG` constant**, which is declared independently
  in both `orchestrator-boundary.mjs:57` and `investigation-window.mjs:45`. It
  is a real duplication and a real drift risk, but the log path is not changing
  in this task and folding it in would widen the footprint for no benefit here.
  Worth its own small task.
