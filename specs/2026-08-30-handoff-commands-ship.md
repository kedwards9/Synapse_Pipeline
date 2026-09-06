# The handoff commands ship with Synapse

**Status: decided by Karl, 2026-08-30. Scope change, not yet costed, not in the
Sept 10 timetable.**

**This reverses a decision made on 2026-08-27** which held that
`/takehandoff` and `/session-hand-off` were personal tooling, stayed in
`~/.claude/commands/`, and shipped with nothing. That decision instructed
future sessions not to re-raise it. Karl reopened it himself:

> *"That memory I have from August twenty-seventh, that's out the window.
> There's no shot I do not include these."*

**The old reasoning is kept here rather than deleted**, because it was not
foolish and the thing that killed it was a fact that did not exist yet.

---

## 1. What the 2026-08-27 decision said, and why

The commands were Karl's personal answer to context bloat across sessions.
Bundling them into a public artifact "would ship his private session-management
habits along with the framework." The unversioned-changes cost was named and
accepted.

**That held for three days and was correct on the information available.**

## 2. What changed

**Task 21 shipped a consumer with no producer.**
`watcher/src/main/handoff.mjs` landed on 2026-08-30. It scans a repository
root for `*HANDOFF.md`, selects the most recently modified, parses its topmost
`## Handoff #N` entry, counts the open questions under that entry's heading,
and renders a line on the card back.

**Nothing else in the distribution writes those files.** Ship it as it stands
and a stranger gets a feature that reads a format they have no way to produce —
the inverse of CLAUDE.md's *"every emitted field and every granted tool needs a
path by which it gets used."* The rule is written about agent definitions; the
shape of the defect is identical one level up.

**This was already visible in the code before it was visible as a decision.**
The same day, an independent review found that an unparseable handoff file
poisoned the whole card section, and the fix — return `null`, the humble
"I do not have this", rather than `false`, the confident "there is none" — was
chosen *specifically because* a stranger's repository would not match the
format. The code was already accommodating an absence that shipping the
commands would remove.

## 3. Karl's argument, and which part of it is evidence

**Evidence — his own working pattern, observed:**

> *"I could run ten sessions in a single hour or two hours because the context
> gets so big I need to clear out the bloat, get the important bits to move it
> into the next session."*

That is a measured rate on a real project, and it is the strongest thing here.
On a large codebase with many moving parts, session-to-session continuity stops
being a convenience.

**Belief, recorded as belief:**

> *"I don't understand how people could live without that right now."*

**This is untested and Karl flagged it as untested himself**, suggesting it may
be a research topic. Nobody has measured how common handoff practice is. The
honest position as of 2026-08-30: the underlying problem — context windows
fill, sessions end, models have no memory across them — is universal, and
`CLAUDE.md` is the sanctioned partial answer to it. Whether anyone else has
built something this structured is **not known**, and no research has been run.

**Do not promote that belief to a finding without measuring it.** It is the
kind of claim that reads as obvious to the person holding it and shapes a
roadmap if left unchallenged.

## 4. What shipping them actually requires

**Not yet costed. None of this is in the Sept 10 timetable**, and it is new
scope on a date that already had none spare.

- **Generalising off Karl's scheme.** Three logs with independent numbering,
  the `## Handoff #N — DATE` header format, the `### Open Questions` section,
  the `Session:` trailer convention, and `/takehandoff`'s brainstorm/code-work
  lock. A stranger has one log and none of those conventions.
- **The privacy pass applies to them too.** They are prose, and prose is where
  the scrub is expensive. See the separate, still-live blocker on shipping at
  all.
- **Deciding what `handoff.mjs` supports.** If the commands ship, the parser
  can assume the format it writes. If they ship as *optional*, it cannot, and
  today's `null` fallback stays load-bearing.
- **A tier marker, added 2026-09-01** — required by
  `YouTube/2026-08-31-synapse-audience-gate.md` §4. Shipping them is not a
  recommendation to adopt them on day one, and without a marker it reads as
  one. The canonical wording:

      Reach for these when a project outgrows a session.

  **This is a framing requirement, not a removal**, and the argument for
  shipping in §2 and §3 is untouched by it. It exists because the audience gate
  found two audiences — the repo's and the channel's — and *"ships with
  Synapse"* was being read by the wrong one.

  **Its final home is the shipped command documentation, which does not exist
  yet**, so the wording is recorded here where the shipping work will pick it
  up. The marker is also live today on the one reader-facing surface that does
  exist: `README.md`'s handoff paragraph.

## 5. Open questions — Karl's

1. **Do the commands ship as required, or as optional?** That decides whether
   `handoff.mjs` may assume a format.
2. **Does the three-log split survive generalisation**, or does a stranger get
   one log?
3. **Is the belief in §3 worth researching before Sept 10**, or is it enough
   that the pattern serves Karl and shipping it costs little?
4. **Does this move the ship date?** It is unbudgeted scope, and the timetable
   was already built on front-loading the things only Karl can do.

## 6. What this does not change

- `/session-hand-off` stays **user-invoked only**. Shipping it does not make it
  something an agent may call, and its `disable-model-invocation` is
  deliberate.
- The privacy blocker on shipping Synapse at all is separate and still live.
