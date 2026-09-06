# Worksheet — the provenance check, 2026-08-28

**This is a prompt, not a draft.** Everything below the evidence is yours to
type. Nothing here tells you what happened or what it meant — that is the part
that has to be in your words, because it is the only part a reader cannot get
from the repository.

**Do not skip to the end and summarise.** Write the middle sections before you
write the last one. If you already know the conclusion when you start writing
what you believed, you will write a version of the belief that was on its way to
being right, and that version is not what you had at the time.

**If you cannot remember, say so in the document.** "I don't remember what I
thought here" is a true sentence and a usable one. A confident reconstruction of
a forgotten thought is neither.

---

## The evidence

Facts only, pulled from the boundary log, the transcripts and git. No
interpretation — that is what the blanks are for.

### Timeline

| Time (UTC) | What the record shows |
|---|---|
| 14:26 | Commit `6addd79` — *"flag a pipeline document altered outside the pipeline."* The check ships. |
| 19:13 | You are told three features are having their first live outing. Of the provenance check: *"It will halt on `2026-08-27-watcher-board-fit-no-scroll.md`… That halt is the feature working. Just don't point Manager at that file."* |
| 19:17 | A `synapse-manager` session runs `grep -l "synapse-pipeline-artifact" "watcher/docs/2026-08-28-watcher-placement-clamp.md"` — a different file from the one named above. |
| 19:18 | You raise it. The premise on the table: Manager appears to know something about a document's contents, and it is not allowed to. |
| 19:19 | The check is run by hand, twice — first on the one file, then across the directory. |
| 19:27 | Commit `12d44b5` — *"anchor the provenance marker check to the first line."* |

Five hours and one minute from shipping to fixing.

### What the agent is allowed to do

From `agents/synapse-manager.md`, line 4:

    tools: Agent(synapse-architect, synapse-planner, synapse-coder,
           synapse-reviewer, synapse-art-director, synapse-artist, Explore),
           SendMessage, TodoWrite, Bash

No `Read`. No `Grep`. No `Glob`. Its own text: *"You never open them, so a
fingerprint is the only thing about their contents you can hold."*

The one exception, as written in the definition: `grep -l
"synapse-pipeline-artifact" <path>` — *"the one and only exception to 'you do
not open it,' and it does not widen… no line of the document enters your
context."*

### The command that was run by hand, and what came back

```bash
grep -l "synapse-pipeline-artifact" watcher/docs/2026-08-28-watcher-placement-clamp.md
echo "grep exit: $?"
head -1 watcher/docs/2026-08-28-watcher-placement-clamp.md
```

The `grep` matched. `head -1` returned the document's title.

### Lines 3–6 of that file

```
**Status:** Decided 2026-08-28.

**Not a pipeline artifact.** Written in a brainstorming session, not by
`synapse-architect`, and carries no `synapse-pipeline-artifact` marker.
```

### Scope, measured at the time

Nine documents in `watcher/docs/` matched, including all six specs queued for
the run that was about to start. One of the nine carried the marker on its first
line.

### The change

Before:

```bash
grep -l "synapse-pipeline-artifact" <path>
```

After:

```bash
head -1 <path> | grep -c "synapse-pipeline-artifact"
```

---

## Your account

Type into these. Delete any prompt that does not fit what actually happened, and
add sections that do.

### What you noticed, and when

*What made you look? Was it the halt itself, something about how it was phrased,
or something else entirely?*

>

### What you thought was going on

*Before you knew. Include the version you would not put in a commit message.*

>

### What you thought it would cost

*If the first explanation had been the right one — what did that mean for the
project?*

>

### Why you pushed on it instead of accepting it

*The record shows you raised it rather than working around it. What made it
worth the interruption?*

>

### What you expected the check to do, versus what it did

*You had been told at 19:13 what it would halt on. Did that shape how you read
the halt at 19:17?*

>

### The moment it turned

*What was the specific thing that changed your mind — a line, an output, a
sentence?*

>

### What you think now

*Not the fix. What you would look for earlier next time, or what you would not
bother doing again.*

>

### What you would have gotten wrong if you had not checked

>

---

## Getting more evidence

If a section is blank because you cannot remember the surrounding detail, pull
the window rather than guessing:

    node scripts/investigation-window.mjs '2026-08-28T19:17:00Z+11m' --cwd 'E:\synapse' \
      --transcript "<home>\.claude\projects\E--synapse\246577d2-5db7-4d05-b8c2-ba3c1d6caa14.jsonl"

That prints every tool call and every visible statement in the window, in order.
**It does not contain anyone's reasoning** — the transcript stores `thinking`
blocks as empty strings — so it can tell you what was done and said, and never
what was thought. The blanks above are the only place that exists.

---

## Notes on using this format again

- The evidence section is generated from the record. The account section never
  is.
- Write the account before re-reading the fix. The fix is in git and will keep.
- One worksheet per finding in `docs/FINDINGS.md`. The three-line marker there is
  the seed; this is where it becomes an account.
