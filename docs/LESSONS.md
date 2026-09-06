# Lessons

Hard-won fixes. Problems that took a long time to diagnose, needed a
non-obvious workaround, or were solved only after several wrong turns.

**This file exists to stop the same day being spent twice.** It is not a
changelog and not a bug list — a bug that took ten minutes does not belong
here. The bar for an entry is one of:

- it took a long time to figure out
- the fix was weird, counter-intuitive, or a workaround
- several plausible explanations were wrong before the real one was found
- the failure was **silent** — nothing errored, it just quietly did the wrong thing

## How to use it

**Search by symptom, not by cause.** When something breaks you know what you
are seeing, not why. Entries lead with the symptom for exactly that reason.

**Read the "Generalises to" line.** The specific bug may never recur, but the
shape of it usually does. That line is the reason this file is portable across
projects rather than a per-project bug log.

## Entry format

    ### Short title
    **Symptom:** what you would actually search for
    **Root cause:** what was really happening
    **Fix:** what resolved it
    **Wrong turns:** plausible explanations that were disproven (optional)
    **Generalises to:** the reusable shape of the lesson

---

## Agent & harness configuration

### A marker check matched the sentence saying the marker was absent

**Symptom:** Manager's document-provenance check reports that a document is a
pipeline artifact when it plainly is not — and does it for *every* document you
hand it, so every task in a run halts asking you to confirm something you know
is false. From the outside it looks like Manager read the document, which it
cannot do.

**Root cause:** The check was `grep -l "synapse-pipeline-artifact" <path>` — a
**substring match over the whole file**. `synapse-architect` writes that marker
as the literal first line, but brainstorm decision records *mention* the string
in prose, in a boilerplate disclaimer that reads *"deliberately carries no
`synapse-pipeline-artifact` marker."* The sentence denying the marker contains
the marker. `grep` cannot tell a marker from a mention.

On 2026-08-28 this matched **all six queued Watcher specs** plus three more
documents in the same directory. Exactly one file in that directory carried a
real marker.

**Fix:** Anchor the match to the line the producer actually writes it on:

    head -1 <path> | grep -c "synapse-pipeline-artifact"

Prints `1` or `0`. Still content-blind — a count, not a line — so the "you do
not open it" rule is intact. `synapse-architect.md` already guarantees the
placement: *"the very first line, no other text before it, and never a reworded
variant."* The check was simply not using a guarantee it already had.

**Wrong turns:** The natural first reading is that Manager violated its own
"never open a document" rule, because it appeared to know something about the
file's contents. It did not. It ran one permitted command and drew a wrong
conclusion from a true result. **Symptom-identical to a capability breach, and
a completely different bug** — worth checking which before rewriting an agent's
tool grants.

**Generalises to:** *A detector whose pattern can appear in prose about the
detector will fire on its own documentation.* Anchor a marker check to the
position its producer guarantees, not to the file. And note the second-order
cost: a false alarm the user can only answer "yes, proceed" to is worse than no
alarm, because six of those in a row means nobody reads the seventh — the same
habituation failure the Watcher's own §7.1 is written to prevent, in a
different costume.

### An artifact republish refuses forever, and only `force: true` ends it

> **CORRECTED 2026-08-29. The headline is false and the fix below is wrong.**
> The remedy the error describes *does* work — it has to be executed literally,
> and three separate approximations of it silently fail. **Read the correction
> at the end of this entry before acting on any of it.** The original text is
> kept in full because the mistake is instructive: every wrong turn it lists was
> a *near*-compliance that felt like compliance.

**Symptom:** Updating an existing artifact is refused. The first refusal says
you *"hadn't viewed the live version"* and names a saved copy to read. You read
that copy in full, publish again — and every later attempt returns a different
message that is actually a dead end: *"identical content already refused…
resent unchanged"*, telling you to re-fetch the URL and publish again. You
re-fetch. Same refusal. **Nothing you do in the direction the error points ever
clears it.**

**Root cause:** Not established from the inside — this is observed behaviour,
twice. What is measured is the shape: **after the first refusal, the submitted
bytes are held against you.** The second and later checks compare your file to
*the submission already rejected*, not to the live version. So the more correct
your merge is, the more reliably it is refused: a correct merge is byte-stable,
and byte-stable is exactly what reads as "resent unchanged." Re-reading and
re-fetching satisfy the sentence in the error without touching the thing being
compared.

**Fix:** **`force: true`, on the user's explicit say-so.** That is the only exit.
It is not a workaround for skipping verification — do the verification first,
once:

1. `action: "read"` the artifact, then Read the saved file it names, **in full**.
2. Confirm the live content matches what you are building on, and layer your
   edits onto it.
3. Publish. **If that is refused, do not publish again unchanged.** Ask for
   `force` and use it.

Verify by comparing, not by re-reading: extract the live body, diff it against
your working file, and you know in one command whether anything published is at
risk. If the diff is only your intended edits, forcing discards nothing.

**Wrong turns:** All of them were compliance with the error text. Reading the
saved file line by line; re-fetching the URL with `action: "read"`; publishing
again immediately after each. On 2026-08-28 that ran **three refusals** before
forcing; the session before it ran **four**. Both ended the same way. The error
message is not lying about what it wants — it is describing a check that your
compliance cannot satisfy.

**Generalises to:** *When an error's own remedy has been followed exactly and
produces the identical error, the remedy is not the fix — stop executing it.*
Two identical failures after doing what you were told is the signal to change
category, not to try harder. Keep count across sessions: a loop that cost four
round-trips last time and three this time is a documented dead end, and the
third session should force on the first refusal rather than rediscovering it.
Costly-and-repeated beats novel as a reason to write something down.

#### The correction, 2026-08-29 — the remedy works, performed literally

**The third session did not force on the first refusal. It published, with no
`force`, on the fourth attempt** — and what changed was not the content.

**Measured sequence, one artifact, one session:**

| | Done | Result |
|---|---|---|
| 1 | Read a `sed` extract of the saved file, not the file | refused — *"hadn't viewed"* |
| 2 | Read the saved file, lines 2–333 — **skipped line 1** | refused — *"resent unchanged"* |
| 3 | Published again unchanged | refused — identical message |
| 4 | **Fresh `action: "read"`**, then Read **line 1** as well | **published** |

**Three near-misses, each of which defeats the check while looking like
compliance:**

1. **A copy is not the file.** Reading a `sed` slice of the saved artifact does
   not count, though the bytes are identical. What is tracked is whether *that
   path* was Read.
2. **"Every line" includes the line that is not yours.** Line 1 of a saved
   artifact is ~25KB of minified runtime JavaScript injected by the platform —
   not content, never republished, genuinely expensive to read. Skipping it
   fails the check.
3. **A re-read is not a re-fetch.** The error says so in its own words:
   *"re-Reading a file an earlier refusal handed you does not count."* A fresh
   `action: "read"` is required even when it returns the same version id and
   writes to the same path.

**The working sequence:** `action: "read"` → Read the named file **in full, no
offsets** → diff against your working file → publish.

**What was wrong with the root cause above, and why it was persuasive.** The
byte-stability theory — *a correct merge is byte-stable, byte-stable reads as
"resent unchanged", so the better the merge the more certainly it is refused* —
is coherent, fits every observation, and is **unfalsifiable from the inside.**
That is what made it comfortable rather than what made it true. It explains any
number of repeat refusals without once asking whether the remedy was actually
performed. A theory that accounts for the failure while excusing you from
checking your own compliance deserves more suspicion, not less.

**The two earlier incidents (2026-08-27, four attempts; 2026-08-28, three) were
probably this same mistake.** Not provable — those sessions' reasoning is not
recoverable, and neither recorded whether the saved file was read whole or in
part. But "I read the saved file" plausibly meant something looser then too, and
a platform defect that vanishes the moment someone reads one more line was never
the likelier explanation.

**Generalises to, corrected:** *before concluding that an error's own remedy
cannot work, confirm you performed it literally rather than substantially.* Two
identical failures are first a prompt to audit your own compliance, and only
then a reason to change category. **A remedy you approximated is not a remedy
you tried** — and the approximations that fool you are the ones with a good
reason behind them: saving context, skipping machine-generated noise, reusing
something already on disk.

**This entry now argues against its own headline. That is deliberate** — it was
cited from `~/.claude/CLAUDE.md` and would have kept costing sessions a forced
write. Both were corrected together.

### MCP server invisible in one project, fine in another

**Symptom:** An MCP server's tools are available in project A and completely
absent in project B. `claude mcp list` from B does not show it at all — not
"failed", not "disconnected", absent.

**Root cause:** The server was registered at **local scope**, which is private
to the directory it was registered from.

**Fix:** Re-register at **user scope**. It then resolves in every project.

**Wrong turns:** Four separate theories were pursued and disproven first, all
about subagent tool inheritance: that nested subagents inherit the parent's
`Agent()` list rather than their own; that MCP grants do not propagate to
nested subagents; that inheritance replaces rather than intersects; and that
`claude --agent X` strips MCP tools from subagents. **None were true.** Hours
went into architecture theories for what was a registration-scope typo.

**Generalises to:** When a capability is missing in one context and present in
another, **check registration and scope before theorising about the
architecture.** The mundane explanation — where a thing was registered, what
directory it was registered from — is far more likely than a deep framework
behaviour. Confirm the boring cause is actually ruled out before building a
theory that requires the framework to be broken.

---

### Backups inside a config directory shadowed the live files

**Symptom:** Edits to agent definitions had no effect. No error, no warning —
the changes simply did nothing, repeatedly, across restarts.

**Root cause:** Backup copies had been placed in `~/.claude/agents/backup/`.
Files in that subdirectory **registered as duplicate agent names** and shadowed
the real definitions. The running agents were the backups.

**Fix:** Move backups outside the scanned directory entirely, and rename to
`.md.bak` so they can never register even if they end up somewhere scanned.

**Generalises to:** **Never put backups, drafts, or notes inside a directory
that something auto-scans.** Auto-discovery does not know what you meant — it
registers whatever matches the pattern, including your safety copy. The blast
radius is worse than a normal bug because the symptom is *silence*: the system
keeps working, just with the wrong version. If edits to a config file appear to
do nothing, look for a second copy of that file before doubting the edit.

---

### Subagents did not inherit the effort level from settings.json

**Symptom:** `"effortLevel": "high"` is set globally in `settings.json`, but it
is unclear whether subagents actually run at high effort. Nothing reports it.

**Root cause:** Subagents do **not** read `settings.json` and do not inherit
`effortLevel` from it directly. They inherit the *session's* effort level,
which can itself come from that setting. A subagent's own `effort:` frontmatter
overrides the inherited value.

**Fix:** Set `effort:` explicitly in each agent's frontmatter — valid values are
`low`, `medium`, `high`, `xhigh`, `max`. Do not rely on inheritance.

**Generalises to:** **Config inheritance is rarely transitive, and never assume
it is silent-safe.** A global setting reaching a nested execution context is a
claim to verify, not to assume. Where a setting materially affects cost or
quality, set it explicitly at the level that consumes it — inherited values are
invisible and therefore unauditable.

---

### Subagent results lost when the parent's turn ended

**Symptom:** Spawned subagents all completed successfully, but their results
never arrived and the work appeared cancelled.

**Root cause:** The parent ended its turn while children were still running.
**Completed children cannot notify a parent whose turn has ended** — the
results are orphaned.

**Fix:** A parent that delegates owns collection. Wait for results, integrate
them, then return. Never end a turn with "waiting for background agents."

**Generalises to:** **A spawned task is not a completed task.** Any fan-out
pattern needs an explicit join. This is why the orchestration design
(`specs/stream-orchestration-design.md`) puts state in a file rather than in a
supervising session — a protocol over files has no parent whose death can
orphan anything.

---

### Manager ended its turn mid-cycle, and the child's result went to the parent

**Symptom:** A `synapse-manager` run returns a final message reading "Waiting on
its response before re-reviewing." The pipeline is not finished. The `synapse-coder`
it was waiting on completes normally minutes later — and its result surfaces
in the **top-level conversation**, not in manager. Manager never receives it,
and recovers by polling the working tree until the files stop changing.

**Root cause:** The delegation completion contract — never end a turn while a
spawned child is live, because if you delegate you own collection — lives in
the machine-wide rules file `~/.claude/rules/ecc/common/agents.md`. **It
appears nowhere in `agents/synapse-manager.md`.** A subagent runs on its own
definition; a rule in a file it never reads cannot bind it. Once manager's
turn ended, the completing child had no live parent to return to, so its
result routed upward to the parent conversation instead.

The downstream cost is not just a stall. Manager reconstructed state by
watching the filesystem, then approved on the reviewer's independent reading
of the diff, with no corroborating summary from the author of the change. It
said so plainly, which is the right behaviour — but the gate was thinner than
it looked, and only manager's own honesty revealed that.

**Fix:** Applied 2026-08-24. `synapse-manager.md` now states the contract in its own
terms, before path selection so it is read on every task: a dispatch is not
finished until its result is in hand, a turn must not end while one is
outstanding, and a child that returns nothing usable must be reported as such
rather than approved around.

**Wrong turns:** The `synapse-coder` reported it had no `SendMessage` tool and worried
its summary could not be delivered. That is a red herring — a subagent's final
message **is** its return value, and the mechanism worked. The summary went
missing because there was no live parent, not because coder lacked a channel.
`synapse-coder.md` now says so outright — its final message *is* the value Manager
receives, so it should neither hunt for a sending tool nor apologise for
lacking one.

**Generalises to:** A rule that binds an agent must live in that agent's own
definition. Machine-wide rules files govern the session you type in, not the
subagents it spawns. Before concluding an agent ignored a rule, check whether
the rule is anywhere it can see — this is the same class as the stale-definition
trap, and it looks identical from the outside.

---

### "Restart the session" was ambiguous, and three of the four readings are wrong

**Symptom:** An agent definition is edited, deployed, the session is
"restarted" — and the agent still behaves the old way. Nothing errors. It looks
exactly like an agent ignoring a new rule.

**Root cause:** "Restart" was never defined, and the intuitive readings do not
work. Agent definitions and MCP servers are read from disk **once, when the
`claude` process starts**, and every dispatch that process makes for the rest of
its life reuses that in-memory copy. So:

- Clearing context (`/clear`) does **not** reload them — same process.
- Writing a handoff and continuing does **not** — same process.
- A new terminal tab, or restarting the shell, does **not** — the shell never
  held the definitions.
- Only exiting the `claude` process and launching it again does.

`deploy-agents.mjs` writes files on disk; it cannot reach into a process that is
already running. Concurrent sessions each need their own relaunch — one deploy
reaches none of them.

**Fix:** Judge by process, not by conversation. If you cannot point to the
`claude` invocation happening *after* the deploy, assume that session is running
stale text. `README.md` already said definitions load at session start; what
"session" meant was the part never written down.

**Generalises to:** When the remedy is "restart X", define X. Load-bearing words
everyone assumes they understand are where cheap failures live — and this one is
indistinguishable from a genuinely bad rule, so it costs a full debugging pass
every time it is hit.

### An agent emitted a field nothing read, and held tools nothing called

**Symptom:** Nothing fails. Every dispatch works, every verdict arrives. But
`synapse-planner` emits a `FOOTPRINT:` block on every plan that no other agent reads,
and `synapse-manager` loads 20 PixelLab tool schemas while its own prose forbids it
from producing art or dispatching `synapse-artist`. There is no error to search for —
the cost is paid per invocation, forever, and nothing reports it.

**Root cause:** Two different origins that look identical from inside the file.

- **A consumer was designed, then abandoned.** The footprint fed the registry
  and dispatch rule of `specs/2026-08-23-stream-orchestration-design.md` §4–§6.
  §17 abandoned that layer — but `synapse-planner`'s output contract was never revised
  with it, and its *rationale* still argued from the dead consumer: "compared
  against what other work already claims", "two agents in one file", "the signal
  Manager needs". None of those were true any more.
- **A grant was copied forward past the prose that killed it.** `synapse-manager`
  received the PixelLab list when the art path was first wired, and kept it
  after the design settled on Art Director owning every generation call.

**Fix:** Audit mechanically rather than by reading. Parse each agent's `tools:`
line and check every grant against its own body; check every "produce X"
instruction against a named reader. Then, per item, **wire it or delete it.**
The footprint got a consumer — Reviewer compares it against the paths Coder
reports touching and reports discrepancies as findings — which also closes the
*"plan's file list was short by one"* entry above in one direction. Manager's
20 MCP grants and its `Agent(synapse-artist)` grant were deleted; the latter turned a
prose prohibition it already carried into enforcement by absence.

**Wrong turns:** "Leave it scaffolded for later" is not one of the options, and
believing it is will cost you the audit twice. **You cannot comment out prose.**
An agent definition is loaded whole at session start; a paragraph labelled "not
active yet" is read and reasoned over exactly like a live rule, and costs *more*
than deleting it, because it must also be understood and then dismissed. If the
design is worth keeping, it belongs in `specs/` — where it is read once by a
human deciding to rebuild it, not once per dispatch by an agent told to ignore
it.

**Generalises to:** **An instruction's cost is paid on every invocation; its
benefit is paid only when something consumes the output.** Those land in
different ledgers, so the imbalance never surfaces on its own — no error, no
visible slowdown, just a standing charge. Ask of every emitted field and every
granted tool: *what path leads to this being used?*

**Distinguish unused from unreachable — they look identical in an audit and are
opposites.** A grant nobody has exercised yet is live if the agent's job admits
it; the request simply has not arrived. A grant the agent's own prose forbids it
from exercising is dead. Manager's PixelLab tools failed that test — its body
says it never produces art and must never dispatch `synapse-artist`. Art Director's and
Artist's unexercised tileset and map-object grants pass it: generating those is
their job, and the user confirmed the work is coming. Both now say so in their
own bodies, because an audit that reads only the definition cannot tell intent
from residue.

And watch the second-order damage, which is worse than the tokens: an agent
calibrates its judgment against the rationale it is given. `synapse-planner` was
weighing over-declaration against a scheduling cost that no longer existed. A
dead consumer does not merely waste output — it silently mis-tunes the
decision that produces it.

### Deploy destroyed an agent someone else wrote, and said "updated"

**Symptom:** A user with their own `~/.claude/agents/coder.md` runs Synapse's
documented first command. Their file is gone. The output said
`updated: coder.md` — identical to a successful deploy of our own file.

**Root cause:** Two independent mistakes that only bite together.

The agent definitions were named `coder`, `planner`, `reviewer`, `manager` —
among the most likely names anyone would pick for their own agents, deployed
into a **shared namespace we do not own**. And `deploy-agents` kept no record
of what it had put there, so it could not tell its own older copy from a
stranger's file. It overwrote both, because from inside the script they look
the same: a file exists at the path I am about to write.

**Fix:** Both halves. The definitions are namespaced `synapse-*`, and deploy
now keeps an ownership manifest beside the agents directory and **refuses** to
overwrite anything not in it, with `--force` as the deliberate override.
Refusal exits non-zero — a deploy that declines to write half the agents and
exits 0 is the same silent-success failure one layer up.

**Wrong turns:** Renaming looks like the whole fix and is not. It lowers the
*probability* of collision without touching the *mechanism*, and on its own it
strands the old files: seven stale definitions left in the load directory,
still loading, indistinguishable from current ones. Namespacing without a
migration converts a collision bug into a duplicate-definition bug.

**The part worth carrying:** *the test suite had already blessed the bug.* The
suite written for this script the same week contained:

    test('overwrites a stale deployed copy with the repo version', ...)

That test is correct for our own files and blind to the case that mattered. It
did not fail to catch the bug — **it asserted the bug was the intended
behaviour.** Coverage was never the gap; a test existed, passed, and pointed
the wrong way.

Every test encodes an assumption about who owns the thing being changed. That
assumption is invisible when writer and owner are the same party, which is
always true on the machine where the code is written and stops being true the
moment it ships.

**Generalises to:** **Anything that writes into a namespace it does not own
must be able to name what it owns.** Installers, deployers, code generators,
migrations, sync tools. Without an ownership record the only available question
is "does a file exist here", which cannot distinguish *mine, stale* from
*theirs, precious* — and the destructive answer is the one that looks like
success.

Two corollaries, both cheap:

- **Generic names in a shared namespace are a collision waiting for a
  population.** One user never sees it; the first stranger does.
- **When a test asserts that you overwrite something, ask whose it is.** A
  passing suite is evidence about the assumptions of its author, not about the
  world.

### Third-party prose reached a proprietary product through a rules file

**Symptom:** A commercial repo turned out to contain ~94 words copied
near-verbatim from an MIT-licensed project, in two agent definitions, with no
attribution anywhere. Nobody decided to copy it.

**Root cause:** The text lived in a machine-wide rules file that Claude Code
loads into **every session** on that machine. From inside a session, standing
instructions from a third-party bundle and standing instructions the user wrote
are the same thing: prose in the context window with no provenance attached. A
session carrying a rule into an agent definition — a perfectly reasonable act —
laundered its origin in the process.

**Fix:** Rewrite the passage in the project's own words, and attribute the idea
anyway in `NOTICE.md`. Both licences involved were MIT, which permits
commercial use and sale outright; the only unmet condition was the notice.

**Wrong turns:** Reasoning about it from memory. The overlap was not visible by
reading — the passage looked like ordinary house style, because by then it was.
It surfaced only from a mechanical comparison of every document in the repo
against every document in the two upstream projects.

**Generalises to:** **Context is not provenance.** Anything loaded into a
session — global rules, plugin instructions, skill text, a pasted document —
arrives stripped of its licence, and the further it travels the more it looks
like yours. A project that ships or sells its prose should check that
mechanically rather than trusting recall:

- Word-level shingling, 7+ consecutive words, fenced code excluded so shared
  loop idioms do not register. Independent authorship of similar material
  produces occasional short collisions on stock phrasing; copying produces long
  contiguous ones. The signal is unambiguous — 56- and 38-word runs against a
  background of zero.
- **Run it against what is installed, not against what you remember
  installing.** The upstream here had been half-uninstalled months earlier and
  was still loading its rules layer every session.
- Short shared aphorisms inside otherwise original prose are not worth
  rewriting. Mangling an accurate account to avoid an eight-word phrase makes
  the document worse; a notice is the proportionate remedy.

**A second-order point worth keeping:** the same property that makes a
machine-wide rules layer convenient — it applies everywhere without being asked
for — is what makes it invisible. Convenience and untraceability are the same
mechanism seen from two directions.

---

### Backslash pairs vanished between the tool call and the file on disk

**Symptom:** A file written from the Bash tool — heredoc, `printf`, `sed`, any
of them — contains half the backslashes it should. Usually there is **no
error**: a Windows path written as `<home>` lands as `<home>`,
and the script built from it fails much later somewhere else. When it does
error, it surfaces as bash's `unexpected EOF while looking for matching quote`,
because a JavaScript string ending `...\\'` collapses to `...\'`, the closing
quote becomes escaped, and the string never terminates.

**Root cause:** The Bash tool's `command` string is passed through an
escape processor **above bash** before bash ever runs. Measured behaviour, for
a run of *n* backslashes: 1 → 1, 2 → 1, 3 → 2, 4 → 2. Each pair collapses to
one. The processor is double-quote-sensitive: a run immediately preceding a `"`
is preserved intact, a run anywhere else is halved. Quoting does not protect
the text — the collapse happens inside single quotes and inside a
quoted-delimiter heredoc alike, because it happens before any of that is
parsed.

**Fix:** **Write file content with the `Write` tool, then run it from Bash.**
The `Write` path does not touch backslashes — the same four-backslash string
that arrives as two through Bash arrives as four through `Write`. This is the
same conclusion two earlier sessions reached by trial and error; it is now
measured rather than folklore. If content must go through Bash, double every
backslash that has to survive — but prefer `Write`, because the failure is
silent and the doubling has to be right everywhere.

**Wrong turns:** Four plausible culprits were each measured and cleared.
**bash and `eval` are innocent** — the harness wraps the command as
`eval '<command>'`, so the text is parsed twice, but `/proc/$$/cmdline` shows
bash *receiving* the already-collapsed text, and single quotes carry it through
`eval` intact. **MSYS2 and Git Bash are innocent** for the same reason.
**Windows command-line argv parsing is ruled out by signature:**
`CommandLineToArgvW` and the MSVC CRT leave backslashes literal *except*
immediately before a `"`, where a run of `2n` is halved. The observed rule is
the exact inverse — halved everywhere, preserved before `"`. **The model's own
JSON encoding is innocent**, proven by the control: an identical four-backslash
payload, same session, same encoder, arrived correct through `Write` and
collapsed through Bash. The difference is the tool path, not the encoding.

**Platform scope: Windows-only. Measured 2026-08-26, not inferred.** The probe
below was run on both platforms at **identical Claude Code version 2.1.220**,
which is the only reason the comparison means anything:

| Harness (both v2.1.220) | Four backslashes in | On disk |
|---|---|---|
| Windows 11, Git Bash (MINGW64) | `A\\\\B` | `A \ \ B` — 5 bytes |
| Ubuntu 26.04, WSL 2, kernel `6.18.33.2` | `A\\\\B` | `A \ \ \ \ B` — 7 bytes |

One variable moved, opposite results. Linux was also clean at 2.1.246, so the
Linux result does not hinge on the pinned version — only the *comparison* does.
**macOS remains untested** and is not on this project's roadmap; the probe still
stands for anyone who can run it:

    cat > /tmp/p.txt <<'EOF'
    A\\\\B
    EOF
    od -c /tmp/p.txt

**The Windows-only theory was right and its reasoning was still wrong to trust.**
The tempting inference — "POSIX `spawn()` passes a real `argv` array and never
composes a command-line string" — predicted the correct answer. But the evidence
that *weakened* it has not gone away: the processor is quote-sensitive, which
indicates a deliberate shell-aware escaper rather than an OS-level accident, and
that is still unexplained. A theory that reaches the right conclusion through
reasoning the evidence contradicts is a coincidence, not a finding. The result
above is load-bearing; the explanation for it is not yet known.

**Two traps in measuring this, both of which nearly produced a false result:**

- **Running `wsl bash -c ...` from the Windows session does not isolate the
  variable.** The command still traverses the Windows Bash tool first, so the
  collapse happens before WSL sees anything. Settling it requires Claude Code
  **installed and running inside Linux**, with its own Bash tool.
- **A pinned version un-pins itself.** Claude Code auto-updated from 2.1.220 to
  2.1.246 between the install and the probe, silently converting a controlled
  comparison back into the uncontrolled one — and the screenshot of the result
  looked identical either way. `~/.claude/.last-update-result.json` records the
  swap and is what caught it. Set `"autoUpdates": false` **and**
  `DISABLE_AUTOUPDATER=1`, then re-read the version *after* the measurement, not
  only before. **A control you did not verify still held is not a control.**

**Generalises to:** **When a transformation corrupts data silently, find the
layer before you write the workaround — and prove each layer innocent rather
than arguing it.** Two prior sessions recorded this as folklore and both got
the trigger wrong: one blamed "mixed quotes", the other blamed `\n`. Neither is
transformed at all. The wrong trigger costs more than no note, because it sends
the next session guarding the wrong thing. The cheap discriminator is usually a
**control through a second path** — here, the same payload through `Write`,
which converted "something eats backslashes" into "the Bash path eats
backslashes" in one call. And when the evidence runs out, **say where it ran
out**: a lesson scoped to what was measured stays true, while a lesson scoped
to a plausible platform theory becomes wrong the first time someone runs it
somewhere else.

---

## Art pipeline

### Base64 reference images silently corrupted above ~32px

**Symptom:** Generated art degrades or comes back subtly wrong when a reference
image is passed, with no error.

**Root cause:** `reference_image_base64` is routinely **truncated mid-string**
above roughly 32px, silently corrupting the image.

**Fix:** Use `reference_image_url` instead. Always.

**Generalises to:** **Prefer a reference over an inlined payload** when an API
offers both. Inlined binary has size limits that often fail by truncation
rather than by error — the request succeeds and the data is wrong.

---

### Hand-drawn art passed style review

**Symptom:** An asset was accepted as generated art when it had actually been
drawn programmatically, pixel by pixel.

**Root cause:** Style review cannot catch this. **A hand-drawn sprite matches
the style guide *better* than a generated one**, because it was drawn directly
from the guide. Quality review selects *for* the fake.

**Fix:** Check provenance **mechanically, not by eye**: read the generation
balance before and after; if `generations_used` did not increase, reject the
asset regardless of how good it looks. Also removed the tools that made hand
authoring possible, and made "return nothing" an explicitly acceptable outcome.

**Generalises to:** **When a check can be satisfied by the thing it is meant to
exclude, the check is the wrong shape.** Verify provenance out-of-band —
against a counter, a log, a receipt — rather than by inspecting the artifact.
Any review that grades output quality will systematically prefer a well-made
forgery.

---

## Architecture

### A git trailer vanished, and the recorded reason was wrong

**Symptom:** A commit message plainly contains `Session: manager` and
`Co-Authored-By: ...`, but `git log --format='%(trailers:key=...)'` returns
nothing for one of them. Nothing errors. The commit looks correct and the
ledger silently loses an entry.

**Root cause:** **Git parses only the LAST paragraph of the message as the
trailer block.** A blank line between two trailers means the ones *above* it
are no longer in that block, so they are dropped — the final trailer still
parses fine.

**Fix:** Assemble every trailer into one block joined by single newlines, and
never let a caller format it ad hoc. `scripts/commit-task.mjs` owns this, and
reads the trailer back out of git after committing rather than trusting that
the text it wrote survived.

**Wrong turns:** `HANDOFF.md` #17 recorded this gotcha as *"a blank line splits
the block and git parses no trailers."* That is wrong, and it was wrong in a
way that matters: it predicts total loss, when the real behaviour is partial
and silent. Measured on 2026-08-27 by a test written to prove the hazard was
real — the test failed, which is how the error surfaced. **A remedy can be
correct while the explanation attached to it is not**, and only the explanation
gets reused for the next decision.

**Generalises to:** Write the test that proves the failure mode exists, not
only the one that proves your fix works. The second passes against a hazard
that was never real; only the first checks whether you understood it.

### An entry-point guard that silently disabled the script it guarded

**Symptom:** A Node script runs, exits 0, prints nothing, and does nothing.
Its unit tests all pass. On Linux the same file works.

**Root cause:** The `is this file the entry point` check hand-built a URL —
``import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` `` — which
produces `file://E:/path` on Windows where Node produces `file:///E:/path`. The
comparison is never true, so the main body never runs. **Exit 0 with no output
is indistinguishable from success.**

**Fix:** `pathToFileURL(process.argv[1]).href`. It is the only spelling that
agrees with `import.meta.url` on both platforms.

**Wrong turns:** Trusting a green unit suite. Every exported function was
tested and correct; the module simply never executed as a program. The bug
lives in the gap between "imported for tests" and "run as a script", which is
exactly the gap unit tests do not cover.

**Generalises to:** For anything invoked as a process — a hook, a CLI, a git
helper — spawn it in at least one test. The Windows/POSIX path split makes this
a *portability* bug too, and Synapse targets both.

### Parallel work streams serialised on composition roots

**Symptom:** Independent features cannot be worked on concurrently. Plans have
to be run in a specific order, and a later plan silently drops an earlier
plan's changes.

**Root cause:** A handful of files — the composition root, the update pipeline,
the render path, the primary entity constructor, raw test-state literals — are
touched by *nearly every* feature. Any file-level conflict check finds that
every stream collides.

**Fix:** Composition roots become **append-only registries**; test fixtures
become factories. The shared edit cannot be removed, but it can be demoted from
"rewrite this function" to "append one line." Append-only lists merge cleanly.
See `specs/composition-root-seams-pattern.md`.

**Generalises to:** **Parallelism is limited by the shape of the codebase, not
by the orchestration on top of it.** Before building machinery to coordinate
concurrent work, check whether the work *can* be disjoint. Coordination
machinery over a codebase with hot files is correct and useless.

Corollary: a file touched by 3+ concurrent changes is becoming a composition
root and wants a seam. Detect that by counting, not by waiting for a collision.

---

### A fan-out that only bought wall-clock time bought a correctness hazard with it

**Symptom:** An obviously-good parallelisation — dispatch several planners at
once instead of one at a time — is proposed, costed, and looks free. The
orchestration spec even confirms the fan-out itself is safe.

**Root cause:** The fan-out *was* safe. What consumed it was not. Planning is
short enough that the dispatching session stays alive through it and collects
every result, so §7 clears the mechanism. But the batch exists in order to route
with **all footprints in hand**, and footprints did not exist yet. Without them,
with `synapse-coder` still serial, every plan after the first is a **queued** plan —
written against a codebase the plan ahead of it is about to change — and nothing
marks a queued plan for revalidation. One stage got faster, and the pipeline
acquired a way to implement a stale plan silently.

**Fix:** Withdrawn rather than shipped. Revisit only once footprints exist to
route on *and* stale queued plans have an answer. `synapse-planner`'s footprint block
(`a9e3009`) is the first of those two, not both.

**Generalises to:** A parallelisation is not safe merely because the parallel
step is safe. Ask what the batch was *for*: if the mechanism meant to consume it
does not exist yet, you keep the speedup and lose the coordination that
justified it — which converts a latency win into a correctness hazard. The
question that surfaces it is **what goes stale while the queue drains?**

---

## Planning & review

### A plan's file list was short by one, and nothing said so

**Symptom:** An implementation plan enumerates the files it will touch and the
count it expects ("the 9 raw literals across the test suite"). The
implementation touches a file the plan never listed. Nothing errors while the
plan is written — the plan simply describes a smaller codebase than the real
one, confidently.

**Root cause:** The plan's survey was **enumeration-shaped** — "find every X
scattered across the codebase" — and enumeration has no stopping rule. It found
`tests/sim/world.test.ts` and `tests/sim/console.test.ts` and missed
`tests/sim/featureFlags.test.ts`. Crucially the missed file was **not new**: it
arrived in `5eee677` (2026-08-22), the day *before* the plan was written in
`cbc5e7d` (2026-08-23). So the survey was **incomplete, not stale** — a
different and worse class of error. Staleness has an obvious remedy, re-survey
before executing. Incompleteness has none, because a missed item and a
nonexistent one look identical from inside the survey.

**Fix:** The plan already contained the right instrument — a repo-wide
mechanical sweep, `grep -rn "pendingAoeEffects: \[\]" tests/`, expecting no
output. It was placed as a **final verification step**. Run that sweep to
*build* the file list during the survey, not only to confirm it after the work.
The tool was present and ran too late.

Then treat the two survey shapes differently:

- **Enumeration-shaped** ("find all X") — no completeness signal. Close it with
  a mechanical sweep that succeeds by finding nothing.
- **Bounded** ("survey the steps of this one function") — the boundary is the
  thing itself; one careful pass covers it.

**Wrong turns:** The first read was that the survey had gone stale — that the
file appeared after the plan was written. Comparing the two commit dates
disproved that in one command, and the correction mattered: it moved the fix
from "re-survey before executing" to "change how the survey is built."

**Generalises to:** **An enumeration is only as trustworthy as its stopping
rule.** When the task is "find all of X," the survey cannot report its own
completeness, and a confident count is not evidence of one. Ask what *shape* a
survey had before trusting its numbers, and derive open-ended lists from a
mechanical check rather than auditing them with one afterwards.

### An inherited diagnosis survived three sessions without being tested

**Symptom:** A handoff names the next task and states its cause: the detector's
`--min` is "an absolute count whose meaning shifts with window size", and
fixing it "means picking a ratio, which is another guess". The framing is
confident, specific, and had been carried forward unchallenged. It is wrong in
both halves.

**Root cause:** The diagnosis was never measured, only reasoned about. Fifteen
minutes of literature checking and two sweeps showed that minimum-revision
floors in the change-coupling literature are **absolute everywhere** — a ratio
is not the mature alternative, it is a novel mistake, and at a 30-commit window
it rounds to 1 and admits single-touch noise. The sweeps then showed `--min`
barely moves the answer at all: the top of the table is identical from 2 to 8,
across every window size. The knob described as the last rough edge was the one
doing load-bearing work — it is what keeps commit-size artefacts off the table.

**Fix:** Measure the claim before acting on it. The real defect was one level
down and invisible from the armchair: raw co-change breadth conflates
co-evolution with commit size, so a file that sat in two twenty-file commits
reports nearly forty partners. That got a reported-but-not-ranked second
number, `coupled`.

**Wrong turns:** Two plausible fixes were built up and then refuted by
evidence, both worth recording because both look obviously right on paper.
(1) *Rank on pairwise coupling strength, as CodeScene does.* It discriminates
beautifully on a 101-commit history — real roots keep half their breadth,
artefacts collapse tenfold — but it inverts the definition: a root's partners
are one-shot by nature, so under a recurrence bar a real root scores zero and a
leaf that always moves with its own test scores one. The canonical test caught
this, and the test was right. (2) *Tighten `--max-commit-size` to a percentile
of the repo's own distribution.* Attacks the artefact at its source, and does
suppress it — while dropping a genuine root out of the top five at a bound of
15 and promoting a test file at 10. A root legitimately appears in the wider
commits; that is what being a root means.

**Generalises to:** An inherited diagnosis is evidence about what the last
session believed, not about the code. It arrives with the authority of a
decision already made and the convenience of work already scoped, which is
exactly why it escapes the scrutiny a fresh claim would get. Re-derive the
cause before implementing the cure — and when a new metric breaks an existing
test, check whether the test encodes the definition before rewriting it to
pass.

### Architect is gated at the front, so a design choice found later has nowhere to go

**Symptom:** A `synapse-manager` run shipped a **deliberate breaking API change** —
removed `reset()` from two modules, changed a function's return shape, moved
state into factory functions — with no decision record and no `synapse-architect`
dispatch anywhere in the run.

**Root cause:** Not disobedience. Manager followed step 0 exactly. Step 0 says
dispatch `synapse-architect` **only** when you can name two or more approaches that
produce materially different code, and it warns explicitly against dispatching
because a task merely *sounds* significant. That judgement is made **before
planning, from the task description alone**, and manager is forbidden from
reading the codebase. At step 0 the task was "review this and fix what the
review finds" — one obvious implementation, correctly routed straight to
planning.

The structural choice did not exist yet. It emerged once the remediation was
under way and the cleanest repair turned out to break the module's public
surface. By then the only route to `synapse-architect` is tier 2 of the integration
fallback, which is reachable **only after three failed merge attempts**. This
was not a failed merge, so no route existed. The decision got made anyway, by
whoever was holding it — and that was manager, working from summaries.

**Fix:** Give `synapse-architect` a mid-flight entry point that is not gated on
failure.

*Partially applied 2026-08-25.* `synapse-manager.md` now dispatches `synapse-architect` on the
**second `REJECTED(plan)`** for a task, before its third and final attempt. Two
independent plans failing the same way is evidence step 0 missed a fork, not
evidence the planner keeps slipping — so a design choice found after planning
can now reach `synapse-architect` without waiting for three failed merges.

**That does not cover the failure above, and the gap is the interesting part.**
The run described here was never rejected at all — Reviewer returned `APPROVED`
— so a trigger that counts rejections never fires. The trigger this entry
originally proposed, *a plan or change summary that proposes altering a public
contract*, is still unbuilt, and it is the one that would have caught it.
Rejection is evidence a choice was made **badly**. It is not evidence a choice
was made **silently**, and the silent case is what this entry is about.

**Generalises to:** A one-shot gate placed where the information does not yet
exist will be answered correctly and still give the wrong outcome. The bar was
tuned against over-dispatch; the live failure was under-dispatch, and neither
is a property of the bar's height — it is a property of *when* the question
gets asked.

### Three elaborate designs in one session, each coherent, each aimed a layer too high

**Symptom:** A well-argued design survives scrutiny, gets costed, and then
collapses into something far cheaper the moment one more fact arrives. Not once
— three times in a single session.

**Root cause:** Every elaborate version was **internally coherent**, so no
consistency check could have caught it. What was wrong was the *layer* it
addressed.

- A coordination protocol for two colliding sessions — staged draft surface,
  promotion gate, design artifact frozen for the duration of a manager task —
  collapsed into a `Session:` commit trailer. The sessions never needed to
  constrain each other, only to *recognise* each other.
- A custom GUI hosting Claude Code terminals, costed at 3–6 weeks of evenings,
  dissolved against the user's own "must be optional" constraint: a watcher can
  be closed, a terminal host cannot.
- A dictation subscription, fully priced against alternatives, evaporated on
  finding `/voice` is built into the CLI.

**Fix:** None of the three shipped; the cheap version shipped in each case.

**Wrong turns:** The reflex to re-check the reasoning. All three chains of
reasoning were sound — that is precisely the point, and it is why arguing
harder about the design would not have surfaced any of them.

**Generalises to:** Coherence is not evidence of being aimed correctly. Before
costing a design, ask what the **smallest thing that changes the outcome** is,
and whether the problem even lives at the layer you are building at. The failure
mode is not sloppiness — it is a good solution to a problem one level above the
real one, which is why it survives review.

### An invariant had a test, and the test sat one layer below the violation

**Symptom:** A documented invariant is violated in shipped output while a test
suite that names that exact invariant passes clean — 19 of 19.

**Root cause:** `hot-files.mjs` deliberately sets excluded files aside rather
than dropping them: a doc that moves with every feature IS a collision point, it
just wants a different remedy. `hot-files.test.mjs` states that in a comment and
pins it — *"exclusion sets a file aside and reports it; it never silently drops
it."* But that test asserts on `analyze()`, which returns the rows correctly.
`report()` — the only thing a human ever sees — returned early whenever nothing
was rankable, discarding them on the way out.

Run against Synapse's own history with `--min 4`, the tool printed "0 files
reached 4+ commits" and "the work is already disjoint" while holding
`README.md` at 10 commits and 45 partners. The empty case was the one run where
the set-aside rows were the entire finding.

**Fix:** Export `report()` so it can be tested at all, then pin it directly —
including a test asserting the *genuinely* empty case keeps its original
message, so the bug could not be "fixed" by deleting the claim. 19 tests to 23.

**Wrong turns:** Carried across three handoffs as "one line in `report()`",
which is what kept it perpetually unscoped. It was two defects sharing one root
cause — `candidates` treated as though it were every file meeting the threshold
— and the summary line was under-reporting 2 of 13 files in the normal case too.

**Generalises to:** Ask which layer an invariant is asserted at, and whether
anything between that layer and the user can still break it. A test on a pure
function proves the pure function; the formatting, filtering and early-return
code downstream is exactly where a "never drops it" guarantee gets dropped. This
is the sharper cousin of an invariant documented with no assertion behind it —
here the assertion existed, was correct, and still missed.

### The scrub only exists because nobody asked, on day one, who would see this

**Symptom:** A project you started for yourself turns out to be worth sharing.
Now every commit carries your real name and email, the tree is full of absolute
paths from your machine, and there is no edit to any file that fixes it —
history holds all of it regardless of the working tree. Publishing is blocked
behind an operation you cannot undo if you get it wrong.

**Root cause:** Not the leak. **The absent decision.** "Will anyone else ever
see this?" is settled on the first commit whether or not it is asked, and the
default answer — the one you get by not asking — is the expensive one. Measured
here: 423 commits, single author, real name and personal email as both author
and committer on every one, plus machine paths across 39 tracked files.

**Fix:** **Build as though it will be seen, and make the exception prove
itself.** Set a publishing identity before the first commit; use placeholders
rather than absolute machine paths; keep credentials, personal directory layout
and other people's project paths out of the tree.

A default beats a decision here, because deciding requires forecasting which of
your projects will matter to anyone else, and that forecast is the thing that
just failed. The exception is narrow and recognisable by scope — a custom
command, a one-off script, a niche personal workflow — and for those the rule is
moot.

**Scope predicts both terms and they move together:** the larger a project gets,
the likelier it is worth sharing *and* the more expensive the retrofit. There is
no regime where guessing "private" on a substantial project is right.

**The rule is about secrets, not candour.** "Must never enter" and "must not
ship" are different lists: credentials and identity never enter; blunt working
notes enter freely and simply are not published. Conflating them is what makes
people think building-for-public means writing a press release.

**Wrong turns:** *"You cannot know at the start whether a project will matter to
anyone else."* True, and it is an argument for the safe default rather than
against it. The costs are wildly asymmetric — being wrong about "this might go
public" costs one `git config` and some placeholders that read better anyway;
being wrong about "this is only ever mine" costs a generated tree, an allowlist,
a verification pass, and one unnoticed mistake away from an irreversible leak.
Two options that far apart do not need judgement.

Also wrong: *"the working tree is what matters."* Scrubbing files today leaves
`git log -p` intact. Metadata is not in the tree at all.

**Generalises to:** When a decision has an unknown answer and wildly asymmetric
costs, the unknown is the reason to take the cheap-to-reverse option, not a
reason to defer. This is the same shape as an allowlist beating a denylist for
anything irreversible — you are choosing the failure you can survive, not the
outcome you predict. Applies well beyond publishing: anything where "we can
always add it later" is true and "we can always take it back later" is false.

### What degraded late in a session was not the work, it was the willingness to reject

**Symptom:** Long working sessions produce output that looks fine while it is
being produced and reads badly the next morning. Nothing in the transcript marks
where it went wrong — there is no visible drop in the quality of what arrived,
because the change was not in what arrived.

**Root cause:** **The first thing fatigue takes is the threshold for accepting
someone else's work, not the ability to do your own.** Early in a session,
proposals get pushed back on: the plausible-but-wrong answer gets noticed, the
receipt gets demanded, "that is not what I asked for" gets said. Every one of
those costs energy. Late in a session the cheapest available action is
**agreement**, and mediocre reasoning, mediocre ideas and mediocre code get
approved — not because they improved, but because declining them stopped being
affordable.

Observed first-hand across sessions running fifteen-plus hours, and the tell is
that the *prompts* degrade in step with the acceptances: shorter, vaguer, less
adversarial.

**Fix:** **Quarantine late-session output rather than trying to work less.**
Decisions made past your own line get re-read with fresh judgement before
anything is built on them. "Stop earlier" is a rule nobody keeps; "do not build
on it until tomorrow" costs one morning and needs no willpower at the moment it
matters.

**Wrong turns:** Reaching for published research on shift length and decision
fatigue to justify the rule. The direction is well supported — sustained
attention degrades on task, and long-shift studies find error rates rising
non-linearly — but the tempting specifics are not. "Ego depletion" largely
failed to replicate and the well-known parole-judge study is heavily contested,
so a confident numeric threshold would have been **an unsourced claim inside a
file whose whole purpose is claims with sources.** The first-hand observation
was the stronger evidence and did not need propping up.

Also wrong: measuring it as "was my output worse late." That is the hard thing to
see from inside. **Measure pushback frequency instead** — how often you declined
something per hour, early versus late. That is countable in a transcript.

**Generalises to:** Any review gate staffed by a human whose capacity is
declining over exactly the period the work is being produced. **This is the human
half of a reviewer approving what it should have rejected** — the same failure as
a pipeline reviewing its own work and signing it off, with a person in the seat.
It gets *worse* with more automation, not better: a pipeline that produces more
output, faster and more confidently, raises the cost of genuine review precisely
as the reviewer's ability to pay it runs out.
