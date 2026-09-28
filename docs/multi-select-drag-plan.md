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

Add a `<div>` inside `.board`, sibling to the tiles, that renders only while
`marquee` is non-null — positioned/sized from `marquee.value`'s start/current
point (min/max math to handle dragging in any direction), `pointer-events: none`
so it can never itself catch a mouse event.

Wire `@mousedown` on `.board` itself:
- **Guard:** only start a marquee if `event.target === boardRef.value` exactly —
  i.e. the mousedown landed on the empty board, not on a tile. (A tile's own
  mousedown bubbles up through `.board` too, since DOM events bubble — this check
  is what stops a tile-drag from also being misread as a marquee-start. Worth a
  short comment in the code explaining why, since it'll silently break if a
  future non-tile element — a wall/zone marker — gets added inside `.board`.)
- Record the start point in board-relative coordinates
  (`event.clientX/Y - boardRef.getBoundingClientRect().left/top`).
- Attach window-level `mousemove`/`mouseup` listeners for the duration of the
  drag — use `useEventListener` from `@vueuse/core` (already a project
  dependency) rather than raw `addEventListener`, consistent with how this
  project already leans on vueuse. Call its returned `stop()` as soon as the
  interaction ends.
- On `mousemove`: update `marquee.value`'s current point.
- On `mouseup`: run the hit-test (below), then clear `marquee`, stop both
  listeners.

**Click vs. drag disambiguation:** if the total mouse movement during the
interaction is below a small threshold (a few pixels), treat it as a plain click
on empty background rather than a marquee — and clear the selection. Otherwise it
was a real marquee drag; skip clearing.

**Hit-test** (**locked decision: partial overlap counts**, not full containment —
matches Figma/Illustrator, not classic Windows Explorer): standard axis-aligned
rectangle intersection between the marquee box and each tile's bounds
(`tile.x`, `tile.y`, `TILE_WIDTH`, `TILE_HEIGHT` — both already in board-relative
coordinates thanks to `containerElement` in `useDraggable`, so no conversion is
needed). Two rectangles intersect when they overlap on both axes — work out the
four-comparison condition yourself; it's the same shape as the classic
"A.left < B.right && A.right > B.left && ..." check.

If shift was held when the marquee started, **union** the hits into the existing
`selectedIds` instead of replacing it — this is the one place shift *does*
matter for a drag gesture, but note it's read once at marquee-start (not
continuously, and not on a tile), so it doesn't run into the same conflict step 3
called out.

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
