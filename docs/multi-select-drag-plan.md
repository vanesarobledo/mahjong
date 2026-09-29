# Multi-tile select & group drag — implementation source of truth

This is the spec to implement against, step by step. It's written for you to code
from — not as a copy-paste solution. Each step explains **what** needs to change
and **why**, with just enough shape (types, event names, algorithm sketch) to
implement it yourself and check your work.

Work through the steps in order — step 1 is a genuine prerequisite for everything
after it, not just a nice-to-have first task.

## The goal

Two ways to build a multi-tile selection, and one way to move it:

1. **Marquee/rubber-band select** — mousedown+drag on empty board background draws
   a box; every tile the box touches (even partially) gets selected on release.
2. **Shift+click** — toggles a single tile's membership in the selection, without
   flipping it.
3. **Group drag** — dragging any tile that's part of the current selection moves
   every selected tile together, preserving their relative offsets.

Primary use case: speeding up manual hand-dealing by moving several tiles at once.
This is a pure convenience layer — it never blocks or validates a move, consistent
with this project's core philosophy (see `mahjong-project-summary.md`).

## Why step 1 has to come first

Read `src/components/TileDraggable.vue`. Each tile's live drag position lives
*only* inside its own `useDraggable()` instance (`position` ref, internal to that
composable call). The parent's `tiles[i].x`/`tiles[i].y` in `App.vue` is written
once at mount and only ever mutated by `orderTiles()`/`resetGame()` — **manually
dragging a tile never updates it.** Today nothing reads that stale value back, so
it's invisible. This feature reads it in two places:

- **Marquee hit-testing** needs every tile's real current position to know what's
  inside the drawn box.
- **Group drag** needs the parent to shift every *other* selected tile by the same
  delta as the tile being actively dragged — which means mutating their `x`/`y`
  in the parent's `tiles` array, which only works if that array is accurate to
  begin with.

So: teach the child to report its position back up, before building anything that
depends on the parent knowing it.

## Step 1 — Sync tile position from child back to parent

**What:** `TileDraggable.vue` already gets `x`, `y`, `position` back from
`useDraggable()` but doesn't do anything with them. Add an `onMove` callback to
the `useDraggable()` options that emits the live position up. Add a
corresponding `move` emit to `defineEmits`.

In `App.vue`, listen for `@move` on each `<TileDraggable>` and write it straight
into that tile's `x`/`y` in the `tiles` array.

**The trap to watch for:** `TileDraggable.vue` already has a `watch` that goes the
*other* direction — parent prop (`initialX`/`initialY`) → child's internal
`position`. Once you add the emit-up, a drag will round-trip: child emits → parent
writes `tile.x` → prop `initialX` changes → the existing `watch` fires → writes
back into `position` again. That's not infinite (it converges immediately, since
the round-tripped value is identical) but it's an unnecessary extra write every
single move event, and it's the kind of feedback loop worth guarding against on
principle. Add a check at the top of the `watch` callback: if the incoming
`initialX`/`initialY` already equals the current `position.value`, don't reassign.

**Why this belongs in `onMove` and not `onEnd`:** group drag (step 4) needs the
other selected tiles to move in lockstep with the dragged one, frame by frame — if
you only sync on drag end, the group would sit still and then snap into place all
at once, which will look broken next to the one tile that moved smoothly.

**Check yourself:** after this step alone (before building any selection UI), you
should be able to verify in Vue devtools (or a quick `console.log`) that
`tiles[i].x/y` in `App.vue` updates live while dragging any single tile — nothing
user-visible has changed yet, but the parent's state is no longer lying to itself.

## Step 2 — Selection state

New reactive state in `App.vue` (this is cross-tile state, so it belongs in the
parent — same reasoning as why `tiles` itself lives there, see
`mahjong-project-summary.md`'s "Component architecture" section):

- `selectedIds` — a `Set<number>` of tile ids currently selected. A `Set` on the
  parent, not a `selected` boolean field on each `Tile`, so there's exactly one
  source of truth — no risk of a per-tile flag desyncing from a separate list.
- `marquee` — `null` when no box is being drawn, otherwise the box's start point
  and current point, in board-relative coordinates.
- Transient group-drag bookkeeping (`groupDragOrigin`, `activeDragId`,
  `dragStartPos`) — populated when a group drag starts, cleared when it ends. See
  step 4 for what each is for.

## Step 3 — Shift+click toggles selection

`TileDraggable.vue` doesn't need to know about shift or selection at all — it
should stay "dumb," same as it is now: report pointer facts (`pick`, `move`),
accept a `selected: boolean` prop for styling. All decisions happen in `App.vue`.

Change the existing `@click="flipTile(tile)"` binding to pass the native event
through too, so the parent can branch on `event.shiftKey`:
- shift held → toggle this tile's id in `selectedIds` (add if absent, remove if
  present) — do **not** flip.
- shift not held → flip, exactly as today.

**Why shift is scoped to click only, never to drag-*start*:** it's tempting to also
check `event.shiftKey` in the drag-start handler (step 4) to let shift+drag add a
tile to the selection *and* immediately move it. Don't — walk through what happens
if you do: mousedown fires the drag-start handler first, click fires after (on
mouseup). If drag-start also reacts to shift by mutating `selectedIds`, then the
later click handler's toggle will immediately undo what drag-start just did,
because both are reading/writing the same set in the same interaction. Keeping
shift out of the drag-start decision entirely avoids the conflict — and it matches
the workflow you described: build the selection with shift+click first, *then*
drag (no shift needed) to move it, as two separate steps.

(This is a rule about drag-*start* specifically. Step 4 below revisits `shiftKey`
at drag-*end*, where reading it turns out to be safe — for a different reason
than "shift shouldn't matter here." Don't over-generalize this into "never read
shiftKey in a drag hook.")

## Step 4 — Drag-start decision + group-drag delta propagation

This is the core mechanic. It hooks into two `useDraggable` lifecycle hooks:
`pick` (fires on `onStart`, i.e. on mousedown — already wired, already runs
`bringToFront`) and a new `end` hook (fires on `onEnd`, i.e. on mouseup/pointerup)
that needs wiring the same way Step 1 wired `move`: add an `onEnd` option to
`useDraggable()` in `TileDraggable.vue`, emit an `end` event with the native
pointer event, and listen for `@end` in `App.vue`.

**Drag-start decision** (`onTilePick`, called from `@pick`) — this hook only
ever sets up group-drag bookkeeping. It never touches `selectedIds` itself:
- Still call `bringToFront(tile)` — unchanged.
- If this tile is already in `selectedIds` **and** the selection has more than one
  member → this is the start of a group drag. Snapshot the *other* selected
  tiles' current `x`/`y` into `groupDragOrigin` (a `Map<id, {x, y}>` — skip the
  dragged tile itself, it manages its own position; look each other id up in
  `tiles.value` to read *that specific tile's* `x`/`y`, not the dragged tile's).
  Record the dragged tile's own starting position in `dragStartPos`. Record its
  id in `activeDragId`.
- Otherwise (tile isn't selected, or is the only thing selected) → do nothing to
  `selectedIds` here. (An earlier version of this step said to collapse the
  selection right here — that was wrong; see below.)

**Why the collapse decision moved to drag-*end*, not drag-start (this section
originally said the opposite — recorded here because it took a real bug to find
this):**

The original version of this step said the "otherwise" branch above should
*immediately* collapse `selectedIds` to just this tile, reasoning that `pick`
fires on mousedown, "even before you know whether the mousedown turns into a drag
or a plain click" — matching Figma, where grabbing an unselected object narrows
focus to it right away.

That's true in isolation, but it breaks Step 3's premise. `pick` fires on *every*
mousedown, including the mousedown that starts a shift+click. Trace it by hand:
you shift+click tile 1 (`selectedIds = {1}`). You shift+click tile 2. `pick`
fires first, on tile 2's mousedown — tile 2 isn't in `selectedIds` yet, so the
"otherwise" branch collapses the set to `{2}`, discarding tile 1. *Then* `click`
fires and tile 2's shift-toggle runs — but tile 2 is already in the set (`pick`
just put it there a moment ago), so the toggle reads that as "already selected"
and removes it. Net result: `{}`. Every attempt to grow the selection past one
tile erases what came before it, and empirically this reproduces as "shift+click
feels inconsistent, can't select three tiles."

This is the same category of trap called out just above for drag-*start* and
shift — it just wasn't obvious until this specific two-shift-clicks-in-a-row
sequence was traced by hand and confirmed by testing. `pick` can't fix this by
checking `event.shiftKey` either, since `pick` doesn't receive the native event,
and giving it one just to read shift here would recreate the exact race Step 3
already ruled out (two handlers *mutating* the same set within one interaction).

The fix: move the collapse to **drag-end** (`onEnd`/`@end`) instead of
drag-start. Two reasons this specific hook works where `pick` couldn't:
1. `onEnd` receives the native pointer event, so `event.shiftKey` is available
   there. Reading it here is safe for a reason specific to this hook: the new
   `onTileEnd` handler only ever *skips* mutating `selectedIds` when shift is
   held — it leaves `click`'s own toggle as the sole writer in that case. It
   never *adds* anything the way the old drag-start version implicitly did. Two
   handlers racing to mutate the same set is the problem Step 3 flagged; one
   handler that mutates only when the other one won't isn't that problem.
2. `onEnd` fires exactly once per interaction, regardless of how far the pointer
   moved — a real drag and a near-motionless click both end in exactly one
   `onEnd` call. That means the collapse now reliably runs for a genuine drag of
   an unselected tile too (native `click` does **not** reliably fire after real
   pointer movement in this app — verify this yourself with a console.log before
   trusting it either way), which the checklist requires: "drag a tile that's
   *not* in the current selection while others are selected → selection
   clears, only that tile moves."

So, in the new `onTileEnd(event, tile)` handler:
- Always clear `activeDragId` / `groupDragOrigin` / `dragStartPos` (this replaces
  a plain `mouseup` handler that did only this — see below for why that handler
  needs replacing, not just extending).
- If `!event.shiftKey` and the tile is *not* already part of a `size > 1`
  selection — i.e. `!e.shiftKey && !(selectedIds.has(tile.id) && selectedIds.size > 1)`,
  which is exactly "this interaction wasn't a group drag" (the same `has && size > 1`
  test `onTilePick` uses) — **clear** the selection: `selectedIds.value = new Set()`.

**Why clear, not collapse-to-this-tile (revised after testing):** an earlier
version of this bullet collapsed to `new Set([tile.id])`, Figma-style — whatever
you last grabbed becomes the selection. Because `onEnd` fires for plain clicks
too, that meant *every* non-shift interaction silently selected the tile touched.
Trace it: selection is empty, you plain-click tile 2 to flip it → `{2}`. You then
shift+click tile 3 intending to start a fresh group → `{2, 3}`, with tile 2
included unintentionally. Clearing instead means a selection only ever contains
tiles you explicitly shift+clicked (or, once Step 5 lands, marquee-selected), so
every shift+click after a plain interaction starts fresh. What's given up is the
"the tile you just grabbed is selected" feedback — but a one-tile selection
enables nothing (group drag needs `size > 1`), so it wasn't worth anything here.

**Negation trap in that condition** (a real bug hit while implementing it): the
first draft wrote `!selectedIds.has(tile.id) && selectedIds.size > 1`, negating
only the first operand. The spec's "*not* already part of a size > 1 selection"
negates the whole conjunction: `!(H && B)`, which by De Morgan's laws equals
`!H || !B` — the `&&` flips to `||` when the `!` is distributed. The buggy
version missed the `!H && !B` case (selection `{1}`, drag tile 2 → should reset,
but `{1}` survived). Keep the un-distributed `!(H && B)` form — it reads like the
spec sentence, and distributing it by hand is exactly where the bug came from.

**Why a raw `@mouseup` bound to the tile's own element isn't good enough for
this** (worth knowing even if you never hit it, because it's an easy first
instinct): a native `mouseup` listener on the tile's own DOM element only fires
if the pointer is still physically over that element at the moment of release.
During a fast drag, the tile's on-screen position updates reactively — there's a
render tick of lag between "the pointer moved here" and "the div's `style`
binding visually caught up to here." If the mouse releases inside that lag
window, the browser never dispatches `mouseup` to that specific element, and the
handler silently doesn't run. This shows up as intermittent, seemingly random
misfires — worse the faster or farther the drag. `useDraggable`'s own
`onStart`/`onMove`/`onEnd` don't have this problem, because vueuse tracks the
drag internally via listeners bound at the window/document level rather than on
the element itself — the same reason Step 5 tells you to attach the marquee's
own move/end listeners at the window level instead of on a specific element.

**Delta propagation** (`onTileMove`, called from `@move`, step 1's handler,
extended):
- Always write the moving tile's own `x`/`y` from the incoming position (step 1's
  baseline behavior — happens for every tile regardless of group-drag state).
- If the tile that moved is `activeDragId` and a `groupDragOrigin` snapshot
  exists: compute `dx`/`dy` as the difference between the incoming position and
  `dragStartPos`. For every `(id, origin)` in `groupDragOrigin`, set that tile's
  `x = origin.x + dx`, `y = origin.y + dy`.

**Why the dragged tile never gets double-moved:** trace it through — the delta
loop iterates only `groupDragOrigin`'s keys, and the dragged tile was explicitly
excluded when that map was built. The dragged tile's position is written exactly
once per move event, straight from its own `useDraggable` instance. The *other*
selected tiles are moved a completely different way: their `x`/`y` gets set on the
parent's `tiles` array, which flows back down as `initialX`/`initialY` props, hits
the existing `watch` in their own (untouched, not-being-dragged) `TileDraggable`
instances, and gets pushed into their internal `position`. That's the exact same
mechanism `orderTiles()`/`resetGame()` already use to reposition tiles — group
drag is just puppeting several tiles through that same path, continuously instead
of once. Nothing about a tile's *own* drag state is touched by another tile's
movement.

## Step 5 — Marquee: box, drag-to-select, hit-test

Step 5 breaks into four pieces. Build and check them in this order — each one is
visible on screen before the next depends on it:

1. **5a** — record the gesture (mousedown → mousemove → mouseup) into `marquee`.
2. **5b** — draw the box from `marquee`.
3. **5c** — the hit-test: which tiles does the box touch?
4. **5d** — commit the result to `selectedIds` (click-vs-drag, shift/union).

### 5a — Recording the gesture

Wire `@mousedown` on `.board` itself:
- **Guard:** only start a marquee if `event.target === boardRef.value` exactly —
  i.e. the mousedown landed on the empty board, not on a tile. (A tile's own
  mousedown bubbles up through `.board` too, since DOM events bubble — this check
  is what stops a tile-drag from also being misread as a marquee-start. Worth a
  short comment in the code explaining why, since it'll silently break if a
  future non-tile element — a wall/zone marker — gets added inside `.board`.)
- Call `event.preventDefault()` once the guard passes. Without it, dragging
  across the page starts a native text selection (the `<h1>`, the button labels)
  that paints blue highlight behind your marquee.
- Record the start point in board-relative coordinates
  (`event.clientX/Y - boardRef.getBoundingClientRect().left/top`).
- Record `event.shiftKey` **on the marquee state itself** (e.g. an `additive:
  boolean` field next to `start`/`current`). 5d needs it at mouseup, and reading
  it once here — rather than off the mouseup event — is what "shift is read at
  marquee-start" means in practice.

On `mousemove`: update `marquee.value.current`. **Same coordinate space as
`start`** — subtract the board's `getBoundingClientRect().left/top` here too.
Raw `clientX/Y` is viewport-relative; the board sits below the heading and
buttons, so mixing the two produces a box offset vertically from the cursor by
exactly the height of everything above `.board`. Pull the "client → board"
conversion into one small helper and call it from both places, so they can't
drift apart.

On `mouseup`: run 5c + 5d, then set `marquee.value = null`.

**Window-level listeners — two valid shapes, pick one:**
- *Always-on, gated:* register `useEventListener(window, 'mousemove', …)` and
  `'mouseup'` once at setup, and have each handler `return` immediately when
  `marquee.value` is `null`. Simplest; vueuse removes them when the component
  unmounts. The cost is a no-op function call on every mouse move in the app,
  which is negligible here.
- *Per-interaction:* call `useEventListener` inside the mousedown handler and
  keep the returned stop functions, calling them in mouseup. Tighter, but note
  that vueuse only auto-cleans a listener registered during component setup
  (inside an active effect scope) — one registered from inside an event handler
  is yours to stop, every time, including if the component unmounts mid-drag.

Either way, **why window and not `.board`:** the pointer can leave the board
mid-drag (drag up past the top edge, release over the buttons). A board-level
`mouseup` would never fire, and `marquee` would stay stuck non-null — the same
"listener bound to the wrong element misses the release" problem described in
step 4's `@mouseup` section.

Name trap: inside a `<script setup>` handler, a bare `stop()` with no local
variable of that name doesn't throw — it resolves to the browser global
`window.stop()`, which aborts page loading. It'll silently "work." If you want a
stop function, it has to be the one `useEventListener` returned to you.

**Check yourself (5a):** with only this done, `console.log(marquee.value)` on
mouseup (or watch it in Vue devtools) — `start` should be `{0, 0}`-ish when you
press at the board's top-left corner, not `{0, 120}`-ish, and `current` should
agree with `start` when you haven't moved.

### 5b — Drawing the box

Add a `<div class="marquee">` inside `.board`, sibling to the tiles, rendered
only while `marquee` is non-null, `position: absolute`, `pointer-events: none`
so it can never itself catch a mouse event, and a `z-index` above every tile
(tiles' `zIndex` keeps climbing via `bringToFront`, so a fixed small number won't
stay on top — either bind it to `frontMostTile + 1` or give it a very large
value).

The box can be dragged in any direction, so `start` isn't necessarily the
top-left. Normalize into a rectangle once:

- `left = min(start.x, current.x)`, `right = max(start.x, current.x)`
- same for `top`/`bottom` with `y`

Make that normalized rect a **`computed`**, and have *both* the box's `style`
and the hit-test in 5c read from it. If the drawing and the hit-test each do
their own min/max, it's possible for what you see and what gets selected to
disagree — one source of truth, same principle as `selectedIds`.

**Check yourself (5b):** drag in all four diagonal directions from the same
point; the box should always hug the cursor.

### 5c — The hit-test

**Locked decision: partial overlap counts**, not full containment — matches
Figma/Illustrator, not classic Windows Explorer.

**Tile bounds.** A tile's rectangle is `left = tile.x`, `top = tile.y`,
`right = tile.x + TILE_WIDTH`, `bottom = tile.y + TILE_HEIGHT`. `tile.x/y` are
already board-relative — `useDraggable` with `containerElement` computes
position as the element's offset from the container's `getBoundingClientRect()`
(see `start()` in `node_modules/@vueuse/core/dist/index.js`), which is the same
origin 5a uses for the marquee. So both rectangles are in the same space and no
conversion is needed. This is only true *because of* step 1 — before it,
`tile.x/y` was stale for any tile you'd dragged.

**Derive the overlap condition in 1D first.** Two rectangles overlap exactly
when their x-ranges overlap **and** their y-ranges overlap. So the real question
is the one-dimensional one: when do two intervals `[aStart, aEnd]` and
`[bStart, bEnd]` on a number line overlap?

It's easier to answer the opposite first. Draw two intervals that *don't*
overlap. There are only two ways that can happen — what are they, in terms of
one interval's end and the other's start? Write that as a boolean, then negate it
to get "they overlap." You've already met the negation trap in step 4's
`!(H && B)` bug: negating an `||` of two comparisons flips it to an `&&` and
flips each comparison. Distribute it carefully, then sanity-check against this
table (intervals on the x-axis, A = marquee, B = tile):

| A (marquee) | B (tile) | Overlap? | Why |
|---|---|---|---|
| `[0, 100]` | `[50, 100]` | yes | B starts inside A |
| `[60, 100]` | `[50, 100]` | yes | A starts inside B — the "grabbed just the right edge of a tile" case |
| `[0, 200]` | `[50, 100]` | yes | A fully contains B |
| `[70, 80]` | `[50, 100]` | yes | B fully contains A — a tiny marquee drawn *inside* one tile. Easy to miss if you only reason about "does B's edge fall inside A" |
| `[0, 40]` | `[50, 100]` | no | A ends before B starts |
| `[110, 200]` | `[50, 100]` | no | A starts after B ends |
| `[0, 50]` | `[50, 100]` | **you decide** | edges touch, zero-area overlap |

The last row is a real choice, not a gotcha: `<` vs `<=` decides it. Strict
(`<`) says touching isn't overlapping, which is the usual convention and means a
marquee that merely grazes a tile's edge pixel doesn't grab it. Pick one and
write a comment saying which.

Then the 2D condition is your 1D condition applied to x, `&&` the same condition
applied to y — four comparisons total.

**Write it as a pure function**, e.g. `rectsIntersect(a: Rect, b: Rect):
boolean`, taking two `{ left, top, right, bottom }` objects. No refs, no
`tiles.value`, no DOM. That keeps the one tricky piece of logic separate from
the reactive plumbing, so you can check it by calling it from the console (or a
unit test, if this project ever adds Vitest) with the table's numbers, without
drawing a single marquee.

**Collecting hits:** iterate `tiles.value` directly and collect `tile.id` for
each hit. Iterating the array is fine here — you're reading each tile's own
fields, never looking one up by id — so the "index isn't id" trap from the step 4
debugging log doesn't apply. Just make sure what you *store* is `tile.id`, never
the loop index.

**Decision you need to make: rotated tiles.** Right-click rotates `.tile-3d` by
`rotateZ(90deg)`, but `tile.x/y` and the wrapper stay a 50×72 upright box. CSS
rotates around the element's center by default (`transform-origin: 50% 50%`,
[MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/transform-origin)), so a
rotated tile's *visible* footprint is 72×50, centered on the same point —
`(TILE_HEIGHT - TILE_WIDTH) / 2 = 11px` wider on each side and 11px shorter at
top and bottom than the rect above. Options:
- *Ignore it* — use the upright rect for every tile. Up to 11px of mismatch at
  the edges of rotated tiles. Simplest; probably unnoticeable in normal use.
- *Swap dimensions when `rotationZ === 90`* — compute the rotated footprint from
  the tile's center. Exact, a few extra lines, and the tile-bounds logic now
  knows about rotation.
- *Ask the DOM* — call `getBoundingClientRect()` on each tile element, which
  returns the box *after* transforms
  ([CSSOM View spec](https://drafts.csswg.org/cssom-view/#dom-element-getboundingclientrect)).
  Always matches what's on screen, but needs a ref to every tile element,
  forces a layout read for all 136 tiles on each mouseup, and gives up the pure
  function.

Recommendation: start with *ignore it*, test by marquee-grazing the side of a
rotated tile, and only move to *swap dimensions* if the mismatch actually
bothers you. Whichever you pick, add it to the "Key architectural decisions" in
`mahjong-project-summary.md` when this step lands.

Also note, not a bug: the hit-test selects tiles hidden underneath other tiles
too, since it only looks at rectangles, not stacking. That's consistent with the
project's "automate, don't judge" philosophy — just don't be surprised by it.

### 5d — Committing the result

At mouseup, in this order:

1. **Click vs. drag:** compute how far the pointer moved between `start` and
   `current`. If it's below a small threshold (3–5px; either
   `Math.hypot(dx, dy)` or "both `|dx|` and `|dy|` under N" is fine), treat it as
   a plain click on empty background: clear the selection, and skip the
   hit-test entirely. The threshold exists because a real mouse click almost
   always jitters a pixel or two between down and up.
2. **Otherwise**, run the hit-test and:
   - `additive` (shift was held at mousedown) → **union** the hits into the
     existing `selectedIds`.
   - not additive → **replace** `selectedIds` with exactly the hits.
3. Set `marquee.value = null`.

Shift matters here for a drag gesture, but because it's read once at
marquee-start (not continuously, and not on a tile), it doesn't run into the
two-handlers-one-set conflict step 3 called out — no tile `click` handler runs
for a marquee, since the mousedown was on the board.

Open question to verify rather than assume: if you start a marquee on empty
board and release *over a tile*, does that tile's `click` fire (and flip it)?
Per the UI Events spec, `click` targets the nearest common ancestor of the
mousedown and mouseup targets — which would be `.board`, not the tile — but
browser behavior here has historically varied. Test it in the browsers you
care about.

**Check yourself (5c + 5d):** run the marquee-related lines of the verification
checklist below — partial overlap, shift-union, click-to-clear — plus the
"box fully inside one tile" row from the table above.

## Step 6 — Visual selection state (CSS)

Put the selection indicator on `TileDraggable.vue`'s outer `.tile-wrapper`
element — **not** on `.tile-3d` or `.face`. Those two use
`transform-style: preserve-3d` / `backface-visibility: hidden` and their own
rotation transforms (flip, riichi rotate); an outline placed there risks getting
clipped or hidden depending on which face is currently showing. `.tile-wrapper`
sits outside that rotation context entirely, so a ring drawn there stays visually
stable — it won't spin with the tile, which is what you want.

Use `outline` (with `outline-offset`), not `box-shadow` — it won't interact with
`.face`'s existing padding/inset shadow the way a box-shadow might.

## Files touched

- **`src/components/TileDraggable.vue`** — `selected` prop, `move` emit + watch
  guard, `end` emit, `:class="{ selected }"` + CSS.
- **`src/App.vue`** — new state (step 2), `onTileClick`, `toggleSelect`,
  `onTilePick`, `onTileMove`, `onTileEnd` (replaces a plain `mouseup` handler —
  see step 4), `onBoardMouseDown`, marquee hit-test, marquee style computed,
  template changes (new bindings, marquee `<div>`), `.marquee` CSS.
- **`src/types.ts`** — no change (selection is a `Set` in `App.vue`, not a `Tile`
  field).
- **`mahjong-project-summary.md`** — once this is working, add it under
  "Near-term scope" and document the new child→parent sync path under "Key
  architectural decisions," since future changes need to know that path exists
  now.

## Verification checklist

- [ ] After step 1 alone: dragging a single tile updates `tiles[i].x/y` in
      devtools, with no visible behavior change yet.
- [ ] Shift+click 3+ tiles — each shows a selection ring, selection accumulates.
- [ ] Drag one selected tile — the whole group moves together, offsets preserved,
      no stutter on the dragged tile.
- [ ] Draw a marquee over a cluster, including tiles only partially inside the box
      — all get selected on release.
- [ ] Shift+drag a marquee over more tiles — adds to the existing selection
      instead of replacing it.
- [ ] Click empty background with no drag — selection clears.
- [ ] Drag a tile that's *not* in the current selection while others are selected
      — selection clears, only that tile moves.
- [ ] Plain-click (flip) a tile with nothing selected, then shift+click another
      tile — selection is just the shift+clicked tile; the flipped one isn't
      included.
- [ ] Existing gestures still work: plain click flips, right-click rotates 90°,
      dragging a lone unselected tile behaves as before, and shuffle/order still
      work correctly after tiles have been manually dragged (this now depends on
      step 1 keeping `x`/`y` accurate).

## Step 4 debugging log — bugs found while implementing delta propagation

Recorded here because each one is a specific trap worth remembering, not just a
typo — future steps (marquee hit-testing especially) touch the same `tiles.value`
array and the same "id vs. array position" and "snapshot vs. live value" traps
could resurface there.

1. **Indexing `tiles.value` by id instead of searching for it.** The first draft
   of `handlePick`'s snapshot loop read `tiles.value[id]`, which only works if a
   tile's `id` happens to equal its position in the array. It doesn't stay true:
   `bringToFront` (called at the end of every `handlePick`) splices a tile out and
   pushes it to the end, reordering the array on every single pick. After the
   first drag, `tiles.value[id]` silently points at the wrong tile. Fixed by
   switching to `tiles.value.find(t => t.id === id)` — an actual search by field,
   not a position lookup — with an `if (currentTile)` guard for the "not found"
   case. Lesson: never conflate a domain id with array position once anything in
   the codebase reorders that array.

2. **Delta computed but never written back to the tiles the template renders
   from.** An early version of `handleTileMove` computed `dx`/`dy` and mutated the
   values sitting inside `groupDragOrigin` (the private snapshot bookkeeping), but
   nothing then wrote the result onto the actual `Tile` objects in `tiles.value` —
   which is what `:initial-x`/`:initial-y` actually bind to. Symptom: no visible
   movement of the other selected tiles at all. Fixed by adding a second lookup
   (`tiles.value.find` by id again) and assigning the computed position onto that
   tile's own `x`/`y`.

3. **Mutating the origin snapshot instead of treating it as fixed.** Even after
   fix #2, `dx`/`dy` are calculated against `dragStartPos`, which never changes
   for the duration of one drag — meaning `dx` on every `move` event is already
   the *total* displacement since the drag started, not the incremental change
   since the last event. The buggy version applied that cumulative `dx` with
   `pos.x += dx` onto `groupDragOrigin`'s stored value on *every* move event,
   compounding a growing delta on top of itself each frame instead of computing a
   fresh absolute position. Symptom: grouped tiles flew far off screen, worse the
   longer the drag continued. Traced by hand-computing three consecutive move
   events with concrete numbers, which showed the applied offset roughly doubling
   move-over-move instead of tracking the dragged tile's real displacement. Fixed
   by leaving `groupDragOrigin`'s snapshot values untouched for the whole drag and
   computing `currentTile.x = snapshotCoords.x + dx` fresh from that fixed origin
   on every move event.

**Debugging technique note:** used Firefox's debugger (breakpoints + the Scopes
pane, Watch Expressions, and evaluating expressions like `groupDragOrigin.value`
directly in the console while paused) instead of `console.log`, since stepping
through reactive `ref`/`Map` state is easier to inspect live than to serialize
into a log line.
