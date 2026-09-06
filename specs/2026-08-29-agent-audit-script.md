# `scripts/agent-audit.mjs` — the agent definitions check themselves

**Date:** 2026-08-29
**Status:** design record, ready to implement
**Covers:** a new script and its test. No agent definition changes.
**Sibling:** `specs/2026-08-29-queue-audit-script.md` — same shape, different subject.

---

## 1. The rule already exists and nothing performs it

`CLAUDE.md`, in *Nothing half-built ships in an agent definition*:

> **Audit mechanically, not by reading: parse each `tools:` line and check every grant against its
> own body.**

**Nothing does this.** There are seven tested modules under `scripts/` and none reads `agents/`
for correctness. `deploy-agents.test.mjs` tests the *deployer* — that files copy, that the manifest
guard refuses to overwrite what it did not deploy — never what it deploys.

## 2. Two defects, both surviving since the file was written, both found by hand in one day

On 2026-08-29 two adversarial audits read `agents/synapse-manager.md` and each found a contradiction
between what Manager is **instructed to run** and what its own allow-list **permits**. Manager's
allow-list is introduced as:

> Allowed, and the only commands you may run unprompted:

**Finding 1 — an omission.** Manager is instructed to run `git hash-object <path>` as step 1's
fingerprint. `hash-object` appears nowhere in the allow-list.

**Finding 2 — an explicit prohibition, which is worse.** Manager is instructed to run
`head -1 <path> | grep -c "synapse-pipeline-artifact"` for the provenance check. The forbidden list
reads: *"`cat`, **`head`**, `tail`, `less`, **`grep`**, `sed`, `awk`, `find`, `ls` of source trees …
and **any pipe** or redirect whose effect is to print file contents."* **Three forbidden elements in
one instructed command.**

**Neither was ever caught by review, and both are trivially mechanical.** That gap is the whole case
for this script — the same case `scripts/commit-task.mjs` already made for itself: *"it exists so
the mechanical half stops being re-derived by a model on every invocation."*

## 3. The parse surface, measured rather than assumed

Seven agent definitions, all with a `tools:` line in YAML frontmatter. **Only `synapse-manager` has
an explicit allow-list or forbidden list** — verified by grepping for their introducing sentences.

Manager's command surface is small enough to parse reliably. Counted: **14 four-space-indented
command lines in the whole file.**

| Lines | Role |
|---|---|
| 5 | **instructed commands** — what Manager is told to run |
| 8 | **the allow-list block** |
| 1 | `git push`, under its own consent-gated heading |

The five instructed commands are the test data, and between them they contain **every case the
script must distinguish**:

    git rev-parse HEAD                      -> exact allow-list match          PASS
    git hash-object <path>                  -> subcommand absent entirely      FAIL
    head -1 <path> | grep -c "..."          -> forbidden tokens                FAIL
    git status --short -- <path>            -> allowed form plus a pathspec    PASS
    git log -1 --format='...' -- <path>     -> subcommand allowed, form differs WARN

**That last row is the design's whole difficulty**, and it is why this is report-only.

## 4. Decisions

### Decision 1 — three tiers, and only the unambiguous ones fail

Reusing `verify-install.mjs`'s existing contract — `pass` / `fail` / `warn`, only `fail` affecting
the exit code.

| Tier | Condition | Why it is safe to be certain |
|---|---|---|
| **fail** | An instructed command contains a token the same file's forbidden list names | The file contradicts itself in its own vocabulary. No judgement. |
| **fail** | An instructed `git <sub>` whose `<sub>` appears in **no** allow-list entry | `hash-object` is nowhere. No reading required. |
| **warn** | `<sub>` is allowed but the exact invocation differs | `git log -1 --format=… -- <path>` is covered by prose, not by the literal list. A human judges. |

**Exact matching alone would produce false positives** — `git status --short -- <path>` is plainly
fine and is not literally in the list. **Family matching alone would produce false negatives** — it
would pass `git log -p`, which the file forbids by name. The tiers exist because neither rule works
on its own, and collapsing them would make the script either noisy or useless.

### Decision 2 — the universal check is grant-versus-body, and it is the one that runs on all seven

For every agent: **every entry in `tools:` must appear somewhere in that agent's body.** A grant the
body never mentions is the "emitted field nothing read" failure `CLAUDE.md` makes a hard rule about,
and it is exactly how Manager's dead PixelLab grants were found.

**`Agent(a, b, c)` grants expand to their members** — a grant of `Agent(synapse-coder)` is satisfied
by the body naming `synapse-coder`, not by the literal string `Agent(`.

**`warn`, not `fail`.** `CLAUDE.md` explicitly protects the deliberate case: *"When a capability is
deliberate but not yet exercised, say so in the agent's own body."* A tool named only in such a
sentence still appears in the body, so it passes — but the boundary is a judgement the script
should surface, not settle.

> **Corrected during implementation — this decision was too literal, and the first real run proved
> it.** As specced, the match was exact and case-sensitive. Against the real `agents/` it produced
> **63 warnings and 2 failures**, burying the failures — which violates this project's own rule that
> *a gate that fires on every run is a gate nobody reads.*
>
> **Every one of the 63 was a false positive.** `synapse-artist` names "PixelLab" twelve times
> without enumerating each of its 34 granted tools; `synapse-coder` describes reading and editing in
> lowercase prose. `CLAUDE.md` asks for *"a path by which it gets used"*, and a body saying "read the
> plan" **is** the path for `Read`.
>
> **So the match loosened twice:** an MCP grant is grounded by its **server** name
> (`mcp__pixellab__*` ← "PixelLab"), and everything else matches case-insensitively.
> **63 warnings became 7.** Two corrections an audit made to this paragraph:
>
> **"Every one of the 63 was a false positive" is off by one.** It was 62 `ungrounded-grant` plus
> one `form-differs` — and that one, `git log -1 --format=… -- <path>`, is a legitimate finding
> that survives into the 7 and is §6's own open question.
>
> **And the flagship example was wrong.** This said `synapse-coder` "holds `Bash` and never names
> it, which is precisely the ungrounded grant this rule exists to catch." Coder's body says
> *"Commit after each completed task, once that task's tests pass"* and *"Never run `git add -A`"*.
> **Committing is impossible without Bash — the path by which it gets used plainly exists**, and
> `CLAUDE.md`'s test is that path, not the literal token. It is a naming gap, not a half-built
> grant. The warning is still worth having; the characterisation was not.
>
> **The script found the defect in its own design on its first run.** That is the argument for
> building it, made by the thing itself.

### Decision 3 — report-only, no `--fix`, and it never edits an agent

Same discipline as `queue-audit.mjs`. The script reads `agents/*.md` and prints. **It has no write
path.** An agent definition is prose whose wording is load-bearing; a script that rewrote one would
be making an editorial judgement it cannot make.

### Decision 4 — it takes the agents directory as an argument, defaulting to `agents/`

So it can be pointed at `~/.claude/agents/` to audit what is **deployed** rather than what is
committed. Those differ whenever someone has edited without running `deploy-agents.mjs`, and that
divergence is worth being able to see. **It does not check deployment sync itself** —
`verify-install.mjs` already does.

## 5. What it must not do

- **Not judge prose.** It cannot tell whether a rule is *wise*, only whether the file agrees with
  itself.
- **Not infer intent.** A tool mentioned once in a sentence saying "never use this" satisfies the
  body check. That is a `warn` at most, and the wording is a human's call.
- **No `--fix`, no rewriting, no deleting a grant it thinks is dead.**
- **Not gate a dispatch.** It is a check you run, like `verify-install.mjs`, not a hook.

## 6. Open, not decided here

- **Whether the `warn` tier should eventually harden.** If `git log -1 --format=… -- <path>` is
  meant to be covered, the allow-list could name the family explicitly and the warn would clear. The
  script would then be reporting a real gap in the allow-list rather than a parsing limitation. Not
  decided, because it changes an agent definition and this record changes none.
- **Whether other agents should grow allow-lists.** Only Manager has one. Coder and Reviewer both
  hold `Bash` with no enumerated limit. That may be correct — they are supposed to run tests — but
  nobody has argued it either way.
- **Whether this belongs in `verify-install.mjs` instead of its own script.** It is adjacent, and
  `verify-install` already owns the pass/fail/warn vocabulary. Kept separate because
  `verify-install` answers *"is the install ready"* and this answers *"do the definitions cohere"*,
  and one script that answers two questions reports neither cleanly.

## 7. Test cases the suite must gain

Fixture-driven — crafted agent files, not the real ones, so the tests do not break every time an
agent is edited.

| # | Case | Expect |
|---|---|---|
| 1 | Instructed command uses a token the forbidden list names | **fail** |
| 2 | Instructed `git <sub>` whose subcommand is in no allow-list entry | **fail** |
| 3 | Instructed command exactly matching an allow-list entry | pass |
| 4 | Allowed subcommand, different flags | **warn** |
| 5 | Allowed subcommand plus a trailing pathspec (`-- <path>`) | pass |
| 6 | Agent with a `tools:` grant never mentioned in the body | **warn** |
| 7 | `Agent(a, b)` grant where the body names `a` and `b` | pass |
| 8 | `Agent(a, b)` grant where the body names neither | **warn** |
| 9 | Agent with no allow-list at all — the six non-Manager agents | grant check only, no command findings |
| 10 | The consent-gated `git push` block is not read as an instruction | pass |
| 11 | Empty agents directory | clean exit, not a crash |
| 12 | An agent file with no `tools:` line | reported, not a crash |
| 13 | **Run against the real `agents/` — the two known defects appear** | 2 fails |

Case 13 is the acceptance test and it is the reason to build this. It must find
`git hash-object` and the `head | grep` pipe, by name.

## 8. Consequences

- One new script, one new test file. `scripts/` goes from seven tested modules to eight.
- **It will fail on the repository as it stands**, and that is correct — the two defects are real
  and unfixed. Fixing them is a separate change to `agents/synapse-manager.md`, and this record
  deliberately does not make it: the script's first real run should find something, or nobody
  learns whether it works.
- It makes pipeline-definition changes reviewable. Today `synapse-reviewer` reading a change to
  `synapse-manager.md` has nothing objective to check, which is the argument for keeping such
  changes out of the pipeline. **With this script there is something to check.**


---

## 9. What the first audit of this script found, and what it changed

A fresh-context agent audited the implementation on 2026-08-29 and it did not go well, which is the
point of running one.

**Three fail-opens, all closed.** Bolding a single word in Manager's allow-list intro made the
allow-list unrecognisable: **both real defects vanished and the script exited 0 in silence.** A code
comment had claimed the prefix match prevented exactly this. It did not. A typo in the directory
argument reported "0 failing" and exited clean. And the forbidden-token regex lacked the `m` flag,
so `^` anchored to the start of the whole body and a mid-document *"Forbidden, without exception:"*
paragraph never matched — **silently disabling the entire forbidden-token check.**

Remedies: intro matching loosened to the load-bearing words in any order; an explicit
`allowlist-unparsed` **failure** when a body talks about allowed commands and no allow-list block was
recognised; an unreadable directory is now a failure; the `m` flag added, with a comment saying why.

**The classifier inverted in both directions, and now cannot.** A running `mode` meant a second
allow-list block after intervening prose was audited as instructions — fabricating failures on
permitted entries — while an instructed command sitting between an intro and its block was absorbed
**as** the allow-list, where the forbidden-token check never runs. Replaced with block-based
classification: group indented lines into blocks, then classify each by the prose immediately above
it.

**The tests did not protect any of this.** Mutating `classifyCommands` to return everything as an
instruction left **15 of 19 tests passing**, because they asserted the *absence* of findings and
absence is exactly what a gutted classifier produces. The suite now asserts the buckets directly and
the same mutation kills **8 of 28**.

**Known misses, kept and disclosed rather than fixed.** It reads four-space-indented command lines
only: fenced blocks, inline backticked commands, six-space or tab indents, backslash continuations,
and env-var-prefixed lines are invisible. **The footer now says so on every run**, because the
earlier footer claimed *"no instructed command is absent from or forbidden by that agent's own
allow-list"*, which overstated coverage. Closing those holes is a later change; claiming they are
closed would be the false green this script exists to prevent.
