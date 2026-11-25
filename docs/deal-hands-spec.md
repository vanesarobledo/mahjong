# Hand Zones & Deal — Spec

Four labelled hand zones, one per seat, and a "Deal" helper that takes the starting hands from the broken wall in the real riichi order and places them in those zones.

This is a **setup convenience** (see `mahjong-project-summary.md` → Goal & scope philosophy). It never validates or blocks play. Players can still fill their hands by dragging tiles by hand. Before the deal, a player can rearrange the wall however they like, and the deal will hand out whatever tiles are physically in the wall.

Implementation is test-first and Socratic, like `build-the-wall-spec.md`: this spec gives behaviour, function **signatures**, and **test cases**, but no implementations. All names are suggestions you can change.

> **Status: approved.** Every design decision, constant and behaviour has been confirmed by the project owner. Constants are starting values to tune by feel.

---

## Scope

**In scope**

- Hand slot geometry: `seat + index → position + orientation`, for 14 positions per seat (13 + a drawn-tile position).
- Four labelled hand zones drawn on the board.
- Live-wall draw order after the break.
- **Position-based slot occupancy**, which `build-the-wall-spec.md` deferred to this spec: "which tiles are physically in this wall stack right now".
- A Deal button that deals 14 tiles to East and 13 to each other seat in the real riichi order, as an animated sequence with a reduced-motion fallback.

**Out of scope (future)**

- Snap-to-grid for hand-dragged tiles, and hand sorting/rearranging helpers.
- "Draw next tile", rinshan draws, kan dora flips. This spec's live-wall order and occupancy lookup are built so these can reuse them.
- Meld / called-tile areas, and the discard area.
- Seat ownership derived from position ("which hand zone is this tile in").
- Auto-sorting dealt hands.
- Dealer rotation. The dealer is still always East, at the bottom.
- Per-viewer rendering for multiplayer.

---

## Rules being modelled

Seat layout and wall numbering are as in `build-the-wall-spec.md` → Rules (East bottom, South right, West top, North left; stacks numbered 1–17 from each wall's right end, as its owner sees it).

1. **Live wall direction:** taking tiles starts at the stack just **left** of the break (dice wall, stack `total + 1`) and moves **clockwise**, toward higher stack numbers. After a wall's stack 17, it continues at stack 1 of the wall to that owner's left: East → North → West → South → East.
   - This is the same 68-stack ring `deadWallStacks` uses (East +0, North +17, West +34, South +51), walked forward from the break instead of backward.
   - The live wall is 61 stacks (68 − 7 dead), so 122 tiles.
2. **Within a stack, the top tile is taken before the bottom tile.** "Draw index" below means a position in that flattened sequence: index 0 = top of the first live stack, 1 = its bottom, 2 = top of the second stack, and so on.
3. **Three rounds of 4:** East takes 4 tiles (2 stacks), then South, West, North take 4 each. Repeat twice more, giving 48 tiles (draw indices 0–47), 12 per seat.
4. **One tile each:** East, South, West, North each take one tile in order: draw indices **48, 49, 50, 51**. Everyone has 13.
5. **East's draw:** East takes draw index **52** as their first draw. East has 14 tiles and the others 13. East discards first.

The conventional shortcut (Note 9 below) has East take 48 and 52 together, before the others take 49, 50, 51. Every seat ends up with exactly the same tiles. The app animates the order above (Rules 4–5).

Source: Christopher Yee, _A Guide for Learning and Playing Japanese Mahjong — Setup & Gameplay Reference_ (CC BY-NC-SA 4.0), the project owner's reference:

- Step 4, "Deal the Tiles" (p. 3): "East takes the first four tiles from the live wall after the original break in the wall. Tiles are taken clockwise along the wall. South takes the next four tiles, West the next four, North the next four, and so on until all players have 12 tiles. East, South, West, and North then each take one tile in order, taking the top tile of a stack, then the bottom tile before moving onto the next stack."
- Note 9 (p. 8): "After each player has 12 tiles, East takes two tiles: the top tiles from the first and third stacks in the wall. South, West, and North then each take one tile in order. This procedure effectively gives East the 14th tile they would have drawn at the start of play."

[riichi.wiki — Japanese mahjong setup](https://riichi.wiki/Wall_break) describes the same Note 9 procedure.

---

## Design decisions

1. **(decided) Side hands are rotated toward their owner**, using `seatOrientation(seat)`, the same as that seat's wall. Seat ownership stays geometric and matches the walls. Side hands need the same `(TILE_HEIGHT − TILE_WIDTH) / 2` centre-rotation offset as side walls.
2. **(decided) The deal follows the real riichi order** (Rules 3–5), with no round-robin. A player who stacks the wall by hand is counting on the physical deal order, so a different order would quietly undo their cheat.
3. **(decided) The deal reads the wall by tile position.** It never reads the build's assignment map. Whatever tile is physically in a live stack when Deal is clicked is the tile dealt. This is the occupancy lookup decision 13 in the summary deferred to this spec.
   - `tileInSlot` / the assignment map stay as they are. The deal doesn't use them. (Removing them is a separate cleanup you may want to do.)
4. **(decided) Occupancy matches by stack, then orders by `zIndex`.** A tile belongs to a stack when its centre is within `STACK_TOLERANCE` of that stack's bottom-slot centre. Among the tiles in a stack, the highest `zIndex` is the "top".
   - _Why not match top/bottom slots separately by position:_ the two layers are only `STACK_OFFSET` (8px) apart, so any tolerance big enough to forgive a hand-placed tile would match both layers. "The top tile is the one on top" is also how a physical table works.
   - This handles odd stacks for free. A stack a player emptied contributes 0 tiles, and a stack a player piled 3 tiles onto contributes 3, top-down. The deal just reads the next tiles in sequence.
   - `STACK_TOLERANCE` must be less than `TILE_WIDTH / 2` (half the stack pitch), so one tile can never be in two stacks.
   - **Distance is a straight-line (Euclidean) check** between centres: `Math.hypot(dx, dy) <= STACK_TOLERANCE`. Start here and tune by feel. If placing tiles back by hand turns out too fiddly, the next step is separate tolerances: under `TILE_WIDTH / 2` along the wall, looser across it.
   - **Orientation and face don't matter.** A sideways tile or a face-up (peeked) tile in a live stack still counts as in the wall.
   - **Top/bottom comes from `zIndex`, never screen y**, so the lookup agrees with what the player sees: a tile dropped onto a stack draws on top, so it counts as on top.
   - **Requirement on the future swap feature:** a swap must exchange the two tiles' `zIndex` along with `x`, `y` and `orientation`. With coordinates only, a recently picked hand tile swapped into a bottom slot keeps its high `zIndex`, so it reads (and draws) as the top tile. Exchanging `zIndex` means each tile takes over the other's exact place, layer included.
5. **(decided) Hand index runs left to right as the owner sees it.** Index 0 is the owner's leftmost tile: East → screen-left, South → screen-bottom, West → screen-right, North → screen-top. Indices 0–12 sit `TILE_WIDTH` apart. Index 13 is the drawn-tile position, a further `DRAWN_TILE_GAP` away.
   - East's 14th tile (draw 52, East's first draw) goes to index 13, so the dealer's hand looks like "13 + a drawn tile", which makes the first discard obvious.
6. **(decided) Each hand is centred along its seat's side of the table**, in the middle of the `HAND_MARGIN` band between the wall and the board edge. A hand plus the drawn-tile gap is `14 × 50 + 25 = 725px`, which fits inside the 1010px table side.
7. **(decided) The board gets a minimum width.** South's hand sits right of the table, so the board must be at least `TABLE_SIZE + 2 × HAND_MARGIN` wide (1314px with current constants), or South's hand ends up off-board. Add `MIN_BOARD_WIDTH` next to `MIN_BOARD_HEIGHT` and let the page scroll horizontally on narrow screens, like it already scrolls vertically.
8. **(decided) Hand zones are visual only.** Each zone is a labelled, positioned element behind the tiles with `pointer-events: none`, so the marquee still starts on empty board (`useMarquee` checks `event.target === boardRef.value`) and tiles drag over zones freely. Zones store no tile list, for the same reason the wall doesn't (decision 13).
9. **(decided) East's tiles end face-up; South, West and North stay face-down.** Each dealt tile gets its seat's orientation and goes through `bringToFront`.
10. **(decided) The deal lives in `useWall`.** It needs the break, the table x-offset, `phase`, `wait`, and the timer cleanup, all of which `useWall` already owns. _Alternative:_ a separate `useDeal`, which reads more cleanly by name but would need all of those passed in or exported. If you go with the alternative, pass dependencies in explicitly, the way `useMarquee` receives them.
11. **The x-offset the build used is stored and reused.** Tracked as Bug 1 in `bug-fixes-spec.md`, which must land before Phase 5 here. Occupancy lookup must use the same offset the build used, even if the window has been resized since.
12. **(decided) Deal availability:** the Deal button is enabled only when `phase === 'idle'`, a break exists, and this wall hasn't been dealt yet. Building again resets the "dealt" flag. This is about when the helper is available, and it never limits what players do by hand: they can still deal or redeal manually.

---

## Constants (in `src/constants.ts`, all tunable)

| Name              | Starting value   | Meaning                                                           |
| ----------------- | ---------------- | ----------------------------------------------------------------- |
| `HAND_SIZE`       | 13               | Tiles in a non-dealer starting hand                               |
| `DRAWN_TILE_GAP`  | `TILE_WIDTH / 2` | Extra gap before hand index 13                                    |
| `STACK_TOLERANCE` | `TILE_WIDTH / 4` | Max centre distance for a tile to count as "in" a stack (< 25)    |
| `DEAL_STEP_MS`    | 200              | Duration of each take (one seat's group of 4, or one single tile) |
| `DEAL_STAGGER_MS` | 30               | Per-tile delay within one take                                    |

---

## Behaviour

### Hand zones

- Four zones, always visible, labelled with the seat wind (e.g. "East (Dealer)"), positioned from `handZoneRect(seat)` plus the table x-offset.
- A zone is slightly larger than the 14 hand positions it holds, so tiles sitting in hand slots are visually inside it.
- Side-zone labels are rotated with the zone, or kept upright. Your call (Phase 1).

### The Deal button

- In the toolbar, next to Build the Wall. Enabled per decision 12.

### The deal sequence

1. Read the live wall once, at the start: `liveWallTiles(...)` gives the tiles in draw order.
2. Use `dealPlan()` to give each of the first 53 tiles its seat and hand index.
3. Play the takes in order, one `DEAL_STEP_MS` beat each: 12 group takes (E, S, W, N × 3), then 4 single-tile takes (E, S, W, N), then East's draw into the drawn-tile position. That's 17 beats.
4. After the last take, East's 14 tiles flip face-up together, like the dora reveal.
5. If the live wall has fewer than 53 tiles (players removed some), deal what there is, in plan order, and stop. **(decided)** This isn't an error, since the helper doesn't judge the table.

### Transition mechanics

- Reuse the build's mechanism: a board class turns on the `left`/`top` transition and `pointer-events: none` while the phase isn't `idle`. Today the class is called `building` and `isBuilding` is `phase !== 'idle'`; rename both to something like `animating` / `isAnimating` once `'dealing'` is a phase too.
- The transition duration and per-tile `transitionDelay` are bound to the deal constants while `phase === 'dealing'`.
- **`prefers-reduced-motion: reduce`:** `wait` already resolves immediately; tiles jump to their hand slots and East's tiles appear face-up.
- Timers go into the same `pendingTimers` set, so unmounting mid-deal cancels the sequence.

### Final state after a deal

- East has 14 tiles at hand indices 0–13, face-up. South, West and North have 13 each at indices 0–12, face-down.
- Every hand tile has its seat's orientation.
- The live wall is 53 tiles shorter. The tiles left in it haven't moved.
- The dead wall and dora indicator are untouched.
- Selection is cleared.

---

## Phases

Each phase: write the listed tests first (red), then the code (green), then refactor.

### Phase 1 — Hand geometry (`src/utils/hand.ts`)

```ts
handSlotPosition(seat: Seat, index: number): Point & { orientation: Orientation }  // relative to board, before x-offset (like slotPosition)
handZoneRect(seat: Seat): Rect                                                        // the zone's on-screen box, before x-offset
```

Test cases:

- Orientation per seat equals `seatOrientation(seat)`.
- Index 0 is at the owner's left (decision 5): East's index 0 has the smallest x, South's the largest y, West's the largest x, North's the smallest y.
- Adjacent indices 0–12 are `TILE_WIDTH` apart along the hand's axis; index 12 → 13 is `TILE_WIDTH + DRAWN_TILE_GAP`.
- Each hand is centred along its table side (the midpoint of indices 0 and 13's footprints lines up with the table's centre line).
- No hand footprint (`orientedRect`) intersects any wall footprint, for the unbroken wall and every break total 2–12.
- Every hand footprint lies inside its own `handZoneRect`; the four zones don't intersect each other or the table square.
- Every hand footprint lies inside a `MIN_BOARD_WIDTH × MIN_BOARD_HEIGHT` board.
- `handSlotPosition` throws for an index outside 0–13.

### Phase 2 — Hand zones on the board (yours, manual)

- Render the four zones and labels; add `MIN_BOARD_WIDTH`.
- Manual checks:
  - [ ] Zones line up with the table at several window widths, including narrower than `MIN_BOARD_WIDTH` (page scrolls horizontally).
  - [ ] Marquee still starts when the mousedown is over a zone.
  - [ ] Tiles drag over zones with no flicker or stuck hover state.

### Phase 3 — Live-wall order (`src/utils/break.ts`)

```ts
liveWallStacks(brk: Break): Array<{ seat: Seat; stack: number }>   // length 61, in draw order
```

Test cases:

- Always 61 distinct stacks, none of them in `deadWallStacks(brk)`; live + dead together cover all 68 stacks.
- Total 8 (North): starts North 9 … North 17, then West 1; ends at North 1.
- Total 12 (North): starts North 13 … 17, West 1 … 17, South 1 … 17, East 1 … 17, North 1 … 5.
- Total 3 (West): starts West 4 … 17, South 1; ends North 13.
- Total 2 (South): starts South 3; ends West 12.
- Total 5 (East): starts East 6 … 17, then North 1; ends South 15.

### Phase 4 — Deal plan (`src/utils/deal.ts`)

```ts
type DealTarget = { seat: Seat; handIndex: number }
dealPlan(): DealTarget[]   // indexed by draw index, length 53
```

Test cases:

- Length 53; East appears 14 times, every other seat 13.
- Every `(seat, handIndex)` pair is unique; East uses 0–13, the others 0–12.
- Draw indices 0–3 → East 0–3; 4–7 → South 0–3; 12–15 → North 0–3; 16–19 → East 4–7.
- Draw 48 → East 12; 49 → South 12; 50 → West 12; 51 → North 12; 52 → East 13.

_It's pure data with no inputs. Consider whether a hand-written table or a generator loop is easier to verify against the rules._

### Phase 5 — Position-based occupancy (`src/utils/occupancy.ts`)

```ts
tilesInStack(tiles: Tile[], stack: { seat: Seat; stack: number }, brk: Break, xOffset: number): Tile[]  // highest zIndex first
liveWallTiles(tiles: Tile[], brk: Break, xOffset: number): Tile[]                                      // in draw order
```

Test cases (build fixtures with `slotPosition` + `assignTiles`, the way the wall tests do):

- On a freshly built and broken wall: `liveWallTiles` returns 122 tiles; the first is the top tile of the first live stack, the second its bottom tile.
- No dead-wall tile ever appears.
- A tile swapped into a live slot from elsewhere (given that slot's position and a high `zIndex`) appears in that slot's place.
- A tile moved off the wall drops out; the sequence gets one shorter.
- A tile nudged by `STACK_TOLERANCE − 1` px is still found; by `STACK_TOLERANCE + 1` it isn't.
- Three tiles in one stack are all returned, highest `zIndex` first.
- A tile with a different `orientation` (turned sideways) or `isFaceUp: true` in a live slot is still found.
- A tile dropped onto a stack's bottom position with the highest `zIndex` is returned first (top), even though it's lower on screen.
- Works for a side wall (South or North) too, where `left`/`top` describe the unrotated box.

### Phase 6 — `dealHands()` in `useWall`, button, sequence

- Store the build's x-offset (decision 11) and a "dealt" flag (decision 12).
- Add `'dealing'` to `Phase`; generalise the `building` class.
- Wire the Deal button.

Manual acceptance (browser):

- [ ] After a build, Deal gives East 14 tiles (13 + drawn tile, face-up) and the others 13 face-down, all in their zones with the right orientation.
- [ ] The takes play in order: E → S → W → N in groups of 4 for three rounds, then one tile each, then East's draw.
- [ ] Swap two wall tiles by hand before dealing; they're dealt to the seats their new positions dictate.
- [ ] Pull a few tiles out of the live wall before dealing; the deal skips the gaps and doesn't error.
- [ ] Deal is disabled during the build, during the deal, and after the deal until the next build.
- [ ] With reduced motion on, the final state appears at once.
- [ ] Resize the window between build and deal; the deal still finds every wall tile.

---

## Learning checkpoints

- **Phase 1:** `slotPosition` uses one `if` block per seat. Could the hands reuse the walls' per-seat axis (the private `vector(seat)` in `wall.ts`) so each seat is "origin + index × direction", rather than four branches? What does each style make easier to test or to get wrong?
- **Phase 3:** `deadWallStacks` walks the ring backward from the break, and `liveWallStacks` walks it forward. Is there a shared helper hiding in there (ring index ↔ `{seat, stack}`)? Pull it out only if both functions get simpler.
- **Phase 5:** why compare tile _centres_ (or `left`/`top`) rather than `orientedRect` footprints? Hint: what happens to `left`/`top` when a tile rotates about its centre? ([MDN: transform-origin](https://developer.mozilla.org/en-US/docs/Web/CSS/transform-origin))
- **Phase 5:** `liveWallTiles` runs over 136 tiles × 61 stacks. Is that worth optimising, at one call per deal?
- **Phase 6:** the deal reads the wall once at the start. What would go wrong if it re-read the wall before every take, mid-animation?
