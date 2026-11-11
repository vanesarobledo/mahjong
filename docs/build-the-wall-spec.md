# Build the Wall — Spec

A "Build Wall" helper that shuffles all 136 tiles into a physically accurate 4-wall square, rolls dice, breaks the wall, splits off the dead wall, and flips the first dora indicator.

This is a **setup convenience** (see `mahjong-project-summary.md` → Goal & scope philosophy). It never validates or blocks play. After the build finishes, every tile is as freely movable as before, and players who want to cheat during the wall-building phase can build the wall by hand instead.

Implementation is test-first and Socratic: this spec gives behaviour, function **signatures**, and **test cases**. It deliberately does not give implementations.

---

## Scope

**In scope**

- Gather all 136 tiles (wherever they are), shuffle, and lay them out as 4 walls × 17 stacks × 2 tiles.
- Roll 2d6, pick the wall to break, make the break, split off the 7-stack dead wall with a visible gap.
- Flip the first dora indicator face-up.
- A three-beat animated transition (build → roll → break), with a reduced-motion fallback.
- A dice result line in the toolbar.
- A new per-tile `orientation` field, separate from the riichi `rotationZ`.

**Out of scope (future)**

- Dealing hands, "draw next tile", rinshan draws, kan dora flips.
- **Slot occupancy and snap-to-grid.** This spec defines slot _geometry_ only. Deciding "which tile is in slot k" (a position match with snap + tolerance) arrives with the deal / draw spec, which is its first real consumer. Designing tolerance values now would be guessing without a use to check them against.
- A real dice-rolling animation (the text reveal stands in for it).
- Multiple dealers / seat rotation. The dealer is always East.

---

## Rules being modelled

Seats, from the viewer's screen: **East = bottom (dealer), South = right, West = top, North = left.** Turn order is counterclockwise: E → S → W → N.

1. **Wall:** each seat has a wall in front of them, 17 stacks long, 2 tiles high (136 tiles total). Stacks are numbered **1–17 from the wall's right end, as its owner sees it.**
   - East's right end is screen-right; South's is screen-top; West's is screen-left; North's is screen-bottom.
2. **Which wall breaks:** sum the two dice and count seats counterclockwise from the dealer, starting at 1.
   - 5, 9 → East · 2, 6, 10 → South · 3, 7, 11 → West · 4, 8, 12 → North
3. **Where it breaks:** on that wall, count _total_ stacks in from the right end. The break is on the **left side** of that stack.
4. **Dead wall:** the 7 stacks immediately to the **right** of the break. If total < 7, it wraps around the corner into the next wall counterclockwise (the dice wall owner's right-hand neighbour), starting from that wall's stack 17.
   - Dead-wall stacks are numbered **1–7 starting from the break.**
5. **Live wall:** drawn starting just left of the break, moving clockwise. (Recorded for the future deal helper; nothing in this spec draws.)
6. **Dora indicator:** the **top tile of dead-wall stack 3** (third stack from the break).
7. **Reference only (future):** rinshan replacement tiles come from dead-wall stacks 1–2 (closest to the break). Kan dora indicators continue away from the break: stacks 4, 5, then 6.

Source: [Wikipedia — Japanese mahjong](https://en.wikipedia.org/wiki/Japanese_mahjong) confirms 4 × 17 × 2 walls, the 7-stack dead wall, and "the upper tile from the third stack from the back end of the dead wall". The dice-counting rules (2–4) were confirmed by the project owner.

---

## Design decisions

1. **Slot model.** A _slot_ is a fixed wall position: `{ seat, stack: 1..17, layer: 'top' | 'bottom' }`. Slot → screen geometry is a pure function. Tile positions remain the only source of truth for where tiles are; the wall does not keep a persistent list of tile ids.
   - _Why:_ cheating moves tiles without the app knowing. A persistent `liveWall: number[]` goes stale on the first cheat; a slot model stays correct because whatever tile physically sits in a slot _is_ the tile in that slot. (Occupancy lookup itself is deferred — see Out of scope.)
2. **Build always takes all 136 tiles and shuffles.** It resets face, rotation, orientation, zIndex, and selection. Building the wall means starting a new hand.
3. **Realistic dice break**, dealer fixed as East at the bottom until seat tracking exists.
4. **New `orientation` field** on `Tile`, typed as the literal union `0 | 90 | 180 | 270`. Each wall's tiles have their bottom edge facing the wall's owner. Separate from `rotationZ`, which keeps meaning "riichi/call rotation".
   - Shuffle and Order reset orientation to `0`.
5. **Stacks render with the top tile offset upward in _screen_ space** (the viewer's camera), for every wall. Offsetting along each wall's own orientation would make side-wall stacks look like they're leaning sideways.
6. **Fixed table size derived from constants**, centered horizontally on the board, page scrolls on small screens. Geometry functions return positions relative to the table origin; the composable adds the origin (which depends on board width at runtime). Leave margin around the square for future hand zones; hand zones are not designed here.
7. **Randomness stays at the edge.** Pure functions take dice values (and an already-shuffled id order) as arguments. Only the composable calls `Math.random`.
8. **Code layout:** pure functions in `src/utils/wall.ts`; a `useWall(...)` composable owns dice state, the build sequence, and `buildWall()`. Dependencies (`tiles`, `frontMostTile`, `selection`, `boardRef`) are passed in explicitly, the way `useMarquee` receives its dependencies.
   - _Why not leave orchestration in `App.vue`:_ `useGroupDrag` stayed state-only and left its logic stranded in `App.vue`; don't repeat that.

---

## Constants (in `src/constants.ts`, all tunable)

| Name               | Starting value   | Meaning                                               |
| ------------------ | ---------------- | ----------------------------------------------------- |
| `STACK_OFFSET`     | ~8px             | Screen-space upward offset of the top tile in a stack |
| `BREAK_GAP`        | `TILE_WIDTH / 2` | Gap opened at the break (subject to change once seen) |
| `CORNER_GAP`       | ≥ `BREAK_GAP`    | Clearance at each corner of the square                |
| `BUILD_SLIDE_MS`   | 600              | Beat 1: tiles slide into the closed square            |
| `DICE_REVEAL_MS`   | 400              | Beat 2: "Rolling…" resolves to the result             |
| `BREAK_MS`         | 400              | Beat 3: gap opens, dora flips                         |
| `BUILD_STAGGER_MS` | ~5 (optional)    | Per-slot delay so the wall "fills in"                 |

---

## Behaviour

### The Build Wall button

- Lives in the toolbar.
- Disabled while a build sequence is running.

### The three-beat sequence

1. **Build** (`BUILD_SLIDE_MS`): all 136 tiles slide from wherever they are into a **closed** 4-wall square (no break gap) and flip face-down.
2. **Roll** (`DICE_REVEAL_MS`): the toolbar shows "Rolling…", which resolves to e.g. **"Dice: 3 + 5 = 8 → West wall"**.
3. **Break** (`BREAK_MS`): the break gap opens and the dora indicator flips face-up.

The dice line stays visible until the next build.

### Transition mechanics

- `useDraggable` positions tiles with inline `left`/`top`. A permanent `transition: left, top` on `.tile` would make every drag lag behind the cursor and make group drag rubber-band (it moves tiles through the same prop → `watch` path).
- So: `.board` gets a `building` class while the sequence runs, and the `left`/`top` transition is scoped to `.board.building .tile`.
- While `building`, the board has `pointer-events: none`. A drag started mid-transition would have the tile's position written by both the CSS transition and `useDraggable`. This is a ~1.4s UI lock, not a rules check.
- **`prefers-reduced-motion: reduce`:** skip the slide and gap animation (and the flip transition); jump to the final broken-wall state. The dice text still appears. ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion))
- Timers started by the sequence must be cleaned up if the component unmounts mid-build.

### Final state after a build

- Every tile is in exactly one wall slot.
- Every tile is face-down (`isFaceUp: false`, `rotationY: 180`), `rotationZ: 0`, `orientation` = its wall's orientation.
- Except the dora indicator: face-up.
- Selection is cleared.
- zIndex: top layer above bottom layer; tiles lower on screen above tiles higher on screen (so the upward offset overlaps correctly). zIndex values stay within `0..135`, and `frontMostTile` resets to `136`, matching Shuffle/Order.
- The break gap is open between dead-wall stack 1 and the live wall.

---

## Phases

Each phase: write the listed tests first (red), then the code (green), then refactor. If stuck on a phase's tests, ask for them and write the functions yourself.

### Phase 0 — Scaffold Vitest

**Done.** Vitest is scaffolded: `vitest.config.ts` (merges `vite.config.ts`, so the `@` alias works), `tsconfig.vitest.json`, a `test` script, and a smoke test at `src/utils/__tests__/geometry.spec.ts`. Put new specs in `src/utils/__tests__/` (e.g. `wall.spec.ts`).

### Phase 1 — Slot geometry (no break)

Suggested signatures (names are yours to change):

```ts
type Seat = 'East' | 'South' | 'West' | 'North'
type Orientation = 0 | 90 | 180 | 270
type Slot = { seat: Seat; stack: number; layer: 'top' | 'bottom' }

allSlots(): Slot[]                                   // canonical order, length 136
seatOrientation(seat: Seat): Orientation
slotPosition(slot: Slot): Point & { orientation: Orientation }   // relative to table origin
orientedRect(pos: Point, orientation: Orientation): Rect         // on-screen footprint
```

Test cases:

- `allSlots()` returns 136 slots, all unique; each seat has 17 stacks × 2 layers.
- Orientation per seat makes each wall's bottom edge face its owner.
- Stack 1 of each wall is at its owner's right end (East → screen-right, South → screen-top, West → screen-left, North → screen-bottom).
- Adjacent stacks in a wall are `TILE_WIDTH` apart along the wall's axis.
- For every seat, the top tile is exactly `STACK_OFFSET` above the bottom tile in screen y, same screen x.
- No two bottom-layer footprints (`orientedRect`) overlap, across all four walls including corners (reuse `rectsIntersect`).
- Every footprint lies inside the table square.
- `orientedRect` at 0 / 180 equals today's `tileToRect`; at 90 / 270, width and height swap **around the tile's centre**.

### Phase 2 — Dice → break → dead wall, and the gap

```ts
type Break = { total: number; seat: Seat; stack: number }

computeBreak(die1: number, die2: number): Break
deadWallStacks(brk: Break): Array<{ seat: Seat; stack: number }>   // length 7, ordered from the break
slotPosition(slot: Slot, brk?: Break): ...                         // gap applied when brk given
```

Test cases:

- `computeBreak` maps every total 2–12 to the right seat (a table test with `it.each` fits well).
- `deadWallStacks` always returns 7 distinct stacks.
- Total 8 (East): East 8, 7, 6, 5, 4, 3, 2. East stack 1 is _not_ dead.
- Total 12 (North): North 12 → 6, no wrap.
- Total 3 (West): West 3, 2, 1, then North 17, 16, 15, 14 (wrap).
- Total 2 (South): South 2, 1, then West 17, 16, 15, 14, 13 (wrap).
- With a break: the dead-wall stacks on the dice wall shift `BREAK_GAP` away from the break, toward the corner; every other slot's position is unchanged from Phase 1.

### Phase 3 — Assign tiles to slots

```ts
assignTiles(shuffledIds: number[]): Map<number, Slot>   // tile id → slot
```

Test cases:

- 136 ids in → 136 entries out; every slot used exactly once.
- Deterministic: the same id order gives the same assignment.
- Throws (or otherwise signals) if not given exactly 136 unique ids.

### Phase 4 — `orientation` on `Tile`, rendering, and `tileToRect`

- Add `orientation: Orientation` to `Tile`; initialize to `0`; Shuffle and Order reset it.
- Render it as part of the `.tile-3d` transform alongside `rotateY` (flip) and `rotateZ` (riichi).
- `tileToRect` uses `orientedRect`, so the marquee hit-tests side-wall tiles correctly. This also resolves the "rotated tiles use the unrotated rect" open item for _orientation_. Riichi `rotationZ` is still ignored.

Test cases: `tileToRect` for each orientation; existing marquee behaviour is unchanged for orientation 0.

### Phase 5 — `useWall` composable, button, dice line, sequence

- `useWall(boardRef, tiles, frontMostTile, selection)` exposes the dice result, the current phase (e.g. `'idle' | 'building' | 'rolling' | 'breaking'`), and `buildWall()`.
- Only this composable calls `Math.random` (dice and shuffle).
- Board centering: table origin computed from `boardRef` width.

Manual acceptance (browser):

- [ ] Clicking Build Wall from any board state ends in the final state above.
- [ ] The three beats play in order; total ≈ 1.4s.
- [ ] Clicks and drags do nothing during the sequence; the button is disabled.
- [ ] After the sequence, drag is instant again (no lag), and group drag doesn't rubber-band.
- [ ] With reduced motion on (macOS: System Settings → Accessibility → Display → Reduce motion), the final state appears immediately with the dice line.
- [ ] Building twice in a row works; the second build uses fresh dice.

### Phase 6 — Dora flip

```ts
doraIndicatorSlot(brk: Break): Slot   // top layer of dead-wall stack 3
```

Test cases:

- Total 8 (East) → East stack 6, top.
- Total 3 (West) → West stack 1, top.
- Total 2 (South) → West stack 17, top (wrapped).
- After a build, exactly one tile is face-up and it sits in that slot.

### Phase 7 — Stack styling (yours)

Make stacks read as stacks: the bottom tile peeking out below the top tile, edges/shadows so the two layers are distinguishable, and face-down backs that don't blur together across a 17-stack wall.

---

## Learning checkpoints

Questions to answer while implementing:

- **Phase 1:** CSS rotates around the element's centre (`transform-origin: 50% 50%` by default). A 50×72 tile rotated 90° has a 72×50 footprint, but its `left`/`top` still describe the _unrotated_ box. What does that mean for where you place side-wall tiles? ([MDN: transform-origin](https://developer.mozilla.org/en-US/docs/Web/CSS/transform-origin))
- **Phase 2:** the wrap case (total < 7) can be handled with per-seat branching, or by treating all 68 stacks as one ring and using modular arithmetic. What does each make easy or hard to test? Watch for JS `%` on negative numbers.
- **Phase 4:** the tile's transform composes `orientation`, `rotateY` (flip), and `rotateZ` (riichi). Does the order of those functions in the `transform` string matter? Try a riichi-rotated tile on a side wall. ([MDN: transform](https://developer.mozilla.org/en-US/docs/Web/CSS/transform))
- **Phase 5:** sequence the beats with timers (`setTimeout` + the duration constants) or with `transitionend` events. `transitionend` fires once per element _per property_. Which is simpler to get right for 136 tiles?
- **Phase 5:** why is `pointer-events: none` during the build consistent with "never block a player's move"?
