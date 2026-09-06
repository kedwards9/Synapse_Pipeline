# Cite code by symbol, never by line number

**Date:** 2026-08-29
**Status:** decided; the rule is in `CLAUDE.md`, the argument is here
**Scope:** every design record, spec, plan and dispatch prompt in this repository

---

## 1. The failure

A record cites `repo-card.mjs:167`. A task lands and shifts that file by three lines. The citation
now points at different code — **and still resolves.**

That is the whole problem. Compare the two failure shapes:

| Citation kind | When the code moves | How it fails |
|---|---|---|
| A path that no longer exists | Immediately visible | Loud — the file is not there |
| A **line number** that has shifted | Invisible | **Silent** — it resolves to real code, the agent edits something, and reports success |

`obra/superpowers` issue #2178 (2026-08-19) states it exactly:

> "The failure is also silent and confident. A stale path is caught immediately — the file is not
> there. A stale line range still resolves, to different code, so the agent edits something real
> and reports success."

## 2. Why this is worse for a plan than for a document

The same issue names the mechanism that makes plans self-defeating:

> "Every task that lands shifts the line numbers for every task that follows, so a plan with N
> sequential tasks invalidates its own later citations as it succeeds. **Self-inflicted, and worse
> for the plans that are going well.**"

`github/spec-kit` issue #4065 (2026-08-12) reports an **analogous** mechanism: *"any insertion or
deletion forces a renumber, and a renumber silently invalidates every citation elsewhere."*

> **Corrected 2026-08-29 — this said "two independent projects, same defect", and that overstates
> the source.** #4065 is about `FR-###` / `T###` **identifier** renumbering across artifacts, not
> line-number citations, and **symbol anchors would not fix it.** The mechanism rhymes — dense
> sequential numbering invalidated by insertion — but it is an analogy, not a second instance.
> **The rule rests on #2178 plus the local evidence below**, which is enough.

## 3. It has already happened here, twice, on one day

**2026-08-29, found by a queue audit.** `watcher/docs/DISPATCH-QUEUE.md` claimed twice that
`repo-card.mjs:167` was *"unrelated `hotFiles` code."* Measured: line 167 is the `})` closing
`recentCommits`; `hotFiles` begins at 168. **Off by one — and line 166 is `recentCommits`'s write
spec, which is precisely the code task 19 exists to replace.** The queue was calling "unrelated" the
one region a queued task is about.

**Same day, and not a risk — a realised failure.** `watcher/docs/2026-08-29-watcher-card-back.md`
shipped with **fourteen** line citations across thirteen lines (one line carried two).

**Two of them were already dead before anyone rewrote them, and not from the tasks they warned
about.** Commit `06a4414` — *"wire Add repository / Remove from board into the board and card
menus"*, task 16, entirely unrelated — shifted `main.mjs` by 98 lines. The record's `main.mjs:210`
was **accurate when written** at `f144992`, naming the comment about `ipcMain.handle` being banned.
At `e1acc69` the same citation names `const currentRaw = JSON.parse(...)` in the repository-removal
handler: real code, wrong code, no error. `context-menu.test.mjs:92` moved to 95 the same way.

**That is the stronger form of the argument.** The danger is not that a queued task will eventually
move the line — it is that *any concurrent work* already did, within hours, silently.

> **Corrected 2026-08-29 — this section said "twelve".** An audit re-derived it from the
> pre-rewrite text: **fourteen**. A hand-counted total, in the document arguing against imprecise
> citation. Kept visible because it is the same failure the rule exists to prevent, one level up.

## 4. The rule

**Cite the symbol. If the symbol is not enough, quote the code.**

| Instead of | Write |
|---|---|
| `git-cli.mjs:19` | `READ_ONLY_GIT_SUBCOMMANDS` in `git-cli.mjs` |
| `repo-card.mjs:159-172` | `LIST_SPECS` in `repo-card.mjs` |
| `main.mjs:210` | the board-state push comment in `main.mjs` — quoted |
| `index.html:139-153` | the `<div class="face back">` block of the `card-repo` template |
| `context-menu.test.mjs:92` | the test named *"…there is no ipcMain.handle( anywhere under src/"* |

**A quoted snippet is a self-verifying citation.** A reader — human or agent — can `grep` for it.
When the quote no longer matches, the citation has failed *loudly*, which is the property line
numbers lack.

## 5. What this does not forbid

- **Line numbers in a report of a measurement taken at a moment**, where the moment is stated:
  *"measured at `f144992`, line 167 was…"*. A dated observation is a fact about the past and does
  not rot; a pointer does.
- **Line numbers a tool emits** — test output, stack traces, `git diff` hunks. Those are generated
  at read time and are correct by construction.
- **Historical fences.** Records deliberately keep superseded reasoning. A citation inside a block
  already tagged historical is disclosed as stale and needs no repair.
- **A citation shown as an example of the banned form.** This document is full of them, and so is
  `CLAUDE.md`'s section. Any detector must exempt them or it fires on the rule itself.

> **Corrected 2026-08-29.** This section claimed `DISPATCH-QUEUE.md`'s `repo-card.mjs:167` note "was
> corrected because it was wrong when written". **Only one of its two instances had been corrected.**
> The second sat inside a historical fence saying the same false thing, and an audit found it. Both
> are fixed now. The lesson is the one this project keeps relearning: **a claim appearing twice gets
> corrected once**, and the fix has to search rather than assume.

**A quoted snippet is self-verifying only if it stays line-shaped.** Three of this record's four
quotes are multi-line `//` comments reflowed into markdown blockquotes, and `grep -F` does not find
them. Quote a single line, or accept that the loud-failure property is lost.

## 6. Retrofit scope — deliberately narrow

**Only `2026-08-29-watcher-card-back.md` was corrected**, because tasks 17–21 are unstarted and its
citations point at code those tasks will move.

**No sweep of the other ~40 records in `watcher/docs/`.** Their citations are mostly inside
historical fences where staleness is already disclosed, and rewriting them would churn documents
nothing is about to act on. The rule binds new writing; old records are corrected when a live task
depends on them.

## 7. Open, not decided here

- **Whether `queue-audit.mjs` should detect line citations in un-landed records.** It is mechanically
  easy — a regex for `` `[\w./-]+\.(mjs|html|css|json):\d+` `` outside a fenced historical block —
  and it would have caught the card-back record before dispatch. Not specced, because the audit
  script's scope is being amended separately and this would be a third kind of check.
- **Whether the same rule should bind commit messages.** Untested either way; commit messages are
  immutable once written, which is an argument that they are more like a dated measurement than a
  pointer.

## 8. Consequences

- `CLAUDE.md` gains the rule in short form. The argument stays here, read once by a human, rather
  than being paid for on every agent dispatch.
- **The five dispatch prompts for tasks 17–21 carry no line citation** — but the queue's preamble
  above them did, and this section claimed otherwise until an audit found `index.html:139-153` at
  `## The card back — tasks 17 to 21`. That is the block a dispatcher reads before sending the five
  prompts, so the distinction between "the prompt" and "what a dispatcher reads" was doing no work.
  Corrected in the queue.
- The three drafting agents dispatched on 2026-08-29 were each told the rule explicitly, so the
  records they produce should already comply. **Verify rather than assume.**
