# Riichi Mahjong Vue Project — Architecture Summary

## Goal & scope philosophy

Building a digital Riichi mahjong set on a Vue page. The philosophy is that only the setup minimally required to play the game is needed and players enforce the rules themselves. Cheating is explicitly allowed.

- **Setup and bookkeeping can be automated.** Building the wall, dealing hands, tracking seats/rounds, and (eventually) scoring are tedious mechanical chores a real table does by hand — the app is allowed to do them for players as optional convenience helpers.
- **Play itself stays self-enforced.** Turn order, legal draws, legal riichi timing, and generally "is this move allowed" are never checked or blocked by the app. Players police that themselves, exactly as at a physical table.
- **Cheating is a permanent, explicit design commitment**. Every tile is freely movable between any zone (hand, wall, dead wall, discard pile) at all times, and a dedicated swap gesture exists specifically to make swapping tiles fast. This is never something to "fix" by adding zone restrictions.

The question to ask is: **does this feature ever block or validate a player's move, or does it just do labor for them that they could still override by hand?** Only the former is out of scope.

Scope is split into two tiers below: **Near-term** (setup/bookkeeping helpers, being actively built) and **Stretch/future** (a genuine rules engine for scoring, and a longer-term pluggable rule-toggle architecture — aspirational, not currently shaping code).

### Near-term scope

- **Multi-select & group drag** _(implemented; manual verification pending)_: shift+click toggles a tile in the selection, and dragging on empty board draws a marquee that selects every tile it touches. Dragging any tile in a multi-tile selection moves the whole group. This is a convenience for moving several tiles at once (e.g. hand-dealing). It never restricts where tiles can go. See decisions 8–12; the build log is `docs/multi-select-drag-plan.md`.
- **Wall / dead-wall auto-build** _(implemented)_: the "Build the Wall" button shuffles all 136 tiles into a physically-accurate 4-wall square (17 stacked pairs per seat), rolls dice, and breaks the wall realistically: the dice total picks the wall and break point, the 7 stacks right of the break become the 14-tile dead wall (separated from the live wall at both ends), and the first dora indicator is flipped. It plays as three animated beats (build → roll → break) with a reduced-motion fallback, and the dice result stays in the toolbar. Wall positions use a **slot model**: fixed slot geometry, with tile positions as the only source of truth for which tile is where, so it stays correct when players cheat. See decisions 13–17 and `docs/build-the-wall-spec.md`.
- **Hand zones**: four labeled per-seat regions. Dealing into them can optionally be automated (a "deal" helper draws starting tiles from the wall into each hand), but manual drag-to-fill remains fully supported — dealing is a convenience.
- **Swap mode**: a dedicated cheat gesture — click "swap," then click two tiles — exchanges their positions/identities in one step, on top of the free drag-anywhere that already works today.
- **Seat / round indicators**: labels players manually set/cycle themselves (e.g. click to advance E→S→W→N, or bump the round by hand). No app-driven turn logic drives them.
- **Riichi tracking**: a per-seat "in Riichi" flag plus a running count of riichi sticks in the pot. Players set it themselves, like placing a riichi stick at a physical table. It is never inferred from tile rotation: turning a discard sideways is only a visual marker, and sideways tiles also mark called tiles in melds.

### Stretch / future scope

- **Scoring via a "win" button**: a player declares a win and submits their hand; the app returns either a score or "not a valid winning hand." Tsumo vs. Ron stays player-tracked, not app-tracked. This is honestly a full rules engine (hand-shape/yaku detection) and a much bigger undertaking than everything else in this doc — it's optional and never required to finish a game.
- **Command-pattern-style pluggable rule toggles**: a grander long-term idea where every rule (legal draws, riichi legality, yaku validation, etc.) is implemented as an independently toggleable unit, so enforcement can be turned on or off per rule. Documented here as aspirational direction only — not something current architecture decisions are being made around yet.

## Tech stack

- **Vue 3** (`<script setup>`, Composition API, TypeScript)
- **@vueuse/core** — `useDraggable` (used directly as a composable, not the `<UseDraggable>` wrapper component — see below for why) and `useEventListener` (window-level listeners for the marquee gesture, auto-cleaned on unmount)
- **Vitest** — unit tests for pure `utils/` functions. Specs live in `src/**/__tests__/*.spec.ts` (excluded from the app tsconfig, type-checked via `tsconfig.vitest.json`). Node environment for now; switch to `jsdom` + `@vue/test-utils` only when a test needs to mount components. Run with `npm test`.
- Tile art: SVGs from the [FluffyStuff/riichi-mahjong-tiles](https://github.com/FluffyStuff/riichi-mahjong-tiles) repo, `Regular` tile set, served from `/img/tiles/`. Tile backs are a solid CSS colour (`Back.svg` is no longer used).
- Fonts: `@fontsource-variable/playfair-display` (headings, buttons) and `@fontsource-variable/nunito-sans` (body), self-hosted via npm and imported in `src/main.ts`

## Data layer

`src/data/tiles.ts` — a static, typed array (`Array<TileData>`) of the 136-tile riichi set:

```ts
type TileData = { id: number; src: string; name: string };
```

- 4 copies of each suit tile (Man/Pin/Sou 1–9), except 5s: 3 regular + 1 `-Dora` variant (red five) per suit — 3 + 1 = 4, matching standard tile counts
- 4 copies of each honour tile (Ton, Nan, Shaa, Pei, Hatsu, Chun, Haku)
- Ordered: Man → Pin → Sou → Ton → Nan → Shaa → Pei → Hatsu → Chun → Haku
- `name` is the filename without extension (e.g. `Man5-Dora`)
- This is purely descriptive data — **no position, rotation, or game state lives here**. Runtime state is added to each tile object at mount time in the parent's `ref()`, producing the `Tile` type (`src/types.ts`): `TileData` + `x`, `y`, `zIndex`, `isFaceUp`, `rotationY`, `orientation`.
- `orientation` (`0 | 90 | 180 | 270`) is which way the tile faces on the table. The wall build sets it so each wall's tiles have their bottom edge toward the wall's owner, and right-click turns it a further 90° clockwise (`(orientation + 90) % 360`). Shuffle and Order reset it to `0`. It is the only in-plane rotation a tile has; see decision 6.

## Source layout

```
src/
  App.vue                     board: owns tiles, z-order counter, group-drag state, all cross-tile handlers
  components/TileDraggable.vue  one per tile; wraps useDraggable, emits pick/move/end
  composables/
    useSelection.ts           Set<id> of selected tiles + toggle/addId/reset/isInGroup
    useMarquee.ts             drag-on-empty-board box select (gesture, rect, hit-test, commit)
    useWall.ts                Build the Wall: phase + dice state, the timed three-beat sequence, dora flip
  utils/
    geometry.ts               Point/Rect types, rectsIntersect, hasMoved, tileToRect (via orientedRect)
    tileActions.ts            flipTile, rotateTile, bringToFront (per-tile mutations)
    shuffle.ts                generic in-place Fisher-Yates
    wall.ts                   Seat/Orientation/Slot types, allSlots, seatOrientation, slotPosition,
                              orientedRect, assignTiles, tileInSlot, TABLE_SIZE, MIN_BOARD_HEIGHT
    break.ts                  Break type, computeBreak, deadWallStacks, doraIndicatorSlot
    __tests__/                Vitest specs: geometry, wall, break
  constants.ts                tile size/padding, drag threshold, wall geometry, build timings
  types.ts                    Tile, TileData
  data/tiles.ts               static 136-tile set
```

- **Composables hold stateful, Vue-reactive concerns; `utils/` holds pure functions.** `geometry.ts` and `tileActions.ts` take plain values/objects and know nothing about refs, so they can be reasoned about (and tested) without mounting anything.
- **Composables are wired together explicitly in `App.vue`**, not by importing each other's state. `useMarquee(boardRef, tiles, selection)` receives the selection object returned by `useSelection()` as an argument (typed via `ReturnType<typeof useSelection>`), so there's exactly one selection instance and its owner is visible at the call site. `useWall(boardRef, tiles, frontMostTile, selection)` follows the same pattern.
- **Group drag lives entirely in `App.vue`**: its refs (`dragStartPos`, `activeDragId`, `groupDragOrigin`) and the handlers that use them (`handlePick`, `handleTileMove`, `handleOnEnd`, `restackTiles`). A `useGroupDrag` composable that only declared the refs was removed: it split the state from the only code that touched it without hiding anything. Extracting group drag again only pays off if the handlers move with the state, with `tiles`, `selection`, and `bringToFront` passed in the way `useMarquee` receives its dependencies.

## Component architecture

**Two-component split**, chosen specifically to work around a vueuse limitation:

- **Parent (`App.vue`, the board):** owns the `tiles` ref (array of `Tile`), owns `boardRef` (template ref to the `.board` container), owns the `frontMostTile` z-order counter, owns the group-drag refs, and owns all cross-tile logic — flip, rotate, bring-to-front, selection, group drag, marquee, shuffle/order, and the wall build (through `useWall`).
- **`TileDraggable.vue` (child, one per tile):** wraps a single tile's `useDraggable()` call. Receives `initialX`/`initialY`/`containerRef` as props and emits three lifecycle events up to the parent:
  - `pick` — from `onStart` (pointerdown)
  - `move(position)` — from `onMove`, every frame of a drag
  - `end(event)` — from `onEnd` (pointerup), carrying the native event so the parent can read `shiftKey`

**Why a custom child component instead of the `<UseDraggable>` component from `@vueuse/components`:** that wrapper component doesn't expose the `containerElement` option, which is required to make `position: absolute` dragging behave correctly relative to a parent container instead of the viewport. Using the `useDraggable` composable directly, inside a small wrapper component, was the only way to access that option.

**Position flows in both directions.** Parent → child via `initialX`/`initialY` props + a `watch` (used by shuffle/order and by group drag to move tiles that aren't being dragged). Child → parent via the `move` emit (so the parent's `tile.x`/`tile.y` is always the tile's real on-screen position). See decisions 5 and 8.

## Key architectural decisions (and the bugs that motivated them)

1. **`position: absolute` on tiles, `position: relative` + `perspective` on the board**, with `containerElement: () => props.containerRef` passed into `useDraggable`.
   - _Why:_ `useDraggable` computes x/y via `getBoundingClientRect()`, which is always viewport-relative unless you explicitly pass `containerElement`. Without it, tiles "jump" and drag incorrectly inside any ancestor with `position`/`perspective`/`transform` set (these properties change what `position: fixed` means, and `absolute` alone doesn't fix vueuse's internal math).

2. **Every tile is a separate child component, keyed by `tile.id`** (not array index).
   - _Why:_ Vue reuses component instances across re-renders when a stable `:key` is used, which is required so each tile's internal drag position (state living _inside_ `useDraggable`, not in the parent array) survives array reordering (e.g. shuffle).

3. **"Bring to front" (z-ordering) is implemented via a numeric `zIndex` on each tile, not DOM order.**
   - Each tile gets `zIndex: index` at construction. A single counter in the parent (`frontMostTile`) holds the next top value; on pick (drag start / `onStart`), the picked tile is assigned the counter's value and the counter increments. That step is `bringToFront(tile, frontMostTile)` in `tileActions.ts`, which takes the counter ref so `App.vue` and `useWall` share it. The value is bound as `:style="{ zIndex }"` on `<TileDraggable>`, which Vue merges with the `left`/`top` style `useDraggable` sets on the child's root element (fallthrough `style` merging).
   - `orderTiles()` and `shuffleTiles()` reset every tile's `zIndex` to its `id` and reset the counter to `Tiles.length`, so z-index values don't grow across games.
   - _Bug this fixed:_ the earlier version spliced the picked tile out of the `tiles` array and pushed it to the end, letting DOM paint order decide stacking. Because the `v-for` is keyed, Vue physically moved that tile's DOM node during `pointerdown`. The browser then didn't deliver the following `click` to the moved node, so the first click on any tile that wasn't already last in the array was swallowed — shift-click selection (and plain-click flip) needed two clicks. With `zIndex`, the DOM never moves on pick, so `click` fires reliably.
   - _Alternative considered:_ keep a separate `stackOrder` array of ids and derive z-index from each id's position in it (keeps values small, but costs an `indexOf` per lookup). The counter was chosen for simplicity; its growth within a game is irrelevant in practice (browser z-index max is a 32-bit int).

4. **Tile position (`x`, `y`) is stored on the tile object itself, not derived from array index.**
   - _Bug this fixed:_ an earlier version computed each tile's initial position from its index in the array (`getInitializedPosition(index)`). Once array reordering was introduced (the old splice-based bring-to-front), every tile's index shifted, which cascaded into every subsequent tile's position changing as an unintended side effect. Fix: assign `x`/`y` once at construction time and treat them as real, independent tile state from then on.
   - Related rule: **never index `tiles.value` by id.** Shuffle reorders the array, so `tiles.value[id]` silently points at the wrong tile. Look tiles up with `tiles.value.find(t => t.id === id)`.

5. **Resetting/shuffling tile position uses `watch` inside the child component, not a forced remount.**
   - The parent updates `tile.x`/`tile.y` (after a Fisher-Yates shuffle of the array + randomizing coordinates); the child watches `[() => props.initialX, () => props.initialY]` and imperatively sets the composable's internal `position.value` when they change. Chosen deliberately over the "bump a key to force remount" alternative, for learning purposes (understanding `watch`'s explicit source-tracking model, in contrast to React's `useEffect`).
   - The watch early-returns when the incoming value already equals the composable's current `x`/`y`. Without that guard, every drag frame round-trips (child emits `move` → parent writes `tile.x` → prop changes → watch writes the same value back into `position`). It converges immediately, but it's a redundant write per frame.

6. **Orientation and flip (`rotateY`) are composed in one `transform` string** on `.tile-3d`: `rotateZ(orientation) rotateY(flip)`. They coexist safely because `transform-style: preserve-3d` is set on the tile wrapper.
   - _Order matters:_ transform functions apply right to left in the element's local frame ([MDN: transform](https://developer.mozilla.org/en-US/docs/Web/CSS/transform)). Orientation goes first (outermost) so a tile flips relative to its own facing.
   - _One rotation field, not two._ An earlier version had a separate `rotationZ` for a riichi/call turn on top of `orientation`. Once right-click could turn a tile in every direction, the two fields meant the same thing ("which way does this tile face"), so they were merged into `orientation`. Hit-testing then covers player-rotated tiles for free.
   - _Rotation doesn't encode game state._ It doesn't mark riichi (that's a per-seat flag; see Near-term scope), and it doesn't say which seat a tile belongs to. Seat ownership will come from position (which seat's hand zone a tile sits in), for the same reason as the slot model in decision 15: cheating moves tiles between seats, and anything stored apart from position goes stale.

7. **Interaction model, to avoid gesture collisions:**
   - Single click → flip face up/down (skipped if the pointer moved more than `DRAG_THRESHOLD` px since pick, so finishing a drag doesn't flip the tile)
   - Shift+click → toggle the tile in/out of the selection (no flip)
   - Right-click (`@contextmenu.prevent`) → rotate 90° clockwise (repeated clicks cycle through all four directions)
   - Pointerdown on a tile (drag start) → bring tile to front; if it's part of a multi-tile selection, start a group drag
   - Mousedown on empty board + drag → marquee box select; shift held at mousedown makes it additive
   - Click on empty board (no shift) → clear selection; there's also a "Reset Selection" button
   - **Click vs. drag disambiguation** uses `hasMoved(from, to, DRAG_THRESHOLD)` (Euclidean distance, 3px) in both the tile click handler and the marquee mouseup, so "did this move?" has one definition and one constant.

8. **Child → parent position sync happens on every `move`, not on `end`.**
   - _Why:_ marquee hit-testing and group drag both read `tile.x`/`tile.y` from the parent. Before this, the parent's values were written once at mount and went stale as soon as a tile was dragged. Syncing in `onMove` (not `onEnd`) is required for group drag: the other selected tiles have to follow frame by frame, or they'd sit still and snap into place on release.

9. **Selection is a `Set<number>` of tile ids in `useSelection`, owned by the board.**
   - Selection only ever contains tiles explicitly shift+clicked or marquee-selected. A non-shift interaction with a tile that isn't part of a multi-tile selection **clears** the selection on drag-end.
   - _Why clear, not collapse-to-this-tile (Figma-style):_ `onEnd` fires for plain clicks too, so collapsing meant every flip silently selected that tile, and the next shift+click would unintentionally include it. A one-tile selection enables nothing (group drag needs `size > 1`), so nothing useful was lost.
   - `isInGroup(id)` returns true only when the id is selected **and** `size > 1`, meaning "this tile is part of a draggable group." It is deliberately not a plain membership check; the template reads `selectedIds.value.has(id)` directly for the outline.

10. **Selection decisions are made at drag-_end_, never at drag-_start_.**
    - _Bug this fixed:_ collapsing the selection in `pick` (mousedown) broke shift+click. `pick` fires on the mousedown of a shift+click, before `click`: pick collapsed the set to `{2}`, then click's toggle saw tile 2 already selected and removed it → `{}`. You couldn't select more than one tile.
    - `end` carries the native event, so `handleOnEnd` can read `shiftKey` and skip mutating the selection when shift is held, leaving `click`'s toggle as the only writer. The rule is "only one handler mutates the selection per interaction."
    - The clear condition is `!e.shiftKey && !isInGroup(tile.id)`, i.e. `!(has && size > 1)`. Keep it un-distributed: an earlier draft negated only the first operand (`!has && size > 1`) and missed the `{1}`-then-drag-tile-2 case (De Morgan).
    - _Why `useDraggable`'s `onEnd` instead of a raw `@mouseup` on the tile:_ an element-level `mouseup` only fires if the pointer is still over that element on release. During a fast drag the tile lags the pointer by a render tick, so releases intermittently miss it. vueuse tracks the drag with document/window-level listeners, so `onEnd` always fires.

11. **Group drag moves the other tiles by an absolute delta from a fixed snapshot.**
    - On pick of a tile in a multi-tile selection: record the dragged tile's start position (`dragStartPos`), its id (`activeDragId`), and snapshot every _other_ selected tile's `x`/`y` into `groupDragOrigin: Map<id, Point>`. The group is restacked to the front, sorted by current `zIndex` first so their relative stacking order is preserved, then the dragged tile goes on top.
    - On each `move` of the active tile: `dx/dy = position − dragStartPos`, and each other tile gets `x = origin.x + dx`. Those writes flow back down through props → the child's `watch` (decision 5): group drag reuses the exact path shuffle/order use, continuously.
    - The dragged tile is never double-moved because it's excluded from `groupDragOrigin`; it's positioned only by its own `useDraggable`.
    - _Bug this fixed:_ an earlier version did `origin.x += dx` on every frame. `dx` is already cumulative since drag start, so the offset compounded and tiles flew off screen. The snapshot must stay fixed for the whole drag.
    - On `end`, `activeDragId` and `groupDragOrigin` are cleared.

12. **Marquee (`useMarquee`): window-level listeners, board-only start, rect hit-test.**
    - `mousedown` is bound on `.board` but early-returns unless `event.target === boardRef.value`, so a mousedown on a tile starts a tile drag, never a marquee.
    - `mousemove`/`mouseup` are registered with `useEventListener(window, …)` during setup. _Why window:_ the pointer can leave the board mid-gesture (e.g. release over the buttons); a board-level `mouseup` would never fire and the marquee would stay stuck. Registering during setup means vueuse auto-removes them on unmount.
    - Pointer coords are converted to board space with `clientToBoard` (`clientX − board.getBoundingClientRect().left`), matching the coordinate space of `tile.x`/`tile.y`.
    - The box is normalized into a `Rect` via `computed` (min/max of start and current), so dragging up/left works.
    - Hit-test: `rectsIntersect(tileToRect(tile), rect)`. Overlap is strict: rectangles whose edges only touch do **not** intersect (`!(b.left >= a.right) && !(b.right <= a.left)`, same for y), so a marquee that grazes a tile's edge doesn't select it. Tiles hidden under other tiles are selected too; that's consistent with "automate, don't judge."
    - **Hit-testing follows `orientation`.** `tileToRect` delegates to `orientedRect`, which swaps width and height around the tile's centre for orientations 90/270, so sideways tiles hit-test correctly, whether the wall build or a right-click turned them.
    - The marquee renders at `zIndex: frontMostTile + 1` with `pointer-events: none`, so it draws above every tile without intercepting events.

13. **Wall slot model: geometry is a pure function, and tile positions stay the source of truth.**
    - A slot is `{ seat, stack: 1..17, layer: 'top' | 'bottom' }`. `slotPosition(slot, brk?)` maps a slot to board coordinates plus an orientation. The wall keeps no persistent list of tile ids.
    - _Why:_ cheating moves tiles without the app knowing. A stored `liveWall: number[]` would go stale on the first cheat. With slots, whatever tile physically sits in a slot _is_ the tile in that slot. Position-based occupancy lookup (snap + tolerance) is deferred to the deal/draw feature, its first real consumer.
    - Side-wall tiles (South/North) are offset by `(TILE_HEIGHT − TILE_WIDTH) / 2` in x and y, because CSS rotates around the element's centre while `left`/`top` still describe the unrotated box ([MDN: transform-origin](https://developer.mozilla.org/en-US/docs/Web/CSS/transform-origin)).
    - The table is a fixed square (`TABLE_SIZE = 2 × CORNER_GAP + WALL_SIZE × TILE_WIDTH`), offset by `HAND_MARGIN` to leave room for future hand zones, and centred horizontally at build time from `boardRef.clientWidth`. The board's `min-height` is `MIN_BOARD_HEIGHT` so the square fits; the page scrolls on small screens.

14. **The dice break opens a gap at both ends of the dead wall.** Every stack shifts toward its own wall's stack 17: the dice wall's live stacks past the break by `2 × BREAK_GAP`, all 7 dead-wall stacks (including any wrapped onto the next wall) by `BREAK_GAP`, and everything else not at all. The differences leave a `BREAK_GAP` gap on each side of the dead wall, with no overlaps for any total 2–12. Earlier versions that moved only the dead wall, or only the live side, either collided with live stacks or left the dead wall flush at its far end. Full history: spec design decision 9.
    - The dead wall's wrap (total < 7) uses a 68-stack ring with modular arithmetic, normalised with `((n % 17) + 17) % 17` because JS `%` keeps the dividend's sign ([MDN: Remainder](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Remainder)).

15. **Randomness stays at the edge.** `computeBreak`, `deadWallStacks`, `doraIndicatorSlot`, `slotPosition`, and `assignTiles` take dice values and an already-shuffled id order as arguments. Only `useWall` calls `Math.random`, which keeps the wall logic deterministic and table-testable.

16. **The build sequence is timed with `setTimeout`, and its transitions are scoped to the build.**
    - `buildWall()` awaits a `wait(ms)` helper between beats (build → roll → break → dora flip). Timer ids go into a `pendingTimers` set that `onScopeDispose` clears, so unmounting mid-build cancels the sequence. Timers were chosen over `transitionend`, which fires once per element _per property_ (136 tiles × `left`/`top`), making "all done" awkward to detect.
    - `phase` (`'idle' | 'building' | 'rolling' | 'breaking'`) is written only by `buildWall()`. It drives the toolbar message, the button's `disabled`, and a `building` class on `.board`.
    - The `left`/`top` transition lives only on `.board.building .tile`, with its duration bound via `v-bind` in CSS. _Why:_ `useDraggable` and group drag both write inline `left`/`top`, so a permanent transition would make drags lag the cursor and group drags rubber-band. A per-tile `transitionDelay` of `i × BUILD_STAGGER_MS` makes the wall fill in, and beat 1 waits for the last tile.
    - `.board.building` also sets `pointer-events: none`, so a drag can't fight the CSS transition for a tile's position. This is a brief UI lock during an automated action, not a rules check.
    - Under `prefers-reduced-motion: reduce`, `wait` resolves immediately and CSS sets the slide and flip transitions to `0ms` ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)).

17. **A build resets the table.** All 136 tiles are shuffled and placed regardless of where they were; face, orientation, zIndex, and selection are reset. Bottom-layer tiles get `zIndex: 0`; top-layer tiles go through `bringToFront` after `frontMostTile` resets to 136, so tops always draw over bottoms. Same-layer tiles never overlap (covered by collision tests for every total), so no screen-y ordering is needed.

18. **Dragged tiles get a `lifted` class** (larger drop shadow). `isLifted(tile)` is true for the tile being dragged (`draggedId`, set in `handlePick`, cleared in `handleOnEnd`) and for the other tiles in a group drag (`groupDragOrigin`).

## Known open items / not yet implemented

- **Snap-to-grid / slot occupancy**: not natively supported by `useDraggable` (confirmed via docs — no `grid`/`snap` option exists). Plan is to implement manually via the `onEnd` callback, snapping to wall slots (`slotPosition`) and hand areas via a bounds check, leaving discards and calls freely draggable. The position-based "which tile is in slot k" lookup comes with it, driven by the deal/draw helper. (`tileInSlot` exists, but it reads the build's assignment map, not tile positions, and the app doesn't use it yet.)
- **Wall follow-ups**: dealing, "draw next tile", rinshan draws, kan dora flips, seat rotation (the dealer is always East, at the bottom). A `useWall` test (jsdom + fake timers) for "after a build, exactly one tile is face-up" is not written; it's verified manually.
- **Hand zones, seat/round indicators, riichi flag+pool, swap mode**: none implemented yet — see Near-term scope above for what each should do.
- **Touch support**: the double-click/double-tap rotate fallback and `touch-action: manipulation` described in earlier versions of this doc were never implemented. Rotation is right-click only, so it's unavailable on touch devices. Marquee and selection are mouse-event based (`mousedown`/`mousemove`/`mouseup`, `shiftKey`) and won't work on touch either.
