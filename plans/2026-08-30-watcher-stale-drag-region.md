# Plan — the drag border dies when a card flips (task 22, half one / R46)

**Date:** 2026-08-30
**Task:** `watcher/docs/DISPATCH-QUEUE.md` § *"22 — the drag border dies, and the
board menu is unreachable"*, **half one only**.
**Record of the defect:** `docs/REVIEW-QUEUE.md`, item `R46`.
**Decision record supplied by Manager:** none. This plan was written against
`R46` and the queue entry directly.

    FOOTPRINT:
    plans/2026-08-30-watcher-stale-drag-region.md
    watcher/src/renderer/index.html
    watcher/src/renderer/styles.css
    watcher/src/renderer/discipline.test.mjs

---

## 0. Scope, and what this plan deliberately does not do

**Half one only.** `R42` — the board menu's reachability on a full board, and
the choice of surface for it — is **half two**, it carries a decision that is
Karl's, and nothing below scopes it, prices it, estimates it, or leans toward
any of the three options on the table. The fix here happens to sit near that
ground; it is still left alone.

**`context-menu.mjs` is not touched.** Diagnostic 4 in `R46` closed on
2026-08-31: on a band that is genuinely a drag region *the popup never runs* —
no menu, no flash. `installContextMenu`, `popContextMenu` and the
`preventDefault` line in the `system-context-menu` handler are not where this
defect lives. Neither are `menu-items.mjs` or `contextTarget`. None of them
appear in the footprint, and a fix that lands in any of them has re-opened a
closed diagnostic.

**Reuse check: not applicable, and here is why.** The trigger for a
prior-art sweep is net-new capability. This is a defect in a stylesheet and a
static markup file the project already owns, with no library, package or
portable implementation that could supply it. No Explore agent was spent on
that question.

**Documentation read before planning.** `watcher/docs/README.md` is the area
index and was read, along with the documents it names that bear on the frame:
`2026-08-26-synapse-watcher-design.md` §10.1,
`2026-08-27-watcher-interaction-model.md` §3,
`2026-08-27-watcher-alert-predicate-and-edge-marker.md` decision 5,
`2026-08-28-watcher-empty-state-plan.md` steps 10–11, and
`2026-08-30-watcher-board-menu-reachability.md` (the 2026-08-30 amendment).
Two index gaps noted in passing and **not fixed here**: the reachability record
and the empty-state plan are both absent from `watcher/docs/README.md`.

---

## 1. What is actually broken

`#frame` declares `-webkit-app-region: drag` and `#board`, its in-flow child
inset by `padding: var(--frame-width)`, declares `-webkit-app-region: no-drag`.
The window's drag border is therefore not an element — it is an **arithmetic
result**: the frame's rectangle minus every `no-drag` rectangle collected after
it. `#frame` is the only way to move this window; `window-options.mjs` uses
`titleBarStyle: 'hidden'`, so there is no title bar and no caption.

Flipping a card adds one class. Its entire effect is:

    .card.flipped {
      transform: rotateY(180deg);
    }

on an element that already carries `transform-style: preserve-3d`. After that
class lands, the frame band directly above that card stops being a drag region
and becomes ordinary client area — which is why `contextTarget` then sees it,
returns `kind:'board'`, and the board menu pops through the renderer route.

**The menu is the side effect. The defect is that a slice of the only drag
border this window has silently stops working**, with no visual change and no
way for a user to know why. That is live on every window the app opens.

### 1a. A correction to `R46` that the code forces, and it matters

`R46`'s mechanism paragraph says *"nothing restores it until a re-layout"* and
offers as evidence: choose **All cards back to the grid**, and the band works
again. **That evidence is confounded, and the confound is visible in the
source.** `returnToGrid` in `watcher/src/main/main.mjs` is:

    const returnToGrid = () => {
      if (win.isDestroyed()) return
      store.record({ placements: [] })
      win.webContents.once('did-finish-load', push)
      win.reload()
    }

It is a **full renderer reload**, not a mutation. The DOM is the only store of
flip state — `renderer.mjs` says so: *"a flipped card IS
card.classList.contains('flipped')"* — so the reload destroys every `flipped`
class along with the layout. The band therefore recovers under **two**
simultaneous changes, and `R46`'s repro cannot say which one did it:

- **(A) staleness** — the region was computed once, wrongly, and any re-layout
  recomputes it correctly even while the card stays flipped; or
- **(B) the flipped card genuinely contributes a wrong rectangle** for as long
  as it is flipped, and what fixed it was the card ceasing to be flipped.

**This plan does not need to know which.** The fix below is correct under both,
and §3 says why. But the record should not go on asserting a mechanism its own
repro cannot distinguish, and a later session reading *"a re-layout restores
it"* would reasonably reach for a fix that only works under (A).

**Not fixed here.** `docs/REVIEW-QUEUE.md` belongs to its owner and is not in
the footprint. This is reported to Manager for relay.

### 1b. Two fixes that look obvious and are both wrong

Recorded so nobody re-derives them.

- **Remove `transform-style: preserve-3d` from `.card`.** Tempting, because
  there is no `perspective` declaration anywhere in the renderer, so the
  rotation is orthographic and `preserve-3d` looks like it buys nothing. **It
  breaks the flip.** `.face { backface-visibility: hidden }` is what shows one
  face and hides the other, and it can only be evaluated against the card's
  accumulated rotation inside a 3D rendering context. Flatten the card and
  `.back` — which carries its own `rotateY(180deg)` — is hidden always and
  `.front` is shown mirrored always.
- **Force a re-layout when a card flips.** Only works under reading (A) above,
  which is unproven; and it fights a stated design decision — `renderer.mjs`
  deliberately avoids promoting on `pointerdown` precisely so that *"the single
  most common gesture in the app, tap-to-flip"* does not reflow the board.

---

## 2. The fix

**Re-assert the drag band as the last thing inside `#frame`, using the same
idiom `#frame` itself uses.** Two new absolutely-positioned, transparent,
pointer-transparent elements appended as the final children of `#frame`:

- `#drag-band` — `inset: 0` (the full window), `box-sizing: border-box`,
  `padding: var(--frame-width)`, `-webkit-app-region: drag`.
- `#drag-band-inset` — its only child, `height: 100%`,
  `-webkit-app-region: no-drag`.

Both carry `pointer-events: none`.

Net effect on the region arithmetic: whatever any card contributed earlier, the
last two entries collected are *"the whole window drags"* followed by *"the
client rectangle does not"*. The band is restored to exactly the shape it is
supposed to have, computed from two elements that never move, never flip and
never scroll.

`#frame` **keeps** its own `-webkit-app-region: drag` and `#board` keeps
`no-drag`. This change is purely additive; nothing existing is removed or
weakened, and both declarations remain pinned by their existing
`discipline.test.mjs` guards.

---

## 3. Why this shape, and why it does not re-open a settled decision

**Read this section before writing the markup.** `index.html`'s frame comment
argues in capitals that `#frame` is *"a WRAPPER rather than four positioned edge
strips"*, and gives three reasons. Those three reasons are why this plan does
**not** add four edge strips. Each is satisfied by construction here:

1. *"The ancestor hazard … is closed by ONE declaration, not by every
   descendant."* — `#drag-band-inset` is one declaration covering the whole
   client rectangle, exactly as `#board`'s is.
2. *"§10.1 requires the frame to sit OUTSIDE the scroll container … Fixed strips
   would sit over that scrollbar."* — `#drag-band-inset` is inset by
   `var(--frame-width)`, the identical value that insets `#board`, so its
   `no-drag` rectangle coincides with `#board`'s box. The drag area never
   reaches `#board`'s scrollbar. `R46` establishes this geometry independently.
3. *"§10.1 requires the frame to be four-sided and continuous. One padding value
   covers the corners by construction; four strips are four rules that can
   disagree by a pixel."* — this is one padding value, on one element.

And it satisfies §10.1's deeper requirement better than the current code does:
*"a fixed border whose width does not change … so the gesture means one thing
always."* After this change the band's shape stops depending on board state at
all.

**It does contradict the letter of one line**, and Coder must not paper over it:
`index.html` says *"THE ONE THING NOT TO DO: do not add a sibling of #board
inside #frame without giving it `-webkit-app-region: no-drag`."* `#drag-band` is
a `drag` sibling of `#board`, deliberately, because re-asserting the band is the
entire point. **Step 5 amends that comment in place** so the next reader finds
the exception stated rather than apparently violated.

**Why it is correct under both readings in §1a.** The collection is an ordered
sequence of add/subtract operations — that ordering is precisely what makes
`#board`, a descendant collected after `#frame`, able to subtract from it, which
is the behaviour the whole app already relies on. `#drag-band` is collected last
under any ordering, and it overlaps no other element. So whether the wrong
rectangle is a stale snapshot or a live mis-mapping, it is overwritten.

**Why empty transparent elements still count.** `#frame` declares no background
of its own — the background lives on `html` — and its drag region works today.
That is the app's own evidence that a layout box with no painted content still
contributes a region.

**The one real risk, named.** `pointer-events: none` is load-bearing and is
required: without it `#drag-band-inset` sits on top of the entire client area
and swallows every click, flip, drag and resize. The assumption is that
`pointer-events` does not affect region collection, which walks layout boxes.
If the manual check in step 7 shows the band still dying **and** gestures
working normally, that assumption is the first thing to re-test — by
temporarily removing `pointer-events: none` and confirming the band survives
while the app becomes unusable. That is a diagnostic, not a shippable state.

---

## 4. Naming

`GLOSSARY.md` has no entry for the frame band, and this plan does not add one —
the glossary states terms are added when contested, not pre-emptively. **band**
is the word `R46` and the queue entry both use throughout, and `inset` is the
word the design records use for the sanctioned way of keeping a `no-drag`
sibling out of the border (*"inset by `--frame-width` so it never holes the drag
border"*). Hence `#drag-band` and `#drag-band-inset`.

---

## 5. Steps

### Step 1 — commit this plan

Commit **`plans/2026-08-30-watcher-stale-drag-region.md`** at that exact path,
before any other step.

- **This step has no tests to wait for.** The standing rule to commit once a
  task's tests pass does not apply: a plan commit has no tests. Do not wait for
  a green run here.
- Commit type `docs(plan):`. The suite is untouched by this step.
- Stage only that one path.
- Sign the commit with the `Session:` trailer value **your dispatcher gave
  you**. Do not infer it and do not copy a value from any document.

### Step 2 — the guards, written first and failing (RED)

All in `watcher/src/renderer/discipline.test.mjs`, following that file's
existing idiom exactly: `readFileSync` of `styles.css` / `index.html` and
assertions over the text. Add these tests **before** steps 3 and 4, and confirm
they fail.

**Say plainly, in each new test's own comment, what these assert.** They assert
that a declaration is *present in the source*, and nothing more. They cannot
observe a drag region, a popup, or a window moving — no test in this repo can,
and every existing CSS guard in this file carries the same disclaimer (*"jsdom
performs NO LAYOUT … What this pins is the rule against silent deletion"*).
These are anti-deletion guards, not acceptance. Acceptance is step 7.

1. **`#drag-band` declares drag.** `/#drag-band\s*\{[^}]*-webkit-app-region:\s*drag/`
   over `styles.css`. Note for the writer: `\s*\{` immediately after the
   selector is what stops this also matching the `#drag-band-inset` block, and
   `-webkit-app-region:\s*drag` does not match `no-drag`. Keep both anchors.
2. **`#drag-band-inset` declares no-drag.**
   `/#drag-band-inset\s*\{[^}]*-webkit-app-region:\s*no-drag/`. This is the
   "THE LOAD-BEARING ONE" pattern the file already applies to `#board`,
   `.edge-marker` and `#empty-state` — copy their naming and their comment
   style.
3. **Both declare `pointer-events: none`.** Two assertions, one per block. Give
   these the loudest comment of the set: without them the window is unusable
   and no other test in the suite would notice.
4. **`#drag-band` is inset by the frame width.** Assert `padding:
   var(--frame-width)` and `box-sizing: border-box` inside the `#drag-band`
   block. This is what keeps the drag area off `#board`'s scrollbar (§3
   reason 2).
5. **Both ids exist in `index.html`.** Text assertions for `id="drag-band"` and
   `id="drag-band-inset"`.
6. **`#drag-band` is the LAST element child of `#frame`.** This is the
   assertion that protects the whole fix — the re-assertion only works because
   it is collected last. Parse the shipped `index.html` with `jsdom` (a
   devDependency, already used by the neighbouring renderer tests; the
   "no jsdom import" rule in this same file scans **non-test** renderer sources
   and does not apply to a test file) and assert
   `document.getElementById('frame').lastElementChild.id === 'drag-band'`.
   Comment it with *why* order is load-bearing, or a future tidy-up will move
   the element and the suite will look arbitrary.
7. **`#drag-band-inset` is the only child of `#drag-band`.** Same jsdom parse.
   Cheap, and it stops anything being parked inside a full-window drag element.

Both new CSS rules must each stay a **single rule block** — every scoped regex
in this file uses `[^}]*`, which cannot cross a closing brace. That constraint
already binds `#board`, `#frame`, `.card`, `.edge-marker` and `#empty-state`.

### Step 3 — the markup

In `watcher/src/renderer/index.html`, append as the **final children of
`#frame`**, after `#alert-below`:

    <div id="drag-band"><div id="drag-band-inset"></div></div>

Static markup, like every other sibling of `#board` — creating it at runtime
would put node insertion into `renderer.mjs` and lengthen the two-file
allowlist `discipline.test.mjs` calls a design decision.

### Step 4 — the styles

In `watcher/src/renderer/styles.css`, two new rule blocks. Place them after the
`#empty-state` rules, so file order matches DOM order.

    #drag-band {
      position: absolute;
      inset: 0;
      box-sizing: border-box;
      padding: var(--frame-width);
      pointer-events: none;
      -webkit-app-region: drag;
    }

    #drag-band-inset {
      height: 100%;
      pointer-events: none;
      -webkit-app-region: no-drag;
    }

`inset: 0` resolves against `#frame`'s padding box, which **includes** its
padding — the same fact that makes `.edge-marker` write
`top: var(--frame-width)` to reach the content edge. So `#drag-band` covers the
whole window, as intended.

No background, no border, no content, no transition, no animation.

### Step 5 — amend the frame comment in `index.html`

Extend the existing frame comment so the next reader finds the exception
stated. It must say, in the file's own voice:

- the drag border is an arithmetic result, not an element, and a card's flip
  transform was observed to corrupt it (cite `R46` in `docs/REVIEW-QUEUE.md` and
  this plan by path — **not by line number**);
- `#drag-band` is a deliberate `drag` sibling of `#board`, the single exception
  to the rule stated immediately above it, and why: it is collected last, so it
  restores the band whatever came before;
- `#drag-band-inset` is what keeps the rule's substance — one declaration
  covering the whole client rectangle;
- `pointer-events: none` on both is load-bearing and silent if removed;
- the three reasons for a wrapper over four strips are unchanged and still
  hold — this is that same wrapper idiom applied a second time, not strips.

### Step 6 — mechanical verification

    npm --prefix watcher test
    node --test scripts/*.test.mjs

Both must be green. The new guards from step 2 must now pass.

**Watch for these two scanner hazards while writing comments** — both fail
loudly but confusingly, and both are cheap to avoid:

- `watcher/src/read-only.test.mjs` scans `.css` and `.html` too, by plain
  substring, **including inside comments**. Among its forbidden tokens is
  `rm(` — which is a substring of the word a coder writing about a CSS
  rotation is most likely to reach for followed by a parenthesis. Write
  `transform:` (the property, with a colon) and never that word followed by
  `(`. Also avoid `rename`/`renaming`, `truncate`, `spawn`, `fork`/`forked`,
  `watchFile` and `fs.watch` anywhere in these two files.
- `discipline.test.mjs`'s own scoped regexes run against **raw** CSS in several
  cases. Do not add any comment inside the `.card` block: that block is asserted
  to contain no `-webkit-app-region`, and prose mentioning it would fire the
  assertion. Do not write a `{` or `}` inside any CSS comment — it breaks
  `[^}]*` block scoping for every rule after it.

**Pre-existing and NOT caused by this work: `node scripts/verify-install.mjs`
fails 9 of its 21 checks inside a worktree on a CRLF checkout.** That is a known
condition of the environment, is not in this plan's scope, and must not be
chased or "fixed" here. Report it as pre-existing if it is run at all.

### Step 7 — acceptance, which is manual and is Karl's to run

**No automated test in this repository can observe a drag region or a popup.**
`context-menu.mjs` states this about itself: *"No automated test in this repo
can see it happen."* Nothing in this plan pretends otherwise, and step 2's
guards explicitly do not claim to.

Acceptance is `R46`'s repro:

1. Open the app with at least one repo card in the top row.
2. Flip a top-row card.
3. Right-click the frame band directly above that card.

**Pass:** the band **still drags the window** and **gives no menu**.

**THE ACCIDENTAL MENU ON THAT BAND IS EXPECTED TO DISAPPEAR. That is the fix
working — it is not a regression.** The menu was only ever reachable there
because the pixels had stopped being a drag region; restoring the region removes
it, and `R46` says so directly: *"Fixing the region will REMOVE that menu. That
is correct and expected — do not preserve it."* Reviewer and user should read
its absence as the success signal.

Four regression checks in the same sitting, all of which guard against the
`pointer-events` risk named in §3:

- Every ordinary gesture still works: tap-to-flip, drag-to-reorder,
  Ctrl-drag to free-place, and the eight resize grips.
- Right-click **on a card** and **on empty board space** still produce their
  menus.
- Double-click on any frame band still maximises the window (native
  `HTCAPTION` behaviour, which §10.1 wants kept).
- The edge markers are still clickable, and the empty state's path is still
  selectable.

If step 7 fails, do not start editing `context-menu.mjs`. Re-read §3's named
risk and report.

---

## 6. What this plan does not deliver

- **`R42` / half two is untouched**, including the third surface option `R46`
  raised. Nothing here forecloses any of the three, and no part of this fix
  should be read as a step toward one. The `#drag-band` pair adds no chrome, no
  control, and no hole in the border.
- **No `watcher/docs/` record is written.** The rationale lands in the
  `index.html` comment (step 5) and in this plan. If Manager judges that a
  structural addition to `#frame` warrants a dated decision record, that is a
  separate dispatch and is Architect's to write, not Coder's.
- **Neither queue is edited.** `docs/REVIEW-QUEUE.md` and
  `watcher/docs/DISPATCH-QUEUE.md` are out of the footprint. `R46` cannot be
  struck while half two is open, and the correction in §1a is reported to
  Manager for relay rather than applied by Coder.
