# Adopting the orchestrator boundary hook

**What this is.** A `PreToolUse` hook, deployed once to
`~/.claude/hooks/synapse-orchestrator-boundary.mjs` and registered once in
your **user-scope** `~/.claude/settings.json`. Once registered it runs in
front of every tool call in every Claude Code session on this machine, in
every repository — Synapse and every consumer repo, including ones that do
not exist yet.

**It only observes.** It never denies a call, never prints to stdout, and
always exits 0. Every path in `scripts/orchestrator-boundary.mjs` is wrapped
so that a throw, a malformed payload, or an unwritable log costs a measurement
rather than a tool call. See that file's header for why it measures instead
of enforcing, and `scripts/orchestrator-boundary.test.mjs` for the invariants
that are asserted directly rather than assumed.

**You probably do not need this** if you never run Manager, or a session
running as `--agent synapse-manager`, on this machine — the hook exists to
measure whether that seat drifts into doing its specialists' work itself, and
with nothing running in that seat there is nothing for it to observe. If you
do, the design behind it is `specs/2026-08-28-boundary-hook-machine-wide.md`.

---

## Install

1. Run `node scripts/deploy-agents.mjs` from a Synapse checkout. This deploys
   the hook script alongside the seven agent definitions, reusing the same
   ownership manifest and the same refuse-to-overwrite guard — it will not
   clobber a same-named file it did not put there, and it prints the fragment
   below when the hook is deployed or already in sync.

2. **Paste the printed fragment into `~/.claude/settings.json` yourself.**
   Synapse deliberately never writes that file — it is your whole machine
   configuration (model, theme, plugins, your own hooks), not something a
   deploy script should touch. **Append the object below as a new element of
   the existing `hooks.PreToolUse` array. Do not replace the array — you
   likely have other hooks registered in it already, and replacing it
   silently disables them.**

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

3. Run `node scripts/verify-install.mjs`. `Boundary hook deployed` should
   pass; `Boundary hook registered` will warn until you have pasted the
   fragment and started a new session; `Boundary hook recording` will warn
   until at least one tool call has run under the pasted hook.

**Until step 2 is done, nothing is logged anywhere** — not in Synapse, not
anywhere else. Deploying the file is not the same as registering it.

---

## What it actually captures — read this before you paste

Once registered, this hook **records every tool call in every repository on
this machine**, for the whole session, not just Synapse's. That includes
client work and private repositories you have no other reason to instrument.

- `detail` carries a **verbatim command body** for `Bash`/`PowerShell` calls,
  and a file path or search pattern for file tools — measured up to 7,219
  characters in practice.
- The log is **plain-text JSONL** at
  `~/.claude/synapse-orchestrator-boundary.jsonl` (or `$SYNAPSE_BOUNDARY_LOG`,
  see below).
- **Nothing truncates or rotates it.** That is a separate, deliberately
  out-of-scope decision — see
  `specs/2026-08-28-boundary-hook-machine-wide.md`, Decision 6 — not an
  oversight here. The file grows for as long as the hook runs.

This is disclosure, not a warning dressed up as documentation: the honest
alternative to filtering what gets logged is saying plainly what is captured,
so you can decide whether that is acceptable on this machine before you paste
the fragment.

---

## Turning it off

**Per session or per shell, without touching the registration:** set
`SYNAPSE_BOUNDARY_OFF` to any value other than unset, empty, `0`, `false`,
`no`, or `off` (case-insensitive, leading/trailing space trimmed). Any other
value — `1`, `true`, `yes`, anything else — disables the hook: it returns
immediately, before reading stdin, before touching the filesystem. It still
exits 0 and still prints nothing, so a disabled hook and a working one look
identical from the session's side; only the log tells you which you have.

**Permanently:** remove the `PreToolUse` entry you pasted from
`~/.claude/settings.json`. There is no config file and no allow/deny list by
design — see the record's Decision 5 — so this is the only permanent off
switch, and it is yours to make, not Synapse's.

---

## Relocating the log

Set `SYNAPSE_BOUNDARY_LOG` to an absolute path. The hook writes there instead
of `~/.claude/synapse-orchestrator-boundary.jsonl`.

---

## If no records appear

The hook exits 0 and prints nothing on every path, including failure paths —
that is deliberate, so a broken hook never costs you a tool call — which means
a silently broken install looks exactly like a working one that has not fired
yet. If `verify-install.mjs` keeps warning `Boundary hook recording` well
after you have made tool calls in a fresh session:

- Confirm `$HOME` actually expands in the pasted command. A hand-built
  `file://` URL or an unexpanded `$HOME` in your shell is the documented way
  this fails silently on Windows — see the header of
  `scripts/orchestrator-boundary.mjs`.
- Try replacing `$HOME` in the pasted command with an absolute path as a
  diagnostic step, then set `SYNAPSE_BOUNDARY_LOG` to an absolute path too, and
  check whether records start appearing there.
