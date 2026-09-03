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

**Why shift is scoped to click only, never to drag-start:** it's tempting to also
check `event.shiftKey` in the drag-start handler (step 4) to let shift+drag add a
tile to the selection *and* immediately move it. Don't — walk through what happens
if you do: mousedown fires the drag-start handler first, click fires after (on
mouseup). If drag-start also reacts to shift by mutating `selectedIds`, then the
later click handler's toggle will immediately undo what drag-start just did,
because both are reading/writing the same set in the same interaction. Keeping
shift out of the drag-start decision entirely avoids the conflict — and it matches
the workflow you described: build the selection with shift+click first, *then*
drag (no shift needed) to move it, as two separate steps.

## Step 4 — Drag-start decision + group-drag delta propagation

This is the core mechanic. It hooks into the existing `pick` emit (fires on
`useDraggable`'s `onStart`, i.e. on mousedown) — this already runs `bringToFront`,
so extend that same handler rather than adding a new event.

**Drag-start decision** (`onTilePick`, called from `@pick`):
- Still call `bringToFront(tile)` — unchanged.
- If this tile is already in `selectedIds` **and** the selection has more than one
  member → this is the start of a group drag. Snapshot the *other* selected
  tiles' current `x`/`y` into `groupDragOrigin` (a `Map<id, {x, y}>` — skip the
  dragged tile itself, it manages its own position). Record the dragged tile's own
  starting position in `dragStartPos`. Record its id in `activeDragId`.
- Otherwise (tile isn't selected, or is the only thing selected) → **locked
  decision:** collapse the selection to just this tile (`selectedIds = new
  Set([tile.id])`), clear any group-drag state. This matches standard
  Figma/Illustrator behavior — grabbing an unselected tile always narrows focus to
  it, even before you know whether the mousedown turns into a drag or a plain
  click.

**Delta propagation** (`onTileMove`, called from `@move`, step 1's handler,
extended):
- Always write the moving tile's own `x`/`y` from the incoming position (step 1's
  baseline behavior — happens for every tile regardless of group-drag state).
- If the tile that moved is `activeDragId` and a `groupDragOrigin` snapshot
  exists: compute `dx`/`dy` as the difference between the incoming position and
  `dragStartPos`. For every `(id, origin)` in `groupDragOrigin`, set that tile's
  `x = origin.x + dx`, `y = origin.y + dy`.
- Clear `activeDragId`/`groupDragOrigin`/`dragStartPos` when the drag ends (wire
  up `useDraggable`'s `onEnd` the same way you wired `onMove`, or a window
  `mouseup` listener — either works, pick whichever reads cleaner to you).

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
  guard, `:class="{ selected }"` + CSS.
- **`src/App.vue`** — new state (step 2), `onTileClick`, `toggleSelect`,
  `onTilePick`, `onTileMove`, `onBoardMouseDown`, marquee hit-test, marquee style
  computed, template changes (new bindings, marquee `<div>`), `.marquee` CSS.
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
      — selection collapses to just that tile, only it moves.
- [ ] Existing gestures still work: plain click flips, right-click rotates 90°,
      dragging a lone unselected tile behaves as before, and shuffle/order still
      work correctly after tiles have been manually dragged (this now depends on
      step 1 keeping `x`/`y` accurate).
