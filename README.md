# Synapse

A multi-agent development pipeline for Claude Code, plus the design work behind
it.

**The agents are portable; the repo is not yet a product.** Five agent
definitions ship in `agents/` — prose referencing no project-specific code —
plus two art-production agents that are not included (see the table below).
`docs/LESSONS.md` is written to carry. The packaging around them is closing but
unfinished — most of the docs were still written for one reader.

**This repo ships its mistakes on purpose.** The specs, experiments and
lessons include wrong decisions, bad prompts and rejected approaches — sitting
right next to the ones that worked. That is deliberate. The pipeline is useful,
but the thinking that produced it is the part worth studying, and thinking
includes being wrong. If you find a spec that contradicts itself or a prompt
that produced garbage, that is not a file someone forgot to clean up — it is
probably one of the more useful things in here.

**New here?** `docs/OVERVIEW.md` is the comprehensive explanation — what this
is for, the three ideas behind it, what is settled and what is left. This file
is the reference card.

**Who this assumes you are.** Comfortable navigating a filesystem from a
terminal — making folders, moving files, running a command in the right
directory. **New to AI is fine**; that half is what this is about. The computer
half it does not teach, and no step here starts with "open a terminal."

> **You are ready for something like this when you have already lost context
> between sessions and felt it cost you.**

**Process arrives after the pain.** If that sentence does not describe something
that has actually happened to you, a pipeline like this reads as ceremony —
because for you, right now, it would be.

## What this is

A studio of specialist subagents that plan, implement, review, and produce art
for a software project, coordinated so that **many work streams can run at once
without colliding**.

The pipeline is serial: one task at a time, [architect →] planner → coder →
reviewer. The architect step is optional. It runs up front when a task admits
two or more structurally different approaches, and it can also be pulled in
mid-flight if the same plan gets rejected twice — repeated plan-level failure
is evidence of a missed fork, not a one-off planning mistake.
Making it parallel turned out to depend on the *codebase* being splittable, not
on better orchestration — see `docs/OVERVIEW.md`.

## Getting started

**Prerequisites.**

- **Node.js 20 or newer — on every platform.** Check with `node --version`.
  Every script here is an `.mjs` file, so Node is required on Linux and macOS
  exactly as much as on Windows; without it nothing in this repo runs at all.
  What differs by platform is only whether you already have it. Windows
  essentially never ships it. macOS does not either, though dev machines
  usually have it via Homebrew or nvm. Most Linux distributions are one
  package-manager command away. **If you hit this, you are most likely on
  Windows — but do not read that as "Linux and macOS do not need it."**

  If `node --version` prints `command not found`, install the LTS build from
  [nodejs.org](https://nodejs.org), or just ask Claude Code to install it for
  you — that works, and it is how more than one person here got started.

  Node 20 is the floor because the test suite uses the built-in `node --test`
  runner. Deploying the agents alone will run on something older; there is no
  reason to.

  One thing that muddies this: **if you installed Claude Code with
  `npm install -g @anthropic-ai/claude-code`, you already have Node**, because
  npm is part of it. If you used the native installer instead, you may not.
  That is why some people never notice this requirement and others hit it on
  the first command.

- **Claude Code**, and **model access matching what the agents pin** — see the
  table below. Four of the five shipped agents pin `claude-opus-5`; without
  Opus access those agents may not resolve.

Beyond Node itself, the agent pipeline has **no dependencies** — no root
`package.json`, no install step, nothing to download.

**Optional companions — not required, and recommended anyway.** Synapse was
built alongside two other projects, and neither is needed to run it:

- **[superpowers](https://github.com/obra/superpowers)** (Jesse Vincent, MIT) —
  a skill library. Nothing of it ships here, but the way this project works
  came out of working under it: brainstorming before building, verification
  before claiming completion, surfacing assumptions and discharging them with
  evidence. `synapse-planner` and `synapse-architect` also write plans and
  decision records into its `docs/superpowers/` convention, so the two share a
  layout rather than fragmenting.
- **[ECC](https://ecc.tools)** (Affaan Mustafa, MIT) — a large operator layer:
  68 agents, skills, hooks and rules. Synapse is a much smaller and more
  opinionated thing than ECC and does not try to cover the same ground. If you
  want breadth rather than one deliberately narrow pipeline, look there.

`NOTICE.md` records exactly what Synapse owes each of them, including one
passage that was copied from ECC and has since been rewritten.

**Just want the pipeline?** If you do not care about the specs, lessons, or
teaching material and just want the agents working on your machine:

```bash
git clone https://github.com/kedwards9/Synapse_Pipeline.git
cd Synapse_Pipeline
node scripts/deploy-agents.mjs
```

That copies five agent definitions into `~/.claude/agents/`, and you are done.
Go to any project directory and run `claude --agent synapse-manager`. You can
delete the clone afterward — the agents live in `~/.claude/agents/` now, not
in the repo. Re-clone later if you want to update them.

**Full install.** If you want the design work too — the specs, the lessons,
the experiments, the evidence — keep the clone. The deploy command is the same:

```bash
node scripts/deploy-agents.mjs
```

The script creates `~/.claude/agents/` if you have never made a subagent
before, so this works on a machine that has never run a Claude Code subagent.

**Portability status, stated honestly:** the script is written against
platform-neutral Node APIs and is intended to run the same on Windows, macOS
and Linux. Choosing portable APIs is not the same as having run it, so here is
where each platform actually stands:

- **Windows — executed.** Every script here has been run on Windows 11 with
  Git Bash. This is the author's daily platform and the only one with real
  mileage.
- **Linux — executed under WSL 2.** Ubuntu 26.04 LTS, kernel
  `6.18.33.2-microsoft-standard-WSL2`, Node 22.22.1. The full test suite passes
  59/59, `deploy-agents.mjs` created `~/.claude/agents` and deployed all five
  shipped definitions, and `verify-install.mjs` passed all 21 checks. **Two limits on
  that claim, stated rather than buried.** WSL is a real Linux kernel but not a
  bare-metal install. And the repo was read across the `/mnt/e` mount, which is
  `v9fs` and case-insensitive — so the case hazard named under macOS below went
  unexercised on the *source* side. The deploy target was ext4 and
  case-sensitive, so the ownership-manifest matching itself did run against a
  case-sensitive filesystem.
- **macOS — untested, and not on the roadmap.** The author does not own or use
  a Mac, and macOS cannot be legally virtualised on non-Apple hardware, so
  there is no honest way to test it here. The code has no deliberate Windows
  dependency and there is no known reason it would fail — but **nobody has run
  it, and this project will not claim otherwise.** One platform-specific risk
  is worth naming for anyone who does try: macOS filesystems are
  case-insensitive by default, and `deploy-agents.mjs` matches agent filenames
  against an ownership manifest. `synapse-coder.md` and `Synapse-Coder.md` are
  two files on Linux and one on macOS.

If you are on macOS or Linux and it misbehaves, **that is a real bug and not
your setup.** Please say so — a bug report from a platform nobody here can run
is worth more than a guess. See `docs/COLD-START.md`.

**Check it.** Before running anything, confirm the install took:

```bash
node scripts/verify-install.mjs
```

Twenty-one checks — definitions valid and deployed, nothing shadowing them,
the machine-wide boundary hook deployed and (once you paste the fragment)
registered and recording, the test fixture intact. A clean run means the
install is **ready to be tested**,
not that the pipeline works; nothing in it dispatches an agent. Confirming that
the pipeline exercises judgment correctly is a graded run against an answer
key, and `docs/VERIFYING.md` is the procedure.

**Run it.** The pipeline has exactly one entry point, and it is launched from
the repository you want to work in — not from this one:

```bash
cd <your-project>
claude --agent synapse-manager
```

Then hand `synapse-manager` a task in plain language. It picks a path, dispatches
`synapse-architect` (when the task admits competing approaches), then
`synapse-planner`, `synapse-coder` and `synapse-reviewer` in turn, and reports
back. **You never dispatch the other four yourself** — each refuses standalone
dispatch by design, because it expects context only `synapse-manager` holds.

**Restart after every deploy.** Agent definitions load at session start, so a
running session keeps using the old text. `/clear` is not enough; exit the
process.

## How I actually use this

The pipeline is the execution half — it plans, codes and reviews. **The
thinking that feeds it happens before Manager is ever launched**, and that
half is where most of the work is.

A typical cycle:

1. **Brainstorm the problem.** I use superpowers' `brainstorming` skill for
   this — it structures the conversation so assumptions surface before
   decisions get made. The output is a design direction, not a plan.
2. **Write a spec or design record.** A short document that says what to
   build, why, and what the acceptance criteria are. This is the thing Manager
   dispatches from, so it has to be specific enough that an agent can act on it
   without asking you questions.
3. **Dispatch Manager** with a prompt pointing at the spec. Manager picks
   planner → coder → reviewer and runs the cycle. If the reviewer rejects,
   Manager re-dispatches — you do not have to intervene unless the rejection is
   a plan-level problem.
4. **Merge the result, verify what agents cannot.** The pipeline proves the
   code builds and passes tests. Whether the feature actually works the way you
   intended is still yours.

**The brainstorming step is not inside the pipeline on purpose.** Design
thinking benefits from a conversation — pushing back, changing direction,
exploring trade-offs out loud. That is a different mode from "execute this
plan," and mixing the two into one agent makes both worse. superpowers handles
it well; so does a plain conversation with no skill at all. The point is that
it happens, not which tool does it.

**You do not have to use superpowers or ECC to use Synapse.** They are what I
happened to be running. The pipeline's only real input is a spec and a prompt —
how you arrive at those is your business.

## Layout

```
agents/              Agent definitions -- THE SOURCE OF TRUTH
specs/               Design specs
plans/               Implementation plans (point-in-time; stale by design)
scripts/             Deployment, analysis, instrumentation and commit tooling
adoption/            Prompts a consumer repo runs to adopt a Synapse pattern
adoption/boundary-hook.md  Machine-wide install for the orchestrator boundary
                     hook -- a one-time paste into ~/.claude/settings.json,
                     not a per-repo prompt like the rest of adoption/.
docs/OVERVIEW.md     What this is, the three ideas behind it, what is settled
docs/VERIFYING.md    How to confirm an install works. Start here if unsure.
docs/COLD-START.md   How to test whether a stranger could use this at all.
docs/LESSONS.md      Hard-won fixes. Grep this when something breaks.
docs/writing/        Prompt transcripts, teaching material, failure analyses
docs/experiments/    Graded pipeline runs with scored results
LICENSE              MIT.
NOTICE.md            Third-party attributions. What this owes other people.
CONTEXT.md           Canonical vocabulary for this project.
```

**Session handoffs.** The author uses two slash commands — `/takehandoff`
(resume a prior session) and `/session-hand-off` (write a continuity entry) —
to carry context across sessions. They are not included in this release because
they are general-purpose tools, not pipeline-specific, and will ship separately.
If you are interested in them, they are described in
`specs/2026-08-30-handoff-commands-ship.md`.

## Agents

| Agent | Role | Model | Effort |
|---|---|---|---|
| `synapse-manager` | Routes work to the others. Never reads code or produces art. | claude-opus-5 | medium |
| `synapse-architect` | Chooses between structurally different approaches; writes a decision record. Never plans or codes. | claude-opus-5 | high |
| `synapse-planner` | Produces step-by-step implementation plans. Read-only. | claude-opus-5 | high |
| `synapse-coder` | Implements an approved plan. | claude-sonnet-5 | high |
| `synapse-reviewer` | The gate. The only agent that reads code to judge it. Takes `security` / `tests` briefs. | claude-opus-5 | high |
| `synapse-art-director` | *(not shipped — see below)* Owns art style and reference exemplars; reviews assets. | claude-sonnet-5 | medium |
| `synapse-artist` | *(not shipped — see below)* Generates assets via PixelLab. | claude-sonnet-5 | low |

**The art agents are not included in this release.** `synapse-art-director`
and `synapse-artist` depend on [PixelLab](https://pixellab.ai), a paid
third-party pixel art service. They are too narrow to ship as part of a
general-purpose pipeline — most people adopting Synapse will not be using
PixelLab, and agents that cannot run are not useful defaults. They are listed
here because they are part of the full pipeline as the author uses it, and
their definitions exist in the source repository if you do use PixelLab and
want to add them.

Effort levels are set explicitly rather than inherited. Subagents do **not**
inherit `effortLevel` from `settings.json`; they inherit the *session's* effort
unless their own frontmatter overrides it.

**What a task costs.** The pipeline is deliberately model-heavy and nothing
here is free. A single task can run architect (Opus/high) → planner (Opus/high)
→ coder (Sonnet/high) → reviewer (Opus/high), all beneath an Opus manager —
four to five high-effort invocations for one unit of work, more if the reviewer
rejects and a round repeats. **No cheaper profile ships today.** If that is not
the trade you want, edit the `model:` and `effort:` lines in `agents/*.md`
directly; they are the only place those values are set.

**Real numbers from four pipeline runs** building a game server's client
launcher (C# executable, Python publish scripts, SQL migrations, PowerShell
acceptance tests):

| Run | What it built | Output | Cache Read | Cache Create |
|---|---|---|---|---|
| Launcher | Ground-up client updater with payload sync, file diffing, backup-before-overwrite, and a 9-test acceptance harness. ~12–15 hours of wall-clock time. | 215k | 177M | 4.7M |
| Rogue kit | Three SQL migrations (placeholder pool, class kit, quest script) for an EQ server. | 123k | 67M | 2.2M |
| Hardening | Deferred findings and test harness fixes across existing publish and acceptance code. | 71k | 16M | 0.8M |
| GlobalLoad | Ninth payload file: manifest entry, publish subdirectory handling, launcher sync, acceptance update, plus an empty-file preflight guard the reviewer caught mid-run. | 88k | 20M | 0.8M |
| **Total** | | **498k** | **281M** | **8.5M** |

Cache reads dominate — 281M tokens. That is the prompt cache working: each
agent in the chain inherits cached context rather than rebuilding it from
scratch. Without caching, input costs would be roughly 30× higher.

At API rates the total lands in the **$300–400 range** (the launcher and
rogue kit ran mostly Opus 5; hardening and GlobalLoad ran mostly Sonnet 5).
The launcher alone was roughly half of that. Focused tasks on existing code
— the hardening and GlobalLoad runs — cost **$50–75 each**, which is closer
to what a typical single dispatch costs.

## Deploying agent changes

This repo is the source of truth. Claude Code loads agents from
`~/.claude/agents/`, so changes must be copied there:

```bash
node scripts/deploy-agents.mjs            # deploy
node scripts/deploy-agents.mjs --check    # report drift, write nothing
node --test scripts/deploy-agents.test.mjs
```

One implementation, all three platforms. It replaced a PowerShell-only script
that left macOS and Linux with no path at all; a second parallel script was
considered and rejected, because two copies of one algorithm is how that gap
appeared in the first place.

**Deploy will not overwrite an agent it did not put there.** It keeps an
ownership manifest at `~/.claude/.synapse-deployed.json` and refuses anything
absent from it, exiting non-zero and naming the files. If you already have an
agent whose name collides, nothing is written to it — move it aside, or pass
`--force` to overwrite it deliberately. `--prune` removes files Synapse
deployed under names `agents/` no longer uses.

This exists because the agents used to be called `coder`, `planner` and
`reviewer`, and deploying them destroyed anything you had under those names
while printing `updated: coder.md`. They are namespaced `synapse-*` now, which
makes a collision unlikely — the guard is what makes it harmless.

**Two things that will bite you:**

Agent definitions and MCP servers load at **session start**. A deploy does not
affect a running session — restart it.

**Never put subdirectories under `~/.claude/agents/`.** Files in them register
as duplicate agent names and *shadow* the real definitions, so edits silently
do nothing. This cost hours once. The deploy script warns if it finds any.

## Finding composition roots

`hot-files.mjs` reports the files that are becoming composition roots -- the
ones that change *alongside everything else* and so defeat parallel work. It
reads git history only, so it runs against any repository with no setup.

```bash
node scripts/hot-files.mjs --repo "<path-to-your-repo>"
node scripts/hot-files.mjs --help
node --test scripts/hot-files.test.mjs
```

Docs and lockfiles are excluded from the ranking by default -- they co-change
with everything but no registry fixes them -- and are listed below the table
rather than dropped. `--exclude <regex>` adds patterns, `--no-default-excludes`
ranks everything.

Ranked by co-change breadth, not by commit count -- see
`specs/composition-root-seams-pattern.md` for why breadth is the signal.

## Design specs

- **`specs/2026-08-23-stream-orchestration-design.md`** — **superseded in part.**
  Designed a custom parallel-orchestration layer; §17 records why it was
  abandoned in favour of Claude Code’s own primitives (worktrees, dynamic
  workflows, agent teams) and why the existing Manager was kept. Read §17
  first. The problem statement and the seams dependency still stand.
- **`specs/composition-root-seams-pattern.md`** — the prerequisite. Composition
  roots become append-only registries so that streams can actually be disjoint.
  Without it, every stream collides and the orchestration serialises everything.

Read the seams pattern first. It is a dependency, not a companion.

## Lessons

`docs/LESSONS.md` records problems that took a long time to diagnose, needed a
non-obvious workaround, or were solved only after several wrong turns. Entries
lead with the **symptom** — what you would actually search for when something
breaks — and end with what the lesson **generalises to**, which is what makes
the file worth carrying to another project.

The bar is deliberately high: a bug that took ten minutes does not belong
there. Silent failures always do.

**Add to it when you spend a day on something.** That is the moment the
knowledge is most complete and least likely to survive otherwise.

## Status

The pipeline in `agents/` is the current serial version and is in use. The
orchestration spec is **superseded in part** — its §§3-10 will not be built.
The seams pattern is a **draft with one piece built**: `hot-files.mjs` detects
where seams are needed; no seam has been applied yet.

For the full picture, read `docs/OVERVIEW.md`.
