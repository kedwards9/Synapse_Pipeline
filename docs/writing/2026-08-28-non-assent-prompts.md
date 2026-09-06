# Non-assent prompts, 2026-08-27 to 2026-08-28

Twenty-one prompts, verbatim and uncorrected, grouped by what kind of
intervention each was. Whether they show you supplying answers is for the reader
to decide; this document does not argue it.

**Every "what it changed" line carries a source** — a commit, a file, a
measurement — or is explicitly marked `[unsourced]`. The distinction is the same
one this project already draws between *not found (searched)* and *not searched*:
an unsourced claim is not a weaker sourced claim, it is a different kind of
statement, and collapsing the two is how a document stops being evidence.

Nothing here is my reading of your state of mind. That part is still yours.

## The numbers

**387** raw prompt records, 2026-08-27T00:00Z to 2026-08-29T06:00Z, across 20
sessions.

**361** after deduplication. A message typed while work was already running is
stored twice — once enqueued, once consumed — so 26 were doubles.

**2** are pure assent by strict test: the entire message is an affirmation
carrying nothing else. They are `"yes"` (08-28 18:27Z) and `"draft"` (08-28
22:10Z).

That is the direct answer to the worry that prompted this document, and it is
not the answer either of us expected. **Bare agreement is not what you send.**
Even the shortest prompts mostly carry a decision — `"Tell the architect option
b."`, `"Let's go with twenty, safe bet."`, `"No. For now, we're just gonna do
text."`, `"dont dispatch any agents"`, `"Stop"`.

**40** are under 40 characters. Of those, by my reading rather than by rule,
about **twelve** are bare agreement or a bare instruction to proceed — `"go"`,
`"Go"`, `"Push."`, `"push"`, `"Next dispatch."`, `"Yes. Go ahead."`, `"Okay.
Sounds good."`, `"That all sounds good."`, `"Yeah. Go ahead."`, `"yes"`,
`"draft"`, `"Up. Push the artifact."` **That twelve is a judgement and the two is
not.** The full forty are listed in the appendix so the boundary can be
disagreed with.

**81** matched the mechanical filter for negation, hypothesis, verification
requests and corrections. **21** survived reading and are below.

**So the filter was not separating signal from assent** — there was almost no
assent to separate. It selected a *kind* of intervention out of a population that
was already almost entirely substantive.

---

## 1. You demanded a source before accepting a claim

### `08-28 03:53Z` — the one that became a standing rule

> One thing I need you to check on, though, is where you say the manager gave
> established facts from the prior investigation. Did you ever look to see where
> manager got that information from? When it says established facts from prior
> investigation, that could potentially mean I did it and gave the manager the
> instructions, or as you probably predict, he ran an explore agent, but you're
> not showing where he got that information from. So I don't wanna make
> assumptions about where he got that information from without finding out
> exactly where.

Five minutes later, after the check came back:

### `08-28 03:58Z`

> Okay. So I think the lesson you just learned is don't make assumptions. You
> must have the full truth and source if you're going to call out a process that
> you think doesn't work. So you called out manager for having information it
> shouldn't have when, in fact, it should have it. So if you want to go throwing
> out accusations, please come back with a source that backs it up as this was
> not supposed to happen. That should be committed to memory because I don't
> want you trying to undermine what we're doing.

**What it changed:** became the standing instruction *"accusations need a traced
source."*
**Source:** `~/.claude/projects/E--synapse/memory/accusations-need-a-traced-source.md`,
which exists and is loaded every session. Its one-line index entry reads *"never
call a process broken without tracing every claim to its origin first; claim plus
source, or don't say it."*
**[unsourced]** — the further claim that it is *why* the provenance
investigation seventeen hours later opened with a trace. The two are consistent
and I cannot demonstrate the causal link from the record.

### `08-28 04:01Z` — and you did not accept the proposed fix either

> …all I wanna know is if I come into this instance again, I don't want manager
> to do what you said and stonewall me because it doesn't help. I can't progress
> further if I don't understand what's being asked of me. So I don't mind it
> working the way it did even though it probably burned a significant amount of
> tokens doing it. […] So, again, I wanna propose the question. Is there a
> scenario in which the manager using an explore agent in the scenario given
> potentially be bad in the future?

**[unsourced]** — I cannot show from the record what fix was on the table when
you rejected it, or what happened to the re-asked question. What the prompt
itself demonstrates is that you declined a proposed behaviour and restated an
unanswered question; the consequence is not traceable.

### `08-27 14:50Z` — sent mid-turn

> Um, I need you to double check because my UI is telling me you have an Explorer
> agent out.

**Source:** the boundary log holds **58 records with `agentType: "Explore"`**
between 2026-08-27T14:34:50Z and 14:41:56Z. An Explore agent was running in that
window, and had made no tool call for roughly eight minutes when you asked —
which is consistent with the second half of your message, *"if that's just left
over."*
**[unsourced]** — what I had told you immediately before, and therefore whether
this corrected me or confirmed me.

---

## 2. You contradicted an observation with your own

### `08-28 03:09Z`

> Just so you know, you said only free cards ever get it. This is the bit that
> matters. A gridded card is excluded unconditionally. I'm still not seeing any
> rectangle on the card's edge floating in the small gap between the card and its
> neighbor. I don't see that at all.

**Source:** the feature was deleted rather than fixed.
`watcher/docs/2026-08-27-watcher-board-fit-no-scroll.md:22` lists *"obstruction
outline, the sliver, `clampPlacement` and the `IntersectionObserver`"* among the
deletions, and its Decision 4 is superseded.
**Note:** that record is itself ABANDONED — the deletion was argued and then
declined. So the sliver still exists in the shipped code; what this prompt
demonstrates is the observation, not a removal.

### `08-27 17:59Z`

> I think we're getting mixed up. I want all empty space, including the outer
> edges of where we're going to be having drag space as well. I need all of that
> to be able to use the right click menu.

### `08-28 14:21Z`

> So you're not the only one capable of drift.

**Context:** said after I flagged that the conversation had moved from Watcher to
Synapse and asked whether that was in bounds. You ruled it in bounds — and made
the point that the check applies both ways.

**What it changed:** became a standing rule.
**Source:** `memory/flag-topic-drift-then-continue.md` — *"name a thread split in
one sentence and keep going; Synapse-to-Synapse tangents are in bounds."*

---

## 3. You diagnosed your own error, unprompted

### `08-28 03:17Z`

> to be honest with you, I think I was added… editing the wrong y coordinate. I
> was editing the y coordinate for the window and not for card placement, and
> that was my mistake.

### `08-28 03:18Z`

> I did make the mistake I know I did because the first two times I tried to edit
> that file, I was changing the window y position and not the card position. The
> third and final edit I did, I changed the Synapse y position. So I know for a
> fact that it was me that made the mistake and not something else.

**What it changed:** two diagnostic narratives built on the assumption that the
application was destroying your edits were retracted.
**Source:** `MANAGERHANDOFF.md` #1, Tried & Rejected — *"Two diagnostic
narratives were built and then retracted during hand-verification: that the
running app clobbered the user's first `view-state.json` edit (it did not…) and
that the durable-clamp defect destroyed the edit at launch (it does not fire at
launch)… Recorded so the next session does not re-derive these."* It also records
the cause you gave: *"the user editing `window.y` instead of the placement's
`y`."*

### `08-28 20:40Z`

> Whoops. Well, I fucked up because I went with number three before number six. I
> was going in order of dispatch queue, not the status queue.

**What it changed:** the documented run order was corrected to match the order
you took by accident.
**Source:** commit `930a3c6`, *"put the real run order at the top, and fix the
order it stated."* Its three reasons are checkable independently: the queue's own
first constraint is *"#3 before any other card work"* and task 6 edits
`repo-card.mjs:167`; task 6 renames `needsAttention`, which task 3's spec names
six times; and Record A's Consequences count *"the card-legibility rule that
reads its clauses"* among the rename's three touch points, a rule that does not
exist in code until task 3 lands.

---

## 4. You supplied the design answer

### `08-28 13:43Z`

> I think the recalibration is c. It's both.

### `08-27 21:06Z`

> I think the answer is ahead with a threshold because I think that will be a
> setting that can be set by the user in the config eventually when that's built.

**Source:** `watcher/src/shared/contracts.mjs:103` — `export const
DEFAULT_AHEAD_THRESHOLD = 20`. Shipped as stated, including the
settable-later intent, which Record A confirms is *"pre-scoped"* and unmoved.

### `08-28 13:52Z`

> Yeah. I think I like a… I think I need to take my own advice and use what
> someone told me one day, and it's called kiss, k i s s, and it stands for keep
> it simple stupid.

### `08-28 14:32Z`

> I think I'll just forget it now. I don't know. It's an interesting idea, but I
> think there's just… again, going against kiss.

**Source:** the two prompts themselves, 13:52Z and 14:32Z — forty minutes apart,
the second applying the principle to kill your own idea.
**[unsourced]** — any downstream effect. This is a stated principle, not a
traceable change.

### `08-28 00:00Z`

> I think it would be better if we moved all the documentation to one folder.
> Would that be the correct assumption?

**What it changed:** `watcher/docs/` was consolidated.
**Source:** `watcher/docs/README.md:4-7` — *"It was consolidated here on
2026-08-27 because an agent picking up Watcher work had to sweep `specs/`,
`plans/` and `docs/superpowers/specs/` to assemble the same set every time. One
directory, one glob."* Note the README dates it 08-27 and this prompt is 08-28
00:00Z, which is 08-27 17:00 local — the same evening, not a later one.

---

## 5. A question that changed the direction of the project

### `08-28 15:18Z` — the one that opened the entire remote track

> one thing I wanna ask is what if somebody wanted to track a repository that
> isn't local? what if they just wanted to track someone else's repo and see what
> they are doing? Does… is that something people do?
>
> Another… for instance, what if, um, I have a job and I'm working within a repo
> that I don't have anything really local that I save, maybe pieces of it, but
> most of what I do gets pushed online for other employees to work on as well.

**Source:** the remote track is documented in
`watcher/docs/DISPATCH-QUEUE.md`, section *"The remote / mobile track"*, which
records the decided table (GitHub only, fine-grained PAT, one mixed board,
20–50 repos) and the research behind it. All of it is dated 2026-08-28. The
`command-center/` package's design record is dated the same day.
**[unsourced]** — that this prompt *caused* it. The prompt at 15:18Z precedes
all of that work and asks its central question; I cannot prove the link beyond
sequence.

### `08-28 15:21Z`

> If I need to add some kind of networking to this, that's fine. I have no problem
> with that. This is a long term project that I don't want to have just…

**Source:** `memory/watcher-is-not-a-synapse-niche-tool.md`, which quotes this
line and records the consequence: *"long-term general-purpose project; design for
strangers, networking is cleared, re-argue the single-user constraints."*

### `08-28 19:41Z`

> Well, here's the thing. My desktop is always on regardless. I'm… I don't hardly
> shut it off, and when I do, it's just for a restart. So that's not a hurdle to
> overcome.

**Source:** `BRAINSTORMHANDOFF.md` #3, Tried & Rejected — *"Applying the 'desktop
serving the phone' rejection to the user's own setup. That finding was about
shipping to strangers, where the desktop being asleep, NAT and CGNAT all bite.
His machine is always on. **The reasoning does not transfer** — corrected
mid-session and the Command Center design depends on the correction."*

### `08-28 14:05Z` — the provenance check itself was your idea

> I'd rather tell the manager that, hey. Something has changed outside of the
> pipeline so that it knows to flag it as this was not a decision made here and
> now. This was made outside of… I think that's a good thing to catch in case
> someone or something changes the file outside of my purview.

**Source:** commit `6addd79`, 2026-08-28T07:26:44-07:00 — *"flag a pipeline
document altered outside the pipeline."* That is 14:26Z, twenty-one minutes after
this prompt, and five hours and one minute before the fix commit `12d44b5` that
the first worksheet is about.

---

## 6. You told me to stop doing the thing that was not working

### `08-28 20:34Z`

> Hadded to the lessons because you need to learn that it's obviously not gonna
> work the other way. You have to do it the way it actually works.

**Source:** three artifacts, all committed after this prompt — `docs/LESSONS.md`
entry *"An artifact republish refuses forever, and only `force: true` ends it"*
(commit `c5ddbab`); a new section in `~/.claude/CLAUDE.md`, which took the file
from 34 to 64 lines; and `memory/force-artifact-republish-on-refusal.md`.
**But see below — the instruction already existed.**

### `08-28 18:59Z` — you had already said it, ninety-five minutes earlier

> Yeah. Published with force true. But if it fails again, just stop after one
> failed, and we'll try to figure something out.

**What it changed:** nothing, at the time. It was given as an instruction in one
session and not written anywhere durable, so when the next session opened at
20:24Z the same loop ran three refusals before I asked — and you had to give the
same instruction again, more sharply, at 20:33Z.

**Source for the negative:** searched `docs/LESSONS.md`, `CLAUDE.md`,
`~/.claude/CLAUDE.md`, `BRAINSTORMHANDOFF.md` and the memory directory as they
stood before commit `c5ddbab`. No record of this instruction existed in any of
them. *Searched, not found* — as distinct from not searched.

**The finding is not that the rule was missing. It is that the rule was given,
in plain words, and then lost at a session boundary.** Ninety-five minutes, one
`/clear`. That is the gap the memory file and the global instruction now cover,
and it is a better argument for writing things down than the original bug is.

---

## Appendix — the forty shortest prompts

Listed in full so the twelve-are-bare-agreement judgement above can be checked
and disagreed with. Verbatim, in time order.

    08-27 00:18  go
    08-27 01:45  Go
    08-27 03:28  Next dispatch.
    08-27 03:32  other, there is still no config.
    08-27 04:23  Go ahead and commit. Don't push.
    08-27 05:12  Commit, push, and /session-hand-off
    08-27 15:50  Looks like the architect is done.
    08-27 15:52  Manager's done and paused right now.
    08-27 16:54  dont dispatch any agents
    08-27 17:57  Yeah. Go one two three.
    08-27 18:01  That all sounds good.
    08-27 19:23  Push.
    08-27 20:45  Yeah. Let's do one and two
    08-27 20:54  Tell the architect option b.
    08-27 20:55  Alright. Let me redo that.
    08-27 21:21  Let's go with twenty, safe bet.
    08-27 21:53  Let's go ahead and do the marker UI.
    08-27 21:53  Stop
    08-27 22:03  anchor the session
    08-27 22:35  Let's go ahead and push.
    08-27 22:53  not have access to the Explorer agent?
    08-27 23:14  Yes. Go ahead.
    08-27 23:31  Yeah. You'll go with option a.
    08-27 23:32  Okay. Sounds good.
    08-27 23:48  unless that's not within its bounds.
    08-28 00:09  So we just stick with three?
    08-28 00:46  Let's work on the intake round.
    08-28 04:11  n
    08-28 04:11  no
    08-28 04:14  push
    08-28 15:09  Verbose by default, toggle later.
    08-28 17:23  Let's start on the mute question.
    08-28 17:38  Yeah. Go ahead.
    08-28 17:49  Correct it.
    08-28 17:54  Alright. Let's move to the dial.
    08-28 17:58  No. For now, we're just gonna do text.
    08-28 18:27  yes
    08-28 20:43  Up. Push the artifact.
    08-28 20:49  Yes. Spec out the hook log adapter.
    08-28 22:10  draft

**The two counted as pure assent by rule** are `yes` and `draft` — the only two
whose entire content is an affirmation. Everything else on this list either names
an option, sets a value, gives a direction, or refuses something.
