# Making the boundary hook reach every repository

**Status:** decided, dispatchable. A brainstorm decision record, not a pipeline
artifact.

**It is not the paste-in snippet the backlog asked for.** That framing was
checked and does not survive; §1 says why. The work is smaller and covers more.

---

## Context

`.claude/settings.json` registers `scripts/orchestrator-boundary.mjs` as a
`PreToolUse` hook and names its own limitation:

> *"SCOPE LIMIT, and it is the real one: hooks are per-directory. This file
> governs sessions rooted in Synapse only. Manager is deployed machine-globally
> and mostly runs in consumer repos, where this hook does not exist. Covering
> those needs a paste-in snippet in `adoption/`, the same shape as
> `adoption/session-attribution.md`. **Not built yet.**"*

That gap is real and it bites twice. Manager runs mostly in consumer repos, so
**the log records the least interesting sessions and misses the most
interesting ones.** And the hook-log adapter — dispatch task 9 — lights up
exactly one card on a board of many, because only one repository is
instrumented.

### What was checked, and what it overturned

**The scope-limit comment is right that *project* settings are per-directory.
It is wrong that this needs a per-repo snippet**, and the disproof was sitting
in the user's own configuration the whole time.

`~/.claude/settings.json` — user scope, not project scope — **already runs
`PreToolUse` hooks**:

```json
"PreToolUse": [
  { "matcher": "Bash|WebSearch|WebFetch",
    "hooks": [{ "type": "command",
                "command": "\"$HOME/.claude/hooks/research-guard.sh\"" }] }
]
```

That hook runs in every project on this machine. `~/.claude/hooks/` already
holds eight files — `research-guard`, `research-output-guard`, `session-env`,
`studio-agent-check` — none of them Synapse's.

**So the established pattern is user-scope settings plus a script in
`~/.claude/hooks/`**, which is the same shape as `~/.claude/agents/` and
`deploy-agents.mjs`. One install covers every repository, **including the ones
that do not exist yet** — which a paste-in snippet structurally cannot do, since
it must be pasted per repo, forever.

**The script is already portable enough to move.** Verified by reading it: its
only imports are `node:fs`, `node:path`, `node:os` and `node:url`; it reads
stdin, writes to `~/.claude/synapse-orchestrator-boundary.jsonl` or
`$SYNAPSE_BOUNDARY_LOG`, and exits 0 on every path. **It never reads the
repository it observes.** Nothing about it depends on living in Synapse.

**This is the third framing this week that did not survive being checked** —
after the dial's five states and the boundary log's missing completion events.
The pattern is worth naming: *a document describing a mechanism is not evidence
about the mechanism.*

---

## Decision

### 1. One user-scope hook, not a per-repo snippet

Register the hook once in `~/.claude/settings.json` with matcher `*`, pointing
at a deployed copy of the script. Every repository is covered, retroactively and
in advance.

**The `adoption/` document still gets written** — but it is a different
document. Not "paste this into every repo you own"; instead *"here is the one
entry, here is what it captures, here is how to turn it off."* Consumer repos
need no per-repo change at all.

### 2. The script deploys to `~/.claude/hooks/synapse-orchestrator-boundary.mjs`

**Prefixed `synapse-`, for exactly the reason the agents were renamed on
2026-08-26.** That directory is shared with the user's own hooks. An
unprefixed `orchestrator-boundary.mjs` is a name anyone could pick, and deploy
overwriting a same-named file without saying so is the failure that produced the
prefix convention in the first place.

**Deploy it through the mechanism that already has the guard.**
`deploy-agents.mjs` keeps a manifest of what it put there, refuses by default to
overwrite a file it did not deploy, and treats a corrupt manifest as *"we own
nothing"* rather than as permission. That guard is precisely what writing into a
shared `~/.claude/hooks/` requires. Extend it, or add a sibling that reuses it —
**do not write a second, guardless installer.**

**Invoke it as `node "$HOME/.claude/hooks/synapse-orchestrator-boundary.mjs"`.**
The neighbouring hooks use a `.sh` wrapper calling a `.js`; do not copy that.
The project hook already invokes this script directly with `node` and that works
on both target platforms, whereas a `.sh` wrapper adds a bash dependency on
Windows for no gain.

### 3. Synapse deploys the script and does NOT edit the user's `settings.json`

`~/.claude/settings.json` holds `env`, `model`, `statusLine`, `enabledPlugins`,
`extraKnownMarketplaces`, `theme`, `voice`, `effortLevel` and the user's own
three hooks. **It is their whole machine configuration and Synapse does not own
it.**

This is the same boundary `adoption/session-attribution.md` already draws —
*"Synapse publishes the pattern; the consumer repo adopts it. Synapse does not
write another project's `CLAUDE.md`."* A global settings file deserves at least
that much deference.

So: the deploy step **prints the JSON fragment** and the adoption document
carries it. The user pastes it once. An installer that silently merges JSON into
that file is rejected below.

### 4. Remove the project-scope hook in the same change

**Otherwise Synapse logs everything twice.** Project and user settings both
contribute hooks; a `PreToolUse` matcher in each means two invocations per tool
call inside Synapse, and two records per call in the log.

That failure is silent — the log still works, the file simply grows twice as
fast and every recency count in the hook-log adapter double-counts. **A
duplicate-record test is the cheap guard**, and it belongs in this task rather
than being discovered later from a card that says a repository is twice as busy
as it is.

Keep `.claude/settings.json`'s `$comment` block, rewritten: the scope limit it
describes is the thing this record removes, and a reader finding the old text
will believe the gap still exists.

### 5. Machine-wide logging needs an off switch, and it did not before

**This is the real cost of the decision and it should be stated plainly.** A
project hook logged one repository. A user hook logs *every* project on the
machine — client work, private repositories, anything — and `detail` holds
**verbatim command bodies**, measured up to 7,219 characters.

Ship one environment variable, `SYNAPSE_BOUNDARY_OFF`, that makes the hook a
no-op on any truthy value. Nothing more elaborate: no allow-list, no deny-list,
no config file. **YAGNI applies until a second case exists**, and the honest
alternative to a filter is disclosure — the adoption document must say exactly
what is captured, in plain terms, rather than burying it.

### 6. The growth rate stops being a footnote

The hook-log adapter record measured **2,194 KB/day from Synapse alone**, from
an `appendFileSync` that nothing ever truncates. Instrumenting every repository
multiplies that by however many projects are active.

**Rotation is still not in scope here** — a reader that truncates its own input
is the wrong owner, and this record is not the writer's redesign either. But the
adapter's bounded-tail read moves from *sensible* to *load-bearing*, and that
dependency is now explicit: **task 9's Decision 4 must not be traded away.**

---

## Rejected

| Option | Why not |
|---|---|
| **A paste-in snippet per consumer repo**, as the backlog specified | N repos means N edits, forever, and every new repo starts uninstrumented. The user-scope hook covers repositories that do not exist yet. |
| **Copying the script into each consumer repo** | Two copies diverge, and the divergence is silent — a stale copy still exits 0 and still writes records, just the wrong ones. |
| **An absolute path to the Synapse checkout** (`node "E:/synapse/scripts/..."`) | Machine-specific, and it breaks the moment the checkout moves or is cloned elsewhere. Also unwritable as published guidance: Synapse cannot know where it lives on someone else's disk. |
| **An installer that merges the JSON into `~/.claude/settings.json`** | Silently rewriting the user's whole machine configuration — model, theme, plugins, their own three hooks — to add four lines. A bad JSON write there breaks every session on the machine, not one project. Print the fragment. |
| **A `.sh` wrapper matching the neighbouring hooks** | Adds a bash dependency on Windows to invoke a Node script that `node` already runs directly, on both platforms, today. |
| **An allow-list of instrumented repositories** | The kind of speculative generality YAGNI names. One off switch and honest disclosure covers the case that exists; an allow-list is a config format, a validator, and a new failure mode. |

---

## Reverses if

- **A repository must be excluded rather than all-or-nothing.** Decision 5's
  single switch becomes an allow-list, and that is the point at which the config
  format is justified — not before.
- **Claude Code changes how project and user hooks merge.** Decision 4's
  double-logging is a consequence of both firing; if they stop stacking, the
  removal is optional rather than required.
- **The log gains rotation.** Decision 6's dependency on task 9's tail read
  relaxes.

---

## Consequences

- **Every repository on the machine becomes instrumented**, which is the point,
  and is also a privacy surface that did not exist yesterday. The adoption
  document is the disclosure and is not optional decoration.
- **`deploy-agents.mjs` grows a second artifact kind.** Its manifest, its
  refuse-to-clobber default and its orphan reporting all need to cover hooks as
  well as agents. **Its own tests are the specification** — read
  `deploy-agents.test.mjs` before changing its shape.
- **`verify-install.mjs` should check the hook.** It runs 18 mechanical checks
  and reports agents in sync; a deployed hook that has drifted from its source
  is exactly the class of thing it already exists to catch.
- **The `$comment` in `.claude/settings.json` becomes wrong** and must be
  rewritten rather than left. It is the only place the old limitation is
  explained, so a stale copy actively misleads.
- **`docs/OVERVIEW.md:178` describes the logging** and will need the same pass.
- **Fully provable without a human.** Deploy target resolution, the manifest
  guard, the off switch and the no-duplicate-records assertion are all
  mechanical. The one step a human must do — pasting the fragment — is exactly
  the step Decision 3 makes deliberate, and `verify-install.mjs` can report
  whether it has been done.

---

## What was dispatched, and what landed

*Moved here from `watcher/docs/DISPATCH-QUEUE.md` on 2026-08-29, when landed
tasks were archived out of the queue. The queue keeps a one-line row; the
reasoning lives here, next to the decisions it acted on.*

This record was **task 10** in the dispatch queue.

### The dispatch prompt

    Make the orchestrator boundary hook cover every repository, per
    specs/2026-08-28-boundary-hook-machine-wide.md. Deploy the script
    to ~/.claude/hooks/ through deploy-agents.mjs's existing manifest
    guard, remove the now-duplicate project-scope hook, and add the
    SYNAPSE_BOUNDARY_OFF switch. Do NOT write to
    ~/.claude/settings.json — print the JSON fragment for the user to
    paste, and put it in the adoption document. Do not add log
    rotation; that is a separate decision.

**Two fences in that prompt, and both are load-bearing.** Writing to the
user's global `settings.json` would silently rewrite their model, theme,
plugins and their own three hooks to add four lines — a bad write there
breaks every session on the machine, not one project. And rotation is a
change to the *writer* with its own trade-off, not a subclause of an
installer.

**The failure it must not ship with:** project and user hooks both fire, so
leaving the project-scope hook in place means Synapse logs every tool call
twice — silently, with the log growing at double rate and every recency
count double-counting. The record asks for a duplicate-record test, which is
the cheap guard.

### Why it was in a Watcher queue at all

The queue's routing table listed it as one of three tasks that touch no Watcher
source:

| # | Package it actually changes | Why it is in this queue |
|---|---|---|
| **10** | **Synapse itself** — `scripts/orchestrator-boundary.mjs`, `deploy-agents.mjs`, `~/.claude/hooks/`, `adoption/` | **Hard prerequisite for task 9**, which is Watcher work. Task 10 makes every repository write to the boundary log; task 9 is the adapter that reads it. Running 9 first means building against a one-repo board. |

**10 goes before 9 on purpose.** Task 10 makes every repository log; task 9
reads the log. Running 9 first means building the adapter against a one-repo
board and hand-verifying it twice.

### The landing

Measured at `cc287ac`, 2026-08-29: **Watcher 641 pass / 0 fail**, **scripts 178**,
`verify-install` 21 checks with **1 warning** (below). Landed since the last
revision of this line: **10** (`c6e844e` … `9b8b281`) and **9**
(`56d7d6a` … `cc287ac`), both `[manager]`, both complete — task 9's plan is
committed, which is the signal that separates "landed" from "in flight."

Counted as column-0 `test(` declarations — `^test\(`, top-level only — across
`watcher/src/**/*.test.mjs`, measured at the task's final commit:

| Task | Commit | Count |
|---|---|---|
| 10 | `c6e844e` … `9b8b281` | **542 — unchanged** (Synapse work; scripts 150 → 178) |

From the queue's plan-file audit of 2026-08-29 against `git ls-files`:

| Task | Plan file | State |
|---|---|---|
| 10 | `plans/2026-08-29-boundary-hook-machine-wide.md` | untracked |

The queue's own scope row, as it read at the archive:

| # | Task | Proof without you | Spec |
|---|---|---|---|
| 10 | ~~**The boundary hook goes machine-wide** `[Synapse]`~~ **DONE** `c6e844e` … `9b8b281` — **one manual step still waiting on Karl**, see the run order | **Full** — deploy resolution, the guard, the off switch and the no-duplicate-records check are all mechanical | done `specs/2026-08-28-boundary-hook-machine-wide.md` |

### The manual step is STILL OUTSTANDING as of 2026-08-29

**This is not history. It is live.** The task landed, but the one step Decision 3
deliberately reserved for a human has never been performed, and the boundary log
has recorded nothing since. The queue's warning, verbatim:

> **ONE STEP IS WAITING ON KARL, and the boundary log is dark until it runs.**
> `deploy-agents.mjs` has already run — `~/.claude/hooks/synapse-orchestrator-boundary.mjs`
> is deployed and `verify-install` reports it in sync. **The single remaining step
> is pasting the printed fragment into `~/.claude/settings.json`**, which the spec
> deliberately forbids Watcher from writing.
>
> Until then: `aff6029` removed the project-scope hook as designed and the
> user-scope replacement is not registered, so **nothing is being recorded.**
> Measured 2026-08-29 — last log entry `11:55:18Z`.
>
> **`verify-install` prints `ok Boundary hook recording` while it records
> nothing.** Its test is *"has recorded at least one call"* — existence, not
> recency — so it will stay green forever. A false green sitting directly on top
> of the one thing that needs doing.

The queue's overall suite line carried the same warning in its parenthetical:

> Suite is **644 pass / 0 fail**; scripts **178**; `verify-install` **21 checks, 1 warning** (the boundary-hook registration waiting on Karl). Re-measured 2026-08-29 at `f144992`.

**Task 9's adapter reads that log**, so for as long as the paste is outstanding
the `activity` field it fills is being fed a file frozen at `11:55:18Z`.

### One more thing the queue recorded against this task

> **This line was wrong in two directions at once on 2026-08-29** — it said "task
> 10 is IN FLIGHT" and, twenty-six lines later, "nothing is in flight, next to
> send 10." Both false; task 9 was running. That is the fourth wrong in-flight
> claim in two days and the first to contradict itself inside one section. It was
> caught by a mechanical audit, not by reading — which is the case for **task 15**.
