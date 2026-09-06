# Verifying a Synapse install

You have cloned this repo and deployed the agents. Does any of it work?

This document is the answer to that question. It exists because it used to have
no answer — an adopter could do everything right and have no way to tell,
which is blocker 11 of `specs/2026-08-25-public-ship-boundary.md`.

## The shape of the problem

Most software verifies itself by running its tests. That does not work here,
and understanding why is most of what this document has to teach.

**Synapse's output is judgment, not values.** The question is not "does
`hasPermission` return true" — it is "did `synapse-reviewer` notice that
`hasPermission` is wrong." No assertion expresses that. A test suite can
confirm the definitions are present and syntactically valid; it cannot confirm
that an agent reading them behaves well.

So verification splits in three, and none of the splits is a compromise:

| | What it settles | Who runs it | Cost |
|---|---|---|---|
| **Mechanical** | Are the definitions valid, deployed, unshadowed? Is the fixture intact? | `scripts/verify-install.mjs` | Free, seconds |
| **Environmental** | Does your harness corrupt the files your agent writes? | Your agent, through its Bash tool — a script cannot | Free, one call |
| **Graded** | Does the pipeline actually catch what it should? | You, comparing a real run against an answer key | Real tokens, minutes |

**A clean mechanical run means the install is ready to be tested. It does not
mean the pipeline works.** Nothing in step 2 dispatches an agent.

**The middle row is the one that is easy to get wrong.** It is mechanical in
the sense that matters — the answer is a byte count, not a judgement — yet it
cannot be automated, because the defect it looks for lives in the agent's tool
path and a script does not travel that path. *Mechanical* and *script-runnable*
are not the same property, and step 2b exists because assuming they were would
produce a check that passes on a broken machine.

## Step 1 — install

```bash
node scripts/deploy-agents.mjs
```

This copies `agents/*.md` into `~/.claude/agents/`, creating it if you have
never made a subagent before. See `README.md` for prerequisites.

## Step 2 — mechanical checks

```bash
node scripts/verify-install.mjs
```

Twenty-one checks across six areas. Every one either passes or tells you the
command that fixes it. What it covers:

- **Environment** — Node 18+, `git` on PATH.
- **Agent definitions** — all seven present, each with frontmatter that will
  actually load, each `name:` matching its filename. A definition with a broken
  frontmatter block does not half-load; the agent simply does not exist, and
  you find out when a dispatch fails for reasons that look like something else.
- **Deployment** — every agent byte-identical to its deployed copy, and no
  subdirectories under `~/.claude/agents/`. That second one has bitten this
  project: files in a subdirectory register as duplicate agent names and
  *shadow* the real definitions, so edits silently do nothing.
- **Boundary hook** — the machine-wide orchestrator boundary hook is deployed
  and byte-identical to its source; whether it is registered in
  `~/.claude/settings.json` (a warn, not a fail, until you paste the fragment
  `deploy-agents.mjs` prints — see `adoption/boundary-hook.md`); and whether it
  has recorded anything yet, which is the check that would catch `$HOME` failing
  to expand on Windows.
- **Fixture integrity** — the planted defects in `toy-repos/gatekeeper` are
  still reachable.
- **Fixture suite** — the fixture's own tests pass, which proves nothing about
  the pipeline: they pass with every planted defect still live, which is
  exactly why the fixture-integrity checks above exist rather than trusting a
  green suite.

That last one reads backwards until you see the reason. The checks assert the
bugs are **still there**, because a fixture whose bugs have been fixed is
broken rather than improved — the answer key stops describing the code, and
every graded run afterwards is scored against a document that no longer
matches. If you ever see `Defect A missing`, something repaired the fixture.
Revert it.

## Step 2b — the environment probe your agent must run

Everything in step 2 runs as a Node script. **This one cannot**, and the reason
matters more than the check.

Claude Code's Bash tool passes its command string through an escape processor
before bash receives it, and on Windows that processor collapses every backslash
pair — `\\` becomes `\`. Whether it does so on *your* machine is what this step
establishes. Quoting does not protect it. Any file your agent writes with a
heredoc, `printf`, or `sed` is then **silently corrupted** wherever the content
contained backslashes: a Windows path, a regular expression, an escaped quote in
generated source. Usually nothing errors. The bad file fails later, somewhere
else, for reasons that look unrelated.

**A script cannot detect this.** When Node spawns bash it passes a real `argv`
array, so no command-line string is composed and no unescaping occurs. Add this
check to `verify-install.mjs` and it will pass on every machine, including one
where the bug is live and actively corrupting files. That green check would
assert the bug is intended — the same failure this project already recorded when
`deploy-agents.test.mjs` blessed the overwrite bug with
`test('overwrites a stale deployed copy with the repo version')`.

The probe is only meaningful **through the tool that has the defect.** Ask your
agent to run exactly this, in one Bash call:

    cat > /tmp/probe.txt <<'EOF'
    A\\\\B
    EOF
    od -c /tmp/probe.txt

Read the result:

| `od -c` shows | Meaning | What to do |
|---|---|---|
| `A \ \ \ \ B` | Four survived. Your harness is clean. | Nothing. |
| `A \ \ B` | Two. **Backslashes are being eaten.** | Instruct your agent to write file content with the `Write` tool and run it from Bash. |

If you get the second result, put the rule somewhere that loads every session —
`~/.claude/CLAUDE.md` is the natural home, and it outranks any session
instruction telling the agent to prefer `sed` and heredocs over the dedicated
file tools. That instruction is the one that walks into this.

**What is known, as of 2026-08-26:** the defect is **Windows-only**. The same
probe at the same Claude Code version (2.1.220) collapses on Windows with Git
Bash and passes clean on Ubuntu 26.04 under WSL 2. **macOS is still untested**,
so if you are on a Mac you have the answer nobody here has — `docs/LESSONS.md`
holds the full diagnosis and four cleared suspects, including why the obvious
Windows-argv-parsing explanation is ruled out by signature.

**Run it anyway even on a platform we have measured.** The scope above is a
statement about two harnesses on one machine on one day, not a guarantee about
yours. It costs one Bash call, and a wrong assumption here corrupts files
silently rather than failing.


## Step 3 — the unit tests

```bash
node --test scripts/*.test.mjs
```

The glob is deliberate: naming the files individually meant the command went
stale every time a script was added, and silently ran an incomplete suite.
These cover the scripts and the verifier itself. They say nothing about
the agents.

**Do not read `toy-repos/gatekeeper`'s own suite as a signal.** It passes — 5
tests, 0 failures — with every planted defect live. That is deliberate and it
is the single most useful thing the fixture demonstrates: **a green suite is
not evidence the code is sound.** If a passing test run were sufficient, the
gate would not need to exist.

## Step 4 — the graded run

This is the actual verification, and it is a human step. It costs real tokens
and takes minutes.

### Set up a disposable copy

`toy-repos/gatekeeper` has no `.git` of its own and lives inside this
repository, which a Synapse session must not let agents write to. Copy it
somewhere scratch and give it a history:

```bash
cp -r toy-repos/gatekeeper /tmp/gatekeeper-run
cd /tmp/gatekeeper-run
git init && git add -A && git commit -m "initial"
```

`synapse-coder` needs somewhere it can actually write, and `synapse-reviewer` reads a diff.

### Give the task without naming the defects

Open a pipeline session in that copy:

```bash
cd /tmp/gatekeeper-run
claude --agent synapse-manager
```

Then hand it a task in the shape a real one arrives in. The recorded exercise
used:

> this is due to ship, get it reviewed for security and test quality and get
> what turns up fixed

**Do not name the bugs, do not paste the answer key, and do not let the session
read `docs/toy-repos/`.** A fixture that tells you its own answers measures
nothing. This is also why the key lives outside the fixture in the first place.

### Score it

Open `docs/toy-repos/gatekeeper.md` — *after* the run, not before. It lists six
defects (A–F), what class each belongs to, which brief should catch it, and
what a good finding looks like as opposed to a vague one. It also records what
previous runs found, so you can see whether behaviour has moved.

Read the scoring table in that file's *What a run is actually measuring*
section. In short:

| Outcome | Reading |
|---|---|
| `APPROVED`, no findings | The gate is not working. |
| Findings, but only the shallow-test one | Reviewer is checking form, not behaviour. |
| A or B found, C missed | Expected early. C is the subtlest. |
| A, B, C, D under the right briefs | The pipeline is doing what it claims. |

A good run does not just find the bugs — it **names the mechanism**. "Wildcard
matching looks loose" is a miss; the defect is that the match never requires
the `:` delimiter, and a review that does not reach the delimiter has not
understood it.

## What this still does not verify

Stated plainly, because a verification document that oversells itself is worse
than none:

- **`synapse-architect`'s decline path is untested.**
  `docs/toy-repos/gatekeeper-architect.md` carries three scenarios against the
  same toy — a genuine fork, a task with no fork that architect should decline,
  and one that tests whether it stops at the decision instead of planning. All
  three were run on 2026-08-26 and the record is in that file. Two of them
  exercise architect directly and it passed both at 8/8.
  **The middle one never reached it:** manager declined to dispatch architect
  at all, which the key counts as a pass, but that measures manager's routing
  rather than architect's own willingness to decline. Whether architect returns
  "this needs no decision" when asked directly is still unmeasured.
- **`synapse-art-director` and `synapse-artist` have no fixture** and are not cheap to give
  one — every run spends PixelLab credits against a paid subscription. They are
  excluded from a public default anyway.
- **Manager's exceptional branches are untested on purpose.** A second
  plan-level rejection, three failed integration attempts — these cannot be
  provoked by planting a bug, so a fixture run traverses the happy path and
  never reaches them. `toy-repos/README.md` argues this at length. Read those
  paths; let live use find them.
- **One fixture is one sample.** It grades the pipeline against four planted
  defects in four small files. It does not tell you how the agents behave on a
  large codebase, an unfamiliar language, or a task with no defect in it at
  all.

## When to re-run

The mechanical checks are cheap; run them whenever something feels off, and
after any deploy.

The graded run is expensive, so run it when the pipeline's **judgment** may
have moved — a change to `synapse-reviewer.md` or a brief, a change to `synapse-planner.md` or
`synapse-coder.md` that alters output quality rather than format, or periodically with
nothing changed at all. That last case is the one people skip and the one most
worth keeping: behaviour can move under a fixed definition when the underlying
model changes, and a run against a known key is the only way you will see it.

`toy-repos/README.md` has the full argument, including why "verify a recent
change" is the wrong trigger — that framing left a fixture run carried across
three handoffs without a single execution, because no change ever looks big
enough when size was never the right test.
