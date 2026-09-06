# Cold-start testing

A cold-start test asks one question: **can someone who has never seen Synapse
get one task through the pipeline using only what ships with it?**

It exists because `specs/2026-08-25-public-ship-boundary.md` blocker 3 —
the launch command appearing nowhere a reader would look — was invisible from
inside the project for weeks. Not because nobody checked, but because
**everyone who could check already knew the answer.** No amount of careful
re-reading finds that class of gap. Only a reader without the knowledge does.

## Two failure classes, two instruments

Conflating these is what makes cold-start testing look like a weekend of work.
It is mostly not.

| Class | Symptom | Needs | Does *not* need |
|---|---|---|---|
| **Comprehension** | "I read everything and still cannot start it" | a reader with no prior context | a clean machine |
| **Environment** | "the script threw", "Node was missing", "broke on Linux" | a clean machine | a fresh mind |

**Blocker 3 was comprehension.** So was every gap of that shape found since.
The comprehension half is nearly free and can run today; the environment half
wants WSL or a container and settles a different, narrower question.

A VM you run yourself tests environment and **fails at comprehension**, because
you cannot un-know the launch command. That is the instrument most people reach
for first and it covers the class they least need covered.

Note also that most of what a VM tests is not Synapse's surface. Installing
Node and installing Claude Code are upstream. Synapse's surface begins at
"clone it."

## The generous-reader problem

The obvious instrument for the comprehension half is an agent with no context.
It is the right instrument, but it has a bias that will quietly ruin the result
if it is not designed against.

**An agent is a far more generous reader than a human.** It can grep every file
in the repo in two seconds and infer past a gap that would stop a person cold.
Turned loose, a context-free agent would very likely have found `claude --agent
manager` inside `synapse-manager.md`'s YAML frontmatter, started the pipeline, reported
success — and blocker 3 would still be open.

The mitigation is a **two-phase rule**, and it is the core of the brief below:

1. **Follow the documented path only.** Start at `README.md`; read only what it
   points you to. No repo-wide search.
2. **When you stall, log the stall first — then search.** Record what you were
   looking for and where you looked *before* looking anywhere else.

This buys two distinct findings from one run:

- **Phase 1 stalling** answers *would a human stall here?* — the real question.
- **Phase 2 searching** answers *is the information present at all?*, which
  separates "undiscoverable" from "absent" and decides whether the fix is a
  pointer or new prose.

A stall that phase 2 resolves from a stale plan file or an agent's frontmatter
is still a finding. It means the information exists somewhere no reader would
look, which is exactly what blocker 3 was.

## The stall log

Findings need a comparable home, the way `docs/toy-repos/gatekeeper.md` gives
graded pipeline runs one. Otherwise the first run's findings live in a chat
scroll and the second run cannot be compared against them.

Record every stall in this shape:

```
### Stall N — <one line: what I was trying to do>

- **Goal at that moment:**
- **Where I looked (phase 1):**   files opened, headings scanned, terms sought
- **What I found:**               or "nothing"
- **Severity:**                   blocked | slowed | confused
- **Resolved by (phase 2):**      file:line, or "not found anywhere", or
                                  "outside knowledge"
- **Outside knowledge used:**     anything I knew that the repo did not tell me
```

**"Where I looked" and "Outside knowledge used" are the load-bearing fields.**
The others describe the experience; those two produce the fix. A stall report
saying "I couldn't figure out how to start it" is nearly useless. One saying "I
searched README and OVERVIEW for run/start/launch/invoke and got nothing; I
only proceeded because I already knew the `--agent` flag exists" names the gap,
the search terms that should have hit, and the fact that outside knowledge
carried the reader.

**Severity is not importance.** *Blocked* means the run could not continue.
*Slowed* means it cost real time. *Confused* means the reader proceeded with a
wrong model and may not have noticed — often the worst of the three, because it
does not announce itself.

## The brief

Paste this to a context-free reader — a fresh session, a subagent, or a person.
It is deliberately self-contained: whoever receives it has not read this file
and must not.

---

> You are evaluating a repository you have never seen, as someone who has never
> seen it. Your job is **not** to succeed. Your job is to record precisely where
> and why you get stuck.
>
> **Goal:** get one task through this project's pipeline, whatever that turns
> out to mean.
>
> **Rules, and they matter more than the goal:**
>
> 1. **Start at `README.md`. Read only what it points you to.** Follow the
>    documented path the way a new user would.
> 2. **No repo-wide search in phase 1.** No grep, no glob, no reading files you
>    were not pointed at. You are simulating a person, and a person does not
>    have your search.
> 3. **The moment you are stuck, stop and write the stall down first** — what
>    you were trying to do, what you looked for, which files you opened, and
>    what terms you scanned for. Write it *before* you go looking further.
> 4. **Then, and only then, search freely** to resolve it. Record what resolved
>    it and where that was. If it turned out to be in a file no reasonable
>    reader would have opened, say so — that is the most valuable finding this
>    exercise produces.
> 5. **Flag every piece of outside knowledge you used.** Anything you knew
>    about Claude Code, agents, or this kind of tool that the repo did not tell
>    you. Be ruthless here. You know things a new user does not, and each one
>    you lean on silently is a gap that will not get fixed.
>
> **Do not** be charitable. Do not infer what a sentence probably meant. Do not
> fix anything, do not edit any file, and do not report the repo as good — that
> is not what is being measured.
>
> Use this format for each stall:
>
>     ### Stall N — <what I was trying to do>
>     - Goal at that moment:
>     - Where I looked (phase 1):
>     - What I found:
>     - Severity: blocked | slowed | confused
>     - Resolved by (phase 2):
>     - Outside knowledge used:
>
> End with: how far you got, and the single change that would have helped most.

---

## Instruments, and what each actually covers

| Instrument | Comprehension | Environment | Cost |
|---|---|---|---|
| Context-free subagent, briefed above | yes, with the generous-reader caveat | no | near zero |
| Fresh session in a scratch clone | partly — you are a compromised reader | path assumptions only | low |
| Another person | best available | only their machine | a favour |
| WSL / container | no | yes — Linux, case-sensitive paths | one command |
| Full VM | no | yes, plus the Claude Code install | high, mostly upstream |

**A scratch clone is worth doing even by a compromised reader.** Nothing in
this repo has ever run from a path other than its own, so a clone elsewhere is
the only thing that tests for absolute-path assumptions in the scripts.

## What to do with the findings

A stall becomes a ship blocker, an entry in the ranked list in
`specs/2026-08-25-public-ship-boundary.md`, or it becomes nothing — deliberately
and in writing. Do not let a stall log sit unclassified; that is how the last
one stayed open.

**Resist fixing during the run.** The run is measurement. Fixing mid-run
destroys the record of what the reader met, and the fix will be aimed at the
symptom rather than at the search that failed.

## Recorded runs

Keep every run here, the way `docs/toy-repos/gatekeeper.md` keeps graded ones.
A single run says what is broken now; a series says whether the docs are
getting better or whether a fix moved a stall rather than removing it.

*No instrumented runs yet. The brief above has never been given to anyone; the
docs it will test were written on 2026-08-26 and have not been read by anyone
who did not write them.*

### 2026-08-26 — unstructured, by the project owner. Found blocker 15.

Not a run of the brief above. The user asked a single cold-start question in
conversation — *"these agents have very generic names; what happens if someone
already has files by those names?"* — and it produced the only ship blocker so
far with a data-loss consequence: deploy overwrote a same-named agent and
reported success.

**Recorded because it is evidence for this document's central claim.** The bug
was invisible from inside the project for a reason that had nothing to do with
carelessness: everyone who could see it already had those agents installed as
their own, so there was nothing on their machine to collide with. It took
asking what a *stranger's* machine looks like.

Two things it settles:

- **The comprehension class is real and is where the severe findings are.** A
  clean VM would have reproduced this only if the tester had also happened to
  create their own `coder.md` first. The mind without context found it; the
  clean machine would probably have missed it.
- **The ranked blocker list is an argument, not an audit.** Blockers 2–14 came
  from a `/devil` run, and the argument never asked what happens on a machine
  that is not this one. Fifteen was more severe than most of Tier 1 and was not
  on the list at all.

**Not counted as a pass for the instrument.** One unstructured question is not
the two-phase protocol, produced no stall log, and cannot be compared against a
later run. It is a reason to believe the premise, not evidence the brief
works.
