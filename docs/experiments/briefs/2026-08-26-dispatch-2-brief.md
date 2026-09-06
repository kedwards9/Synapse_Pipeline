# Dispatch 2 brief — `synapse-architect` — 2026-08-26 15:35

Reproduced verbatim from the experiment log
(`docs/experiments/2026-08-26-session-as-orchestrator.md`). Split out to keep
that log readable. Nothing here is edited or summarised.

---

**Task.** Architect the "now playing" media card for the Synapse Watcher. The user has already chosen the approach; your job is the structural decisions underneath it, not the choice of feature. Produce a decision record. Do not plan the implementation and do not write code.

**Project.** The Synapse Watcher is a read-only Electron desktop window that observes N git repositories the user has explicitly listed in a config file, and shows what is happening in each. It ships with Synapse as an optional feature and must work for someone who has adopted none of Synapse. The design spec is `docs/superpowers/specs/2026-08-26-synapse-watcher-design.md`; the prior decision record on data arrival is `specs/2026-08-26-watcher-data-arrival.md`. Read both. `CONTEXT.md` at the repo root holds the canonical vocabulary.

**The feature, as the user specified it.** A card on the board that shows what is currently playing on the user's machine and can control it. Explicitly:

- **Reads the system media session** — whatever is already playing, in the Spotify desktop app or in a browser tab playing YouTube. Not an embedded player, not a web embed, no OAuth, no network access.
- **Still image only.** Album/track art as a static image. No video. **Explicitly not animated** — the user's words: "he doesn't have to be animated. It can just have a still image."
- **Text:** track name and artist/band name.
- **Three controls:** previous, play/pause, next. The play/pause control toggles its own glyph on click.
- **A settings toggle** shows or hides the card, persisted in `config.json`.
- **Not requested, do not add:** a progress/scrub bar, volume, seek, playlist browsing, video.

**Options already rejected by the user, do not revive.** A Spotify or YouTube iframe embed in a card (network access, remote content in the renderer, Spotify embeds gate full playback behind a login inside the app's own Electron session). A launcher card that merely opens the playlist in the real app (does nearly nothing).

**Settled constraints from the design spec that bind your answer.**

- Electron; main process is Node. `contextIsolation: true`. All filesystem, git and OS access lives in the main process; the renderer talks over IPC.
- **Read-only, structurally**, §2: "No write path to any watched repository anywhere in the codebase. Not a convention — an absence."
- **§7.1, the motion rule:** every pixel of motion must trace to a fact — an event landed, a process is running, or time moved. Ambient motion that runs regardless of truth is stated to be strictly worse than a static window. The still-image requirement above is what keeps this card compliant.
- **§7.4, added today:** the renderer diffs and mutates the DOM in place rather than rebuilding, because a rebuilt element restarts its CSS animations from frame zero on every poll tick. State drives animation by class, never by re-creating a node.
- **§11a:** the renderer is a pure function of `RepoSnapshot` → DOM and holds no state of its own. This is what keeps every visual decision cheap to change later.
- **§6:** cards fill the window; column count is chosen to maximise card area; nothing ever auto-sorts; position is an index in an order array in `config.json`, never a pixel coordinate.
- **§10:** one six-pixel pointer-movement threshold governs everything. Under it, a card flips or opens an overlay; over it, the card is being dragged to a new position.
- **§10.1:** the complete list of things a user can press was minimise, maximise/restore, close, pin, and per-repository mute. These three transport controls take it to eight.
- **Windows-first.** Architect platform-neutral, test on Windows, do not block on Linux. Linux is a bonus, not a blocker.
- Synapse currently has **no root `package.json`**; your prior decision record already established that the Watcher needs its own package because `chokidar` ends Synapse's zero-dependency property. A second dependency here compounds that, so say so explicitly if you add one.

**The structural questions to decide.**

1. **How the main process reads and controls the system media session, cross-platform.** On Windows this is the `GlobalSystemMediaTransportControlsSessionManager` WinRT surface; on Linux the equivalent is MPRIS over D-Bus. Weigh the realistic mechanisms — a native Node addon (which brings node-gyp, prebuilt binaries, and Electron ABI rebuilds via electron-rebuild), a bundled helper executable the main process spawns and talks to, or any pure-JS path if one genuinely exists. Packaging is already an open question in this project and a native module constrains it, so state the consequence rather than leaving it implied.

2. **How this card relates to `RepoSource` and `RepoSnapshot`.** It is not a repository. Decide whether it gets its own source and snapshot type, whether it is a sibling adapter alongside the Synapse hook enrichment adapter, and how it participates in §6's layout algorithm and the order array without special-casing the renderer. The layout algorithm currently assumes one homogeneous card type.

3. **How the control path stays structurally distinct from the read-only guarantee.** Transport controls are the first write of any kind in this application. They write to the OS media session, never to a repository, so §2's boundary is intact in principle — but §2 claims read-only is an absence rather than a convention, and that claim has to survive the existence of a write path in the codebase. Say how.

4. **Album art transport across IPC.** Raw bytes, a data URL, or a temp file. It must not re-transfer or re-decode on every tick, and it must not push state into the renderer that the main process does not hold (§11a).

5. **Failure modes, and how the card fails soft.** Nothing is playing; no media session is available; the OS surface is missing or unsupported; the native dependency failed to load; Linux has no MPRIS provider running. The hook enrichment adapter is the precedent — it is allowed to fail without taking the window down. Also decide what the card renders when the feature is on but nothing is playing, given the design's standing rule that a clean value renders as absence rather than as text.

6. **The event model.** State whether the media session pushes change events or must be polled, and reconcile that with §4's arrival model and with §7.4's requirement that data changes which animation runs rather than re-triggering a running one. A track change is an event that landed; a card that re-renders on a timer regardless is the ambient-motion failure this design rejects.

**Deliverable.** A decision record covering the above, with rejected options and why, and the consequences the implementation plan will have to honour. Follow this repo's existing convention for where decision records live; `specs/` holds dated design and decision documents. Note explicitly anything you could not verify and that the plan must confirm before relying on.
