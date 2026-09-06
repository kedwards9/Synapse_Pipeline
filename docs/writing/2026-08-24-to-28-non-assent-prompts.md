# Non-assent prompts — Synapse, 2026-08-24 to 2026-08-28

Thirty-eight prompts, verbatim and uncorrected, grouped by what kind of
intervention each was. Whether they show you supplying answers is for the reader
to decide; this document does not argue it.

**Every "what it changed" line carries a source** — a commit, a file and line, a
quoted record, or a measurement — or is explicitly marked `[unsourced]`. Same
distinction this project already draws between *not found (searched)* and *not
searched*: an unsourced claim is a different kind of statement, not a weaker
version of a sourced one.

Nothing here is my reading of your state of mind. That part is still yours.

## The numbers

**"Last 30 days" is five days.** Synapse transcripts begin 2026-08-24T02:04Z;
there is nothing before that. Git begins 2026-08-23, one day earlier, **so the
repository history covers the entire transcript window** — every claim below can
be sourced against it. That is not true of any other project on this machine.

| | |
|---|---|
| Raw prompt records | **798** |
| After deduplication | **649** — mid-turn messages are stored twice, once enqueued and once consumed |
| Pure assent by strict rule | **6** — `yes`, `push`, `go`, `Go`, `Push.`, `draft` |
| Matched the mechanical filter | **169** |
| Selected after reading | **38** |
| Per day | 128 / 83 / 197 / 199 / 191 |

**Six of 649 are bare agreement.** Just under one percent. The filter was not
separating signal from assent — there was almost none to separate. It selected a
*kind* of intervention from a population already substantive.

**The boundary log covers only the last 30 hours** of this window
(from 2026-08-27T14:34Z), so tool-call evidence exists for roughly one day in
five. Where a claim depends on it, that is stated.

---

## 1. You demanded a source, or made me go check

### `08-28 03:53Z` — the one that became a standing rule

> One thing I need you to check on, though, is where you say the manager gave
> established facts from the prior investigation. Did you ever look to see where
> manager got that information from? […] So I don't wanna make assumptions about
> where he got that information from without finding out exactly where.

### `08-28 03:58Z`

> Okay. So I think the lesson you just learned is don't make assumptions. You
> must have the full truth and source if you're going to call out a process that
> you think doesn't work. So you called out manager for having information it
> shouldn't have when, in fact, it should have it. So if you want to go throwing
> out accusations, please come back with a source that backs it up as this was
> not supposed to happen. That should be committed to memory because I don't
> want you trying to undermine what we're doing.

**Source:** `memory/accusations-need-a-traced-source.md`, loaded every session —
*"never call a process broken without tracing every claim to its origin first;
claim plus source, or don't say it."*

### `08-27 14:50Z` — sent mid-turn

> Um, I need you to double check because my UI is telling me you have an Explorer
> agent out.

**Source:** the boundary log holds **58 records with `agentType: "Explore"`**
between 2026-08-27T14:34:50Z and 14:41:56Z. It had been idle roughly eight
minutes when you asked — consistent with the rest of your message, *"if that's
just left over."*

### `08-26 23:59Z`

> can you check in with the snynapse-planner? i think something stalled

### `08-26 19:17Z`

> no need to look into anything and just want to confirm, I have no reason to
> stop the tests like you originally stated right? They should all come to a full
> conclusion waiting on a user prompt, right?

**[unsourced]** — what I had originally stated, and whether it held.

### `08-26 16:01Z`

> Yeah. If we can verify that those ECC rules are not being technically used, and
> they're just sitting in context and burning tokens for no reason, then we
> should probably remove them. Not probably. We should remove them.

**Note the self-correction inside the sentence** — *"probably"* to *"not
probably"* — conditional on the verification, not on the suspicion.

---

## 2. You contradicted an observation, or corrected me

### `08-28 03:09Z`

> Just so you know, you said only free cards ever get it. This is the bit that
> matters. A gridded card is excluded unconditionally. I'm still not seeing any
> rectangle on the card's edge floating in the small gap between the card and its
> neighbor. I don't see that at all.

**Note:** you quoted my claim back before reporting the contradiction. The
feature was argued for deletion in
`watcher/docs/2026-08-27-watcher-board-fit-no-scroll.md:22`, but **that record is
ABANDONED** — so the sliver still ships. What this demonstrates is the
observation, not a removal.

### `08-26 01:56Z`

> It just feels weird that you said something was pending. that I don't even
> recognize. It's not that I don't mind you suggesting it, just not in a pending
> situation. If I ask you, like, hey. What else can we do to improve this, then
> that makes sense. But when I'm saying, hey. What's what's pending…

**Source:** `memory/pending-means-user-recognises-it.md` — *"inherited handoff
items are suggestions, not pending; don't pad status lists."*

### `08-26 01:58Z`

> it felt like you were just adding stuff. It was like a never ending fucking
> list of crap. I don't even remember discussing.

### `08-26 03:17Z` — sent mid-turn

> Yeah, I have no problem wiring something in that has a use, especially if we
> have a use case for it. But I don't want something half baked actually
> consuming tokens for legitimately no reason. So if that's happening anywhere
> anywhere else, that's something we need to know so that we can fix it.

**Source:** `CLAUDE.md:123`, section *"Nothing half-built ships in an agent
definition"* — *"Every emitted field and every granted tool needs a path by which
it gets used… wire it, or delete it."* Also
`memory/no-half-built-agent-instructions.md`.

### `08-27 17:59Z`

> I think we're getting mixed up. I want all empty space, including the outer
> edges of where we're going to be having drag space as well. I need all of that
> to be able to use the right click menu.

### `08-28 14:21Z` — sent mid-turn

> So you're not the only one capable of drift.

**Context:** said after I flagged that the conversation had moved from Watcher to
Synapse and asked whether that was in bounds. You ruled it in bounds, and made
the point that the check cuts both ways.
**Source:** `memory/flag-topic-drift-then-continue.md` — *"name a thread split in
one sentence and keep going."*

### `08-27 03:33Z`

> Oh, fuck. Why wouldn't you do that to begin with? That is absolutely wild to me.

**[unsourced]** — what "that" was. The prompt records the reaction; the record
does not preserve the antecedent in a form I can quote.

---

## 3. You diagnosed your own error, unprompted

### `08-28 03:17Z`

> to be honest with you, I think I was added… editing the wrong y coordinate. I
> was editing the y coordinate for the window and not for card placement, and
> that was my mistake.

### `08-28 03:18Z`

> I did make the mistake I know I did because the first two times I tried to edit
> that file, I was changing the window y position and not the card position. […]
> So I know for a fact that it was me that made the mistake and not something
> else.

**Source:** `MANAGERHANDOFF.md` #1, Tried & Rejected — *"Two diagnostic
narratives were built and then retracted during hand-verification: that the
running app clobbered the user's first `view-state.json` edit (it did not…) and
that the durable-clamp defect destroyed the edit at launch (it does not fire at
launch)… Recorded so the next session does not re-derive these."* It names the
cause as *"the user editing `window.y` instead of the placement's `y`."*

### `08-26 19:47Z` — sent mid-turn, and this one is unusual

> I want you to know the thing you flagged about before I hit send on the next
> prompt, which is fix the permissions in version branch two. I actually did not
> type that, and that was an auto complete field from Claude. I'm guessing the
> Claude CLI, or it was guessing what I was gonna wanna type…

**You caught a contaminated input** — text that appeared to be your instruction
and was the CLI's autocomplete. Without this, an autocompleted phrase would have
entered the record as a stated requirement.

### `08-26 20:59Z`

> And we also need to be clear that I probably wasn't clearing my instructions
> either. I did not tell you, okay, boom. You're the orchestrator now. And I
> didn't make it a hard point for you to know that going forward, this is what
> we're gonna do. I kind of assumed you would take that r…

---

## 4. You supplied the design answer

### `08-27 21:06Z`

> I think the answer is ahead with a threshold because I think that will be a
> setting that can be set by the user in the config eventually when that's built.

**Source:** `watcher/src/shared/contracts.mjs:103` —
`export const DEFAULT_AHEAD_THRESHOLD = 20`. Shipped as stated, including the
settable-later intent, which Record A confirms is *"pre-scoped"* and unmoved.

### `08-26 21:38Z`

> Yeah. I think the cards should grow and shrink based on how many there are. If
> a user only has two cards open, and they're only watching two repos, those
> cards could genuinely be bigger, and they would be of no consequence.

**[unsourced]** — shipped card sizing is one shared explicit size with a resize
grip (`2026-08-27-watcher-card-sizing.md`), not count-derived. Whether this
prompt was superseded by a later decision or set aside, I cannot show.

### `08-26 20:17Z`

> Yeah. It would need to be an explicit config. You would need to be able to,
> like, type in the directories that you wanna monitor or the repos you wanna
> monitor. and I don't think an auto an auto would just create directories from
> nothing…

**Source:** `watcher/docs/2026-08-26-synapse-watcher-design.md` §13, Out of scope
— *"Auto-discovery of repositories."* Config-file-only shipped, and
`config.mjs` is the module task 2 later taught to write a default.

### `08-27 20:56Z`

> For a, your read is correct. If unmerged commits sitting unnoticed is a thing
> that actually bites me, it belongs in. So put it in. And for b, we'll do thin
> version one and just enrich it as we go.

**Source:** `unmerged > 0` is a live clause of the alert predicate —
`contracts.test.mjs:326`, *"hasUnresolvedWork: unmerged > 0 is true"*. The
predicate was named `needsAttention` when you decided this; it was renamed by
task 6 on 2026-08-28 (`d85a705`), and **your clause survived the rename
unchanged**, which is the thing the citation is for.

### `08-28 13:43Z`

> I think the recalibration is c. It's both.

### `08-28 13:52Z` and `08-28 14:32Z`

> I think I need to take my own advice and use what someone told me one day, and
> it's called kiss, k i s s, and it stands for keep it simple stupid.

> I think I'll just forget it now. I don't know. It's an interesting idea, but I
> think there's just… again, going against kiss.

**Source:** the two prompts themselves, forty minutes apart — the second applying
the principle to kill your own idea.

### `08-28 00:00Z`

> I think it would be better if we moved all the documentation to one folder.
> Would that be the correct assumption?

**Source:** `watcher/docs/README.md:4-7` — *"It was consolidated here on
2026-08-27 because an agent picking up Watcher work had to sweep `specs/`,
`plans/` and `docs/superpowers/specs/` to assemble the same set every time. One
directory, one glob."*

### `08-28 03:34Z`

> I think for now what I wanna do is I wanna eliminate the scroll bars going up
> and down left and right. If you have a card outside your normal viewing area, I
> don't think scrolling should get you to…

**Source:** produced `2026-08-27-watcher-board-fit-no-scroll.md`, which is
**ABANDONED** — you declined it on 08-28 after seeing it would delete the edge
marker, the obstruction outline, the sliver, `clampPlacement`, the
`IntersectionObserver` and roughly forty tests. The scroll problem it addresses
is still open.

---

## 5. Questions that changed the direction of the project

### `08-24 02:21Z` — sent mid-turn. The scope boundary starts here.

> Yeah. I think you're right. I think having to work inside Synapse would, uh,
> definitely just muddy the hell out of this. So that might be a project for
> later that I can really dig into. But I think right now, yeah, let's do Synapse
> right only. You have to go work in that specific folder in…

**Source:** `CLAUDE.md`, *"Scope — read this before picking up work"* and
*"Writing to other repos"* — *"`<consumer-repo>` is **read-only** from a session
rooted here."* Also `memory/synapse-session-scope.md` and
`memory/synapse-never-modifies-rpg-repo.md`. **This is the constraint that has
shaped every session since**, including the one that produced this document.

### `08-26 20:04Z` — Watcher starts here, against a documented prior decision

> Okay. What we're actually gonna do now is do something that I… we argued
> against for a while and is documented, and that is we are gonna go over the GUI
> quick dot MD, and we are going to start the process and the brainstorming of a
> GUI.

**Source:** the first Watcher commit is `5674d65`, 2026-08-26, *"add the watcher
package with a pinned Electron."* The prior rejection is cited in
`watcher/docs/2026-08-26-synapse-watcher-design.md:1101`, under Out of scope —
*"Hosting or driving a terminal. `docs/LESSONS.md` killed a GUI that hosted
Claude Code terminals; this is the watcher that lesson named as the surviving
alternative."*
**You noted you were reversing a documented decision as you did it** — and the
design record that resulted keeps the original rejection in force for the part
that was actually rejected.

### `08-26 20:20Z`

> So here's the problem is I kinda actually want this to be a standalone app on
> its own. Like, I wanted to have an executable that you can double click on, and
> it'll open up another window…

**Source:** `watcher/docs/2026-08-26-synapse-watcher-design.md:1063`, §12 open
question 2 — *"Packaging and distribution. 'Double-click executable' versus
Synapse's current clone-and-run."* Still open; it is `R4` in the review queue.

### `08-28 15:18Z` — the remote track starts here

> one thing I wanna ask is what if somebody wanted to track a repository that
> isn't local? what if they just wanted to track someone else's repo and see what
> they are doing? Does… is that something people do?
>
> Another… for instance, what if, um, I have a job and I'm working within a repo
> that I don't have anything really local that I save…

**Source:** the remote/mobile track is documented in
`watcher/docs/DISPATCH-QUEUE.md` — the decided table (GitHub only, fine-grained
PAT, one mixed board, 20–50 repos) and the research behind it, all dated
2026-08-28. `command-center/`'s design record is the same day.
**[unsourced]** — that this prompt *caused* it. It precedes the work and asks its
central question; sequence is all I can show.

### `08-28 15:21Z`

> If I need to add some kind of networking to this, that's fine. I have no
> problem with that. This is a long term project…

**Source:** `memory/watcher-is-not-a-synapse-niche-tool.md` quotes this line and
records the consequence — *"design for strangers, networking is cleared,
re-argue the single-user constraints."*

### `08-24 23:39Z` — sent mid-turn

> Okay. Question. What if I decided to run the manager in the Synapse folder?
> Would it be able to work on Synapse given the fact that there's not a lot of
> code? I mean, there is reviewing. Right? There is architecture to a point, but
> there's no code. So would it be pointless?

### `08-25 11:11Z` — sent mid-turn

> So, again, I ask if I ask the manager in the <consumer-repo> project to wire up a
> sound effect that I put in, create another file, then animate that file. Why
> wouldn't that all happen at the same time? Those those don't conflict at all.
> Yet, currently, it'll only do one thing in a time.

**Note the "again, I ask"** — this is a re-ask, which the record shows you doing
in several places when an answer did not land.

### `08-26 04:07Z` — the privacy position, stated once and unchanged since

> I think that's fine that my my stuff and my name and my repos and my
> directories are are in the the GitHub now. I don't care about that because I
> can always make a new repo and push the shippable material to it without that
> information. Correct?

**Source:** `specs/2026-08-25-public-ship-boundary.md:125` — *"The public artifact
starts as a fresh repository."* Line 130 adds the trap you would otherwise hit:
*"set `user.name` and `user.email` on the new repo before its first commit."*

---

## 6. Constraints and exclusions you set

### `08-26 18:01Z`

> the thing I'm gonna add is Linux is just gonna be a testing environment for us.
> We're not actually gonna use it. We're not actually gonna keep it updated or
> any of that information. The only thing we're gonna use it for is to test to
> make sure things work in Linux as they do in Windows.

**Source:** `memory/synapse-targets-windows-and-linux.md:20` — *"The WSL Ubuntu
install is a disposable test rig, not a maintained system."*

### `08-26 03:38Z`

> if Synapse ever does ship, we will be excluding the art director and artist
> agent. I don't think people in a general sense are going to be using those two
> specific agents

**Source:** `specs/2026-08-25-public-ship-boundary.md:559` — *"Decided: the art
agents do not ship by default."*

### `08-26 04:31Z`

> Given how much time and effort I put in this, how many hours I've already
> poured into Synapse, it's not something that I really wanna give away for free,
> to be honest with you.

**Source:** open as `R5` in `docs/REVIEW-QUEUE.md`. The 2026-08-28 pricing
research found the tension unresolved: monitoring tools do not sustain prices,
and Watcher's zero-infrastructure architecture deletes the one model that works.

### `08-26 20:31Z`

> Alright. To start, I actually don't want you to try to do any workarounds.
> Alright? If the agents won't work with you, then we'll just do a full stop real
> quick and kind of address it.

### `08-24 15:06Z` — sent mid-turn

> I actually don't want you to grade this. Go ahead and give this to a sub agent
> that can grade this and see where it works and fails and succeeds.

**Source:** `docs/toy-repos/runs/2026-08-26-architect/` exists as a graded run
directory. **You removed yourself and me from the grading loop** rather than
accept a self-assessment.

---

## 7. You told me to stop doing what was not working

### `08-28 18:59Z`

> Yeah. Published with force true. But if it fails again, just stop after one
> failed, and we'll try to figure something out.

### `08-28 20:34Z` — ninety-five minutes and one `/clear` later

> Hadded to the lessons because you need to learn that it's obviously not gonna
> work the other way. You have to do it the way it actually works.

**Source:** three artifacts, all committed after the second prompt —
`docs/LESSONS.md` entry *"An artifact republish refuses forever, and only
`force: true` ends it"* (commit `c5ddbab`); a section in `~/.claude/CLAUDE.md`,
taking that file from 34 to 64 lines; and
`memory/force-artifact-republish-on-refusal.md`.

**Source for the negative:** searched `docs/LESSONS.md`, `CLAUDE.md`,
`~/.claude/CLAUDE.md`, `BRAINSTORMHANDOFF.md` and the memory directory as they
stood before `c5ddbab`. The instruction existed in neither. *Searched, not
found.*

**The finding is not that the rule was missing. It is that the rule was given, in
plain words, and lost at a session boundary.**

---

## Appendix — the six pure-assent prompts

The complete list, so the one-percent figure can be checked:

    08-26 …  go
    08-27 …  Go
    08-27 …  Push.
    08-28 …  push
    08-28 …  yes
    08-28 …  draft

Every other prompt in 649 names an option, sets a value, gives a direction,
refuses something, asks a question, or reports an observation.
