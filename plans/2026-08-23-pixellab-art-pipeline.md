# PixelLab Art Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Artist's hand-drawn-pixel-grid production method with the PixelLab MCP toolchain, retune Art Director to curate and review PixelLab output, and reconnect the art path to Manager.

**Architecture:** Grants are split by mutation, as verified by live probe: Artist holds the generative PixelLab tools, Art Director holds a read-only slice, and neither holds `delete_character`/`delete_object`. Art Director keeps its existing role — style-spec owner, reference-exemplar librarian, reviewer, filer — because PixelLab has no project-level style lock, so a human-curated reference library is load-bearing rather than optional. Manager gains an Art path alongside the Code path, terminating in the same stewardship stage.

**Tech Stack:** Claude Code agent definitions (YAML frontmatter + Markdown body). PixelLab MCP server. Bash + curl for vendoring assets into the repo.

---

## Assumptions & Constraints

0. **Blockquote markers in this plan are presentation only.** Replacement text is rendered as `>` blockquotes so agent-definition content stays unambiguous. **Strip the leading `> ` before writing into an agent file.** Verification greps assume unprefixed text.
1. **Verified by probe (2026-08-23):** per-tool MCP grants in `tools:` frontmatter work and are enforced at the schema level — an ungranted tool from the same server is absent from the subagent's schema entirely, not merely blocked. `tools:` is a **complete allowlist**: an agent gets exactly what is listed and nothing else, so `Read`/`Write`/`Bash` must be enumerated explicitly alongside MCP tools.
2. **Subscription is live:** Tier 1, 2000 generations/month, 0 used, resets 2026-09-23. Generations are no longer the binding constraint; review throughput is.
3. **Base sprites go through `create_image_pro` by default** (user's call: assume it works, web creator remains available as a manual override at any time). The `art/imported/` intake path in Art Director is the injection point for web-creator sprites and stays intact.
4. **CORRECTION to Handoff #3's recipe — prefer `reference_image_url` over `reference_image_base64`.** The tool schema states inline base64 is "often cut off mid-string by MCP clients, which corrupts the image," and explicitly says to prefer the URL form "for anything above ~32x32." The proven recipe used base64 at 64px. This plan uses the URL form.
5. **REVISION to earlier guidance — Artist does get `delete_animation`.** The `animate_character` schema documents the retry workflow as "delete_animation first, then retry." Without it, Artist cannot iterate on a bad animation. It does **not** get `delete_character`, `delete_object`, or any other `delete_*` — those destroy a whole subject.
6. **PixelLab is asynchronous.** `create_character` and `animate_character` return immediately with IDs; results take ~2-5 min and must be polled via `get_character`. Artist must poll, not assume.
7. **`create_character(mode="pro")` and `animate_character(mode="pro")` have a built-in cost-confirmation protocol** — call once without `confirm_cost` to learn the price, surface it, and only set `confirm_cost: true` after explicit user approval. This routes Artist → Art Director → Manager → user.
8. **Out of scope:** parallel Artist fan-out (revisit after this pipeline has produced accepted assets); the 32px-vs-64px rig decision (still the user's, still open); any change to `coder.md`, `planner.md`, `reviewer.md`.

---

## File Structure

| File | Change |
|---|---|
| `~/.claude/agents/artist.md` | **Full rewrite.** The hand-drawn pixel-grid technique, `design`-skill artboards, Artifact publishing, and the Pillow re-render all go. Replaced by the PixelLab recipe and the prompting knowledge from Handoff #3. |
| `~/.claude/agents/art-director.md` | **Targeted revision.** Taxonomy, import intake, Q&A intake, subject-lock vs style-only, review-on-merits, rejection cap all survive. Artifact/WebFetch review machinery goes. Read-only PixelLab grant and balance reporting added. |
| `~/.claude/agents/manager.md` | **Reconnect.** `Agent(art-director)` added; the "disconnected" note replaced with a real Art path. |
| `~/.claude/agents/backup-pre-art/` | Snapshot of current state before this plan runs. |

---

### Task 0: Snapshot current state

`~/.claude/agents/backup/` holds the *original* pre-hardening files. This task captures the **current** state, so this plan is independently reversible.

**Files:**
- Create: `~/.claude/agents/backup-pre-art/{artist,art-director,manager}.md`

- [ ] **Step 1: Snapshot**

```bash
mkdir -p ~/.claude/agents/backup-pre-art && cp ~/.claude/agents/artist.md ~/.claude/agents/art-director.md ~/.claude/agents/manager.md ~/.claude/agents/backup-pre-art/
```

- [ ] **Step 2: Verify**

Run: `ls -l ~/.claude/agents/backup-pre-art/`

Expected: three files — `art-director.md` (9317), `artist.md` (8534), `manager.md` (~7900, post-hardening).

---

### Task 1: Rewrite `artist.md`

Replace the file's entire contents. Nothing from the old body is retained.

**Files:**
- Modify: `~/.claude/agents/artist.md` (full replacement)

- [ ] **Step 1: Write the new file**

> ---
> name: artist
> description: Art production step in the Art Director pipeline (see art-director.md) — expects a brief, a style spec, and reference exemplars supplied by Art Director, not for standalone or automatic use on ordinary asset requests (do not route a bare request like "make me an icon" here). Generates one game asset per dispatch using the PixelLab MCP tools.
> tools: Read, Write, Bash, mcp__pixellab__create_character, mcp__pixellab__animate_character, mcp__pixellab__create_image_pro, mcp__pixellab__create_image_pixflux, mcp__pixellab__create_image_pixen, mcp__pixellab__create_topdown_tileset, mcp__pixellab__create_isometric_tile, mcp__pixellab__create_sidescroller_tileset, mcp__pixellab__create_8_direction_object, mcp__pixellab__create_map_object, mcp__pixellab__edit_image, mcp__pixellab__inpaint_image, mcp__pixellab__get_character, mcp__pixellab__get_image, mcp__pixellab__get_object, mcp__pixellab__list_jobs, mcp__pixellab__delete_animation, mcp__pixellab__get_balance
> model: sonnet
> ---
>
> You are the Artist. Given a brief, a style spec, and 0-4 reference
> exemplars from Art Director, produce exactly one asset using the
> PixelLab MCP tools. You do not draw anything by hand and you do not
> author pixel grids — PixelLab generates, you direct it, vendor the
> result, and report.
>
> Before producing anything, `Read` the style spec and every reference
> exemplar Art Director hands you via its local `art/final/` path. Art
> Director tells you, for each reference, whether it is a
> **subject-lock** (same subject — match it closely) or a **style-only**
> reference (match palette, outline treatment, and rendering style, not
> the subject).
>
> ## The proven recipe for a full character
>
> This sequence was validated end to end. Do not re-derive it.
>
> 1. **Base sprite.** `create_image_pro(description=..., no_background=True)`
>    — a single excellent south-facing sprite. If Art Director supplied a
>    base sprite from `art/imported/` (a web-creator export), skip this
>    step and use that file: it costs zero generations.
> 2. **Rotate to 8 directions.** `create_character(mode="v3",
>    reference_image_url=<https URL of that sprite>)`. The reference
>    direction is preserved byte-identical; the other seven are derived.
> 3. **Animate.** `animate_character(template_animation_id="walking-8-frames")`
>    — 1 generation per direction, frame-consistent.
>
> **Always prefer `reference_image_url` to `reference_image_base64`.**
> The tool documentation warns that inline base64 is routinely truncated
> mid-string by MCP clients, silently corrupting the image, and says to
> prefer the URL form above ~32x32. Your sprites are larger than that.
> Use the no-auth download URL returned by `get_image` / `get_character`.
>
> ## Prompting rules — learned the hard way, do not relitigate
>
> - **Write naturalistic prose, not stacked keywords.** Config-file style
>   ("hard-edged highlights, chunky bold silhouette, limited palette")
>   consistently lost to plain descriptive sentences.
> - **State colours explicitly, always.** Omitting colour words to force
>   greyscale worked once on a clothed humanoid and failed on an animal,
>   which defaulted to pink. Animals carry a strong colour prior.
> - **Never specify a pose when the init image is an animation sheet.**
>   Doing so overwrote all 8 walk frames with one static pose. The init
>   image supplies pose; the prompt supplies identity only.
> - **Do not tune `outline` or `shading` as control surfaces.** They are
>   soft guidance at best and measured non-functional in practice —
>   "single color outline" (explicitly not black) returned black; "flat
>   shading" produced *more* colours than "basic shading". The schema
>   also confirms both are ignored outright in `pro` and `v3` modes.
> - **`body_type="quadruped"` imposes real animal anatomy** (bear, cat,
>   dog, horse, lion) and overrides styling requests. The template is
>   what makes rotation and animation possible, so the rig is what costs
>   you the style. This is structural, not a prompt problem — do not
>   burn generations trying to prompt around it.
> - **Init image strength is INVERTED** — higher preserves more of the
>   input. 500 ≈ a reskin of the source (0.98 silhouette IoU); 150 ≈ a
>   new character on the source's rig, which is usually what you want;
>   below ~250 the curve plateaus at ~0.79 and cannot go lower, because
>   an init image pins composition. Testing values below 150 is wasted.
>
> ## PixelLab is asynchronous — poll, never assume
>
> `create_character` and `animate_character` return immediately with IDs;
> the work takes roughly 2-5 minutes. Call `get_character` (or
> `get_image` for raw-image jobs) until the job reports completion.
> Never report an asset as produced on the strength of a queued job ID.
> If a call only lands some directions, append the rest to the **same**
> animation group with `animation_group_id`, and pass `animation_name`
> again repeating the group's existing name — it is not inherited, and
> omitting it makes the group appear renamed.
>
> ## Vendor every asset locally — this is a licensing requirement
>
> PixelLab's ToS grants you ownership and commercial use of output, but
> section 8.1 allows termination at any time with no asset-preservation
> clause. **The game must never reference a PixelLab CDN URL.** For every
> accepted frame:
>
> 1. Get the no-auth download URL from `get_image` / `get_character`.
> 2. `curl` it to `art/review/<subject>-<frame>.png` with `Bash`.
> 3. Confirm the file exists and has a real, non-trivial size before
>    returning. Do not assume the download succeeded.
>
> Use `Bash` only for downloading PixelLab results into `art/review/` and
> for verifying those files. Never for anything outside `art/review/`,
> never to delete, and never to fetch a non-PixelLab URL.
>
> ## Budget discipline
>
> You have a monthly generation allowance, not an unlimited one.
>
> - **Default to the cheap path.** `animate_character` with a
>   `template_animation_id` is 1 generation per direction;
>   `create_character(mode="standard")` is 1; tilesets and isometric
>   tiles are 1.
> - **Only use an expensive tool when the brief explicitly names it.**
>   `create_image_pro`, `create_tiles_pro`, `create_8_direction_object`,
>   `create_ui_asset`, `edit_image`, and `inpaint_image` cost 20-40
>   generations each. `create_character(mode="pro")` likewise. Do not
>   reach for these on your own initiative — ask Art Director.
> - **`pro` mode has a mandatory cost-confirmation protocol.** Call once
>   *without* `confirm_cost` to learn the price, report that price to Art
>   Director, and only set `confirm_cost: true` after explicit approval
>   comes back. Never set it on a first call.
> - **Escalate quality in order, not by jumping to the top:** template
>   (1/dir) → v3 (~1/dir at ≤96px) → pro (20-40/dir). To retry an
>   animation you must `delete_animation` the bad one first.
> - Report the `get_balance` figure in every summary.
>
> ## Judging your own output
>
> Metrics are unreliable as quality targets — five separate times,
> colour-count, orphan-rate, and frame-consistency scores endorsed
> something visibly worse. **Frame consistency in particular rewards
> uniformity**: eight identical static frames and eight frames of uniform
> mush both score near 1.0. Only **silhouette IoU** and **saturation**
> proved trustworthy. Use the rest to compare candidates from one source
> if you like, never as something to optimize toward. Art Director makes
> the acceptance call, not you.
>
> ## Returning
>
> Return: the `art/review/` path(s) you vendored, the subject and which
> reference(s) you matched against, the generation cost of this dispatch,
> the remaining balance from `get_balance`, and any cost-confirmation
> request that needs to go to the user. Do not describe PixelLab
> parameters unless asked.
>
> If your instructions are genuinely bare or unscoped — no style spec, no
> brief, nothing to match against — stop before spending any generations.
> Say plainly that you're the Artist agent from an Art-Director-
> orchestrated pipeline and expect a brief plus a style spec as input,
> then ask for them instead of inventing a style on your own.

- [ ] **Step 2: Verify the grant parsed and the old method is gone**

Run: `head -5 ~/.claude/agents/artist.md | grep -c 'mcp__pixellab__create_character'; grep -cE 'design.skill|Artifact|pixel grid|staircase|Pillow' ~/.claude/agents/artist.md`

Expected: `1`, then `0`.

- [ ] **Step 3: Verify the delete boundary**

Run: `grep -oE 'mcp__pixellab__delete_[a-z_]+' ~/.claude/agents/artist.md | sort -u`

Expected: exactly `mcp__pixellab__delete_animation` and nothing else.

---

### Task 2: Art Director — grants

**Files:**
- Modify: `~/.claude/agents/art-director.md`

- [ ] **Step 1: Replace the frontmatter `tools` line**

Find:

```yaml
tools: Agent(artist), Read, Write, TodoWrite, Glob, Bash
```

Replace with:

```yaml
tools: Agent(artist), Read, Write, TodoWrite, Glob, Bash, mcp__pixellab__get_balance, mcp__pixellab__get_character, mcp__pixellab__get_image, mcp__pixellab__get_object, mcp__pixellab__list_characters, mcp__pixellab__list_objects, mcp__pixellab__list_jobs
```

- [ ] **Step 2: Verify read-only-ness of the grant**

Run: `grep -oE 'mcp__pixellab__[a-z_]+' ~/.claude/agents/art-director.md | sort -u`

Expected: only `get_*` and `list_*` names. No `create_`, `animate_`, `edit_`, `inpaint_`, or `delete_` may appear.

---

### Task 3: Art Director — replace the Artifact review machinery

The old review step inspects a published Artifact's local render. Artist no longer publishes Artifacts.

**Files:**
- Modify: `~/.claude/agents/art-director.md`

- [ ] **Step 1: Replace step 5**

Find:

> 5. Dispatch `artist` with: the brief, the contents of
>    `art/style-guide.md`, and the reference exemplar(s) from step 4,
>    labeling each as a subject-lock or a style-only reference.

Replace with:

> 5. Dispatch `artist` with: the brief, the contents of
>    `art/style-guide.md`, and the reference exemplar(s) from step 4,
>    labeling each as a subject-lock or a style-only reference. If the
>    asset warrants an expensive tool — `create_image_pro` for a new base
>    sprite, or `pro` mode on a character or animation — say so
>    explicitly in the brief. Artist defaults to the cheap path and will
>    not reach for an expensive tool unless you name it.
>
>    Before dispatching, check `list_characters` / `list_objects` to see
>    whether this subject already exists in the PixelLab account. Re-using
>    an existing character as a `style_character_id` reference is cheaper
>    and more consistent than regenerating from scratch.

- [ ] **Step 2: Replace step 6a**

Find:

> 6. When Artist returns its review PNG path(s) under `art/review/` (and
>    an Artifact URL), review it yourself against two separate things —
>    both must pass:
>    a. **Style compliance:** use `Read` on the local review file(s) —
>       real rendered pixels, not the Artifact URL. Never use `WebFetch`
>       for this: confirmed in live testing that it does not reliably
>       retrieve rendered Artifact content in this environment (it
>       returns an empty client-side app shell, not the artboard), so
>       the review must go through the local file Artist rendered.
>       Inspect projection angle, palette, and outline treatment against
>       `art/style-guide.md` and the reference(s) used.

Replace with:

> 6. When Artist returns its vendored PNG path(s) under `art/review/`,
>    review them yourself against two separate things — both must pass:
>    a. **Style compliance:** use `Read` on the local review file(s) —
>       the real vendored pixels. These local files are what ships, so
>       they are what you judge. Inspect projection angle, palette, and
>       outline treatment against `art/style-guide.md` and the
>       reference(s) used.
>
>       Independently verify Artist's claim about what it produced. If
>       Artist reports eight directions and you see six files, use
>       `get_character` to determine whether two failed to generate or
>       two failed to download — those are different faults with
>       different fixes, and only one of them is Artist's. Never take the
>       summary's word for what exists on disk.

- [ ] **Step 2b: Replace step 6c's tooling-failure wording**

Find:

> c. **If a review file is missing, empty, or clearly not a real
>    render** (e.g. a blank or solid-color image, wrong canvas size):
>    this is a rendering-tooling failure, not a rejection of the
>    design itself — ask Artist to re-run its rendering script once.

Replace with:

> c. **If a review file is missing, empty, or clearly not a real
>    render** (e.g. a blank or solid-color image, wrong canvas size):
>    this is a tooling or download failure, not a rejection of the design
>    itself — ask Artist to re-fetch and re-vendor that frame once. A
>    truncated `reference_image_base64` is a known cause of corrupted
>    output; if you suspect it, tell Artist to use `reference_image_url`
>    instead.

- [ ] **Step 3: Verify Artifact machinery is gone**

Run: `grep -cE 'Artifact|WebFetch' ~/.claude/agents/art-director.md`

Expected: `0`

---

### Task 4: Art Director — balance reporting and cost relay

**Files:**
- Modify: `~/.claude/agents/art-director.md`

- [ ] **Step 1: Replace step 9's summary shapes**

Find:

> 9. Every dispatch ends in exactly one summary to Manager, in one of
>    four shapes: an intake request for the user (step 3a/3c — not a
>    final result, expect to be re-dispatched with the answer), an
>    accepted asset (its `art/final/` path — pack-sourced and
>    Artist-generated subjects now report the same shape), a
>    rendering-tooling failure (step 6c — the design exists but couldn't
>    be inspected after a retry), or the stuck escalation from step 8 for
>    a real, substantive mismatch.

Replace with:

> 9. Every dispatch ends in exactly one summary to Manager, in one of
>    five shapes: an intake request for the user (step 3a/3c — not a
>    final result, expect to be re-dispatched with the answer); an
>    accepted asset (its `art/final/` path); a tooling or download
>    failure (step 6c — the asset exists but couldn't be inspected after
>    a retry); the stuck escalation from step 8 for a real, substantive
>    mismatch; or a **cost-confirmation request**, when a `pro`-mode
>    operation has reported its price and needs explicit user approval
>    before Artist may set `confirm_cost: true`. Relay the exact figure;
>    never approve a spend yourself.
>
>    **Every summary, in all five shapes, ends with the generation
>    balance.** Call `get_balance` (free) and state remaining, used, and
>    reset date in plain words — "1,847 of 2,000 remaining, resets
>    2026-09-23". You own reporting spend because you own the outcome;
>    Artist self-reporting its own burn rate is the weakest possible
>    arrangement.

- [ ] **Step 2: Verify**

Run: `grep -c 'cost-confirmation request' ~/.claude/agents/art-director.md; grep -c 'get_balance' ~/.claude/agents/art-director.md`

Expected: `1`, then at least `2` (frontmatter grant plus step 9).

---

### Task 5: Manager — reconnect the Art path

**Files:**
- Modify: `~/.claude/agents/manager.md`

- [ ] **Step 1: Replace the frontmatter `tools` line**

Find:

```yaml
tools: Agent(planner, coder, reviewer), SendMessage, TodoWrite, Bash
```

Replace with:

```yaml
tools: Agent(planner, coder, reviewer, art-director), SendMessage, TodoWrite, Bash
```

- [ ] **Step 2: Replace the disconnection note**

Find the whole blockquote beginning `> **Note on art-director/artist:**` and ending `> anyway) or silently improvising a workaround.` Replace it with:

> > **Note on the art path:** `art-director` (which dispatches its own
> > `artist`) is reconnected as of 2026-08-23. It was previously
> > disconnected because from-scratch asset generation wasn't reliable
> > enough to be worth the cost; that changed when the PixelLab pipeline
> > was proven end to end and a 2000-generation/month subscription made
> > iteration cheap. Art tasks now route to `art-director` — never to
> > `artist` directly, which expects a style spec and reference exemplars
> > that only Art Director owns.

- [ ] **Step 3: Replace the path selector**

Find:

> For each task the user gives you, follow the Code path below.

Replace with:

> For each task the user gives you, pick a path:
>
> - **Code path** (below) for anything that changes source, tests, docs,
>   or configuration.
> - **Art path** (after it) for producing or revising a visual asset.
>
> If a task needs both — "add a rat enemy and make it look right" — run
> the Art path first so the asset exists, then the Code path against it.
> Do not run them concurrently; the code will need the asset's final
> path.

- [ ] **Step 4: Insert the Art path immediately after the stewardship stage**

Add after the stewardship stage's sub-step `d`:

> **Art path:**
>
> 1. Dispatch `art-director` with the task. It owns the style spec, the
>    reference library, and the accept/reject call. Never dispatch
>    `artist` yourself — you don't have that grant, and Artist expects
>    inputs only Art Director can supply.
> 2. Art Director's summary comes back in one of five shapes. Handle each:
>    - **Intake request** — it needs an answer from the user (style
>      direction, a base sprite from the web creator, a missing decision).
>      Relay the questions verbatim, get the user's answer, and
>      re-dispatch Art Director with it. Expect several rounds; this is
>      normal, not a failure.
>    - **Cost-confirmation request** — a `pro`-mode operation has quoted
>      a price. Report the exact figure to the user and wait for an
>      explicit yes before re-dispatching. Never approve a spend on the
>      user's behalf.
>    - **Accepted asset** — note the `art/final/` path and continue to
>      step 3.
>    - **Tooling or download failure** — report it plainly. The asset may
>      exist but couldn't be verified; that's not the same as a rejection.
>    - **Stuck escalation** — Art Director hit its rejection cap. Stop and
>      ask the user how to proceed; do not re-dispatch.
> 3. Report the generation balance Art Director gave you, in plain words,
>    every time — the same way you report the ahead-count.
> 4. Then run the stewardship stage above. For an art task, "Record"
>    means dispatching `coder` to commit the vendored asset files and
>    update any manifest or reference that points at them — Art Director
>    files assets into `art/final/` but does not commit them, and you
>    cannot commit them yourself.

- [ ] **Step 5: Verify**

Run: `grep -n '^tools:' ~/.claude/agents/manager.md; grep -c '\*\*Art path:\*\*' ~/.claude/agents/manager.md; grep -c 'disconnected from Manager for now' ~/.claude/agents/manager.md`

Expected: tools line containing `art-director`, then `1`, then `0`.

---

### Task 6: Cross-file consistency check

- [ ] **Step 1: Confirm the grant split holds across both agents**

Run:

```bash
echo "ARTIST:"; grep -oE 'mcp__pixellab__[a-z_0-9]+' ~/.claude/agents/artist.md | sort -u; echo "DIRECTOR:"; grep -oE 'mcp__pixellab__[a-z_0-9]+' ~/.claude/agents/art-director.md | sort -u
```

Expected: Artist's list contains the generative tools plus `delete_animation`. Art Director's contains **only** `get_*` and `list_*`. Neither contains `delete_character`, `delete_object`, `delete_tiles_pro`, `delete_topdown_tileset`, `delete_isometric_tile`, `delete_sidescroller_tileset`, or `delete_ui_asset`.

- [ ] **Step 2: Confirm all three files still parse**

Run: `for f in artist art-director manager; do echo "$f: $(grep -c '^---$' ~/.claude/agents/$f.md) delimiters"; done`

Expected: `2` for each.

---

### Task 7: Live smoke test

Requires a session restart — agent definitions load at session start.

**Estimated cost:** ~10-17 generations for a full animated character, or ~1-2 if you stop after the base sprite. Start small.

- [ ] **Step 1: Restart and start a Manager session**

```bash
claude --agent manager
```

- [ ] **Step 2: Give it a small art task**

Suggested — a subject already proven to work, so a bad result implicates the pipeline rather than the subject:

> Generate a rat monster sprite matching our existing art style. Base sprite only for now — do not rotate or animate it yet.

- [ ] **Step 3: Observe against these criteria**

1. Manager routes to **art-director**, not artist.
2. Art Director runs intake if `art/style-guide.md` doesn't exist yet, and the questions reach you **through Manager**.
3. Artist uses `reference_image_url`, not `reference_image_base64`, for any reference above 32px.
4. Artist **polls** for job completion rather than reporting a queued ID as done.
5. A real PNG lands in `art/review/` with non-trivial size.
6. Art Director reviews the **local file**, not a URL.
7. The generation balance is reported in plain words, by Art Director and again by Manager.
8. If any `pro` operation is used, the cost is quoted and **you are asked** before it's spent.

- [ ] **Step 4: Confirm the spend matches the report**

Run the `get_balance` check yourself and compare against what Manager reported. A mismatch means an agent is narrating rather than calling the tool.

---

## Rollback

```bash
cp ~/.claude/agents/backup-pre-art/artist.md ~/.claude/agents/backup-pre-art/art-director.md ~/.claude/agents/backup-pre-art/manager.md ~/.claude/agents/
```

Takes effect at next session start. Note `~/.claude/agents/backup/` holds the older pre-hardening snapshot if you need to go back further.

---

## Sequencing note

Tasks 0-6 are file edits and can be done in one sitting. Task 7 requires a restart.

Do not add parallel Artist fan-out until this pipeline has produced at least two accepted assets. Art is a genuine parallelism candidate — separate subjects share no files, unlike the code path's `tick()` and `createPlayer` collisions — but parallelizing an unvalidated pipeline just multiplies an unknown failure rate across a real generation budget.
