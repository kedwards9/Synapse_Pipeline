# Glossary

**Canonical vocabulary. Read this when you are naming something or writing
prose, not when you are looking for code** — the map of where code lives is in
`MAP.md`.

> **Split out of the map on 2026-08-30.** The two had been one file, which
> meant every dispatched agent paid ~2,050 tokens for definitions of *board*
> and *card* on every task, whether or not it was naming anything. Splitting
> them roughly halved what an agent reads to orient. Nothing here changed;
> `MAP.md` carries the arithmetic.

Definitions only — what a term *is*, not how it works. Design rationale belongs
in `specs/`, and the agent pipeline's own concepts are in `docs/OVERVIEW.md`.

It begins with the GUI watcher cluster because that is what has been under
design. Terms from elsewhere in Synapse get added when they are actually
contested, not pre-emptively.

> **Reconciled 2026-08-26.** This file was written while the watcher rendered
> repositories as rows. The design moved to cards the same day and the glossary
> did not follow, so it listed *card* under _Avoid_ while the spec used it
> throughout. **Card is now the term; row is the one to avoid.**

## GUI watcher

**Watcher**:
A read-only window that observes repositories and reports what is happening in
them. It has no write path to any repository, and it does not host or drive a
terminal.
_Avoid_: dashboard, monitor, terminal host, control panel

**Board**:
The viewing area of the watcher's window — the rectangle inside the drag frame
that cards are seen through. It is the container, not the contents. It scrolls
when the contents need more room than it has, and a card can therefore sit
outside it.
_Avoid_: canvas, dashboard, workspace, and *grid* — the grid is what sits
inside the board, not another name for it.

> One DOM element, two terms. `#board` is both the board (its box, `height:
> 100%`, `overflow: auto`) and the grid (`display: grid`, its in-flow layout).
> Say which one you mean: resizing the board changes what is visible, while
> changing the grid changes where cards sit.

**Grid**:
Where cards live when snapped into place — the arrangement a card occupies
unless it has been free-placed. *Gridded* is the adjective, and is the word the
renderer already uses.
_Avoid_: layout, flow, default position, board

**Free placement**:
Where a card lives as a floating card: pulled out of the grid to a spot the
user chose, so that for a while it is the only repository they see, or simply
one that is easier to reach. **Deliberately transient** — it is a way to move
something where you want it, not a permanent arrangement to be preserved. A
card in this state is a **free card**.
_Avoid_: pinned, absolute position, custom layout, detached

**Card**:
One tile on the board. The unit of layout and the unit of change. A card has a
**kind**: a *repo card* shows one repository, a *media card* shows what is
playing. Unqualified, "card" means either.
_Avoid_: row, repo row, entry, item, tile

**At rest**:
The state of a card when no event is in flight and no agent is running. The
state the board occupies almost all of the time.
_Avoid_: idle mode, empty state, default state

**Activity strip**:
The compact horizontal history on a repo card, showing recent commits, agent
runs, and file churn over a trailing window of time.
_Avoid_: sparkline, graph, timeline bar

**Face**:
One of the two sides of a repo card — the **front** or the **back**. Both exist
in the DOM at all times and both lay out and composite always; turning a card
over rotates it rather than swapping its contents. A media card has one face.
_Avoid_: side, panel, view, screen

**Front**:
The face a card rests on: name, branch, tracking line, working-tree summary,
activity strip, footer. It never scrolls, and a clean value on it renders as
absence rather than as a zero.
_Avoid_: main view, summary side, default face

**Back**:
The face reached by turning a card over: current activity, the working-tree file
list, recent commits, hot-file churn, and one handoff line. It scrolls when its
content overflows, and its first screenful must stand on its own — anything
below the fold is extra, never the answer.
_Avoid_: detail view, expanded card, drawer, flip side

**Not collected**:
The state of a value the watcher has never gathered, as opposed to one it
gathered and found empty. The two are different claims and the card says so
differently: not-collected renders a grey marker, while collected-and-empty
renders **absence**. Merging them is the recurring defect this vocabulary exists
to prevent — a card that says "clean" about something it never looked at is the
window lying by being silent.
_Avoid_: empty, none, unknown, no data, n/a

**Earned motion**:
Movement in the interface that is traceable to a fact — an event landed, a
process is running, or time moved. The opposite is ambient motion, which is
animation that runs regardless of whether anything is true, and which the eye
learns to ignore.
_Avoid_: animation, polish, liveliness

**Live signal**:
What a card reports about right now — one of **green** (something moved within
the green window), **amber** (work in flight that stopped), **red** (blind, or
the work failed), or **grey** (nothing to say, or given up on). Carried by the
ring, sweep, and halo. Changes as the world changes. **Degraded is not one of
its values** — it composes alongside, so a card can be green *and* degraded.
_Avoid_: status, state (unqualified), indicator

**Error latch**:
The record that something failed and the user has not yet acknowledged it.
Carried by the dot, independent of the live signal, and cleared only by the
user. Distinct from **mute**, which clears by itself when the repository moves.
_Avoid_: error state, alert, flag, sticky error

**Mute**:
A per-repository suppression of attention that lifts on its own when that
repository moves again. Distinct from the **error latch**, which does the
opposite.
_Avoid_: snooze, ignore, silence, dismiss

**Degraded**:
The condition where the watcher's file watching has died but the reconciling
poll still works. The watcher is still correct and is no longer fast. Distinct
from **blind**, which is the condition where it cannot read the repository at
all. A fact about the watcher, not about the repository — which is why it
qualifies a **live signal** rather than being one of its values.
_Avoid_: partial failure, warning, stale, degraded state

**Movement**:
The repository changing in any way the watcher can observe — a commit, a branch
or index change, an in-progress operation starting or ending, or a working-tree
change including an untracked file appearing. Refreshes the **green window**.
Broader than **work in flight**, deliberately.
_Avoid_: activity, change, update, event

**Work in flight**:
Tracked changes that exist and are unfinished — `changed` and `unmerged`,
**never** `untracked`. The precondition for amber: a card goes amber only when
movement stops *and* work in flight remains. A stray untracked file must never
hold a card amber forever.
_Avoid_: dirty, pending changes, WIP

**Unresolved work**:
Work left in a state that needs resolving, which will not resolve itself and
will not decay — commits piled up unpushed past the threshold, or an unfinished
merge. Carried by the coloured counts on the card front, never by the **live
signal**, because it becomes true by piling up rather than by waiting.
_Avoid_: needs attention, alert, backlog, pending

**Green window** / **amber window**:
The two user-set durations of the timing ladder. The green window is how long a
card stays green after the last movement; the amber window is how long it then
stays amber before the watcher gives up on it.
_Avoid_: timeout, stall threshold, TTL, interval

**RepoSource**:
The seam that supplies repository state to the watcher. Its git implementation
is the substrate; the Synapse agent-activity adapter layers on top and is
allowed to fail without taking the watcher down.
_Avoid_: provider, driver, repo service

**RepoSnapshot**:
The immutable value a `RepoSource` returns — one repository's state at one
moment. What crosses the IPC boundary and what a repo card renders.
_Avoid_: repo state, repo data, status object

**MediaSource**:
The seam that supplies the operating system's current media session to the
watcher. A sibling of `RepoSource`, not an adapter layered onto one, because
what it describes is not a repository.
_Avoid_: player, media service, Spotify adapter

**MediaSnapshot**:
The immutable value a `MediaSource` returns — what is playing at one moment,
including the distinction between *nothing is playing* and *the mechanism is
unavailable*.
_Avoid_: now playing, track info, media state
