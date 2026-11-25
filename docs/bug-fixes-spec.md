# Bug Fixes — Spec

A running list of the bugs the project owner has chosen to fix. It isn't a full bug tracker: a bug goes here only once it's been picked.

Same format as the feature specs: symptom, cause, fix direction, signatures, and test cases, but no implementations. Write the tests first.

| #   | Bug                                          | Status | Must land before   |
| --- | -------------------------------------------- | ------ | ------------------ |
| 1   | Wall x-offset isn't kept after the build     | Open   | Deal spec, Phase 5 |
| 2   | Build leaves z-indices outside 0–135 (chore) | Open   | —                  |

---

## Bug 1 — Wall x-offset isn't kept after the build

**Severity: latent.** Nothing reads wall positions back today. It becomes a real bug once the deal's position-based occupancy lookup lands (`deal-hands-spec.md` → decision 11, Phase 5).

### Symptom (once a consumer exists)

Build the wall, resize the window, then deal. The occupancy lookup computes where each wall stack _should_ be with a fresh x-offset. The tiles were placed with the old offset, so no tile is within `STACK_TOLERANCE` and the deal finds an empty wall.

### Cause

`buildWall()` computes `const xOffset = getBoardXOffset()` as a local variable (`src/composables/useWall.ts`) and adds it into every tile's `x`. Tile positions are board-space with that offset baked in, but the offset itself is thrown away once the build ends. Any later code that needs "where is slot k on the board" can only recompute the offset from the board's _current_ width. That's only correct if the window hasn't changed size since the build.

Tiles deliberately don't move on resize (positions are the source of truth, decision 13), so the fix is to remember the offset, not to re-centre the tiles.

### Fix direction

- Keep the offset the build used in state owned by `useWall` (e.g. `tableOriginX: Ref<number>`), set once at the start of `buildWall()`.
- Give board-space wall geometry one entry point that applies the stored offset, e.g. `wallSlotOnBoard(slot)`, and have both `placeTiles` and the future occupancy lookup use it. Nothing outside `useWall` should add the offset by hand.
- **Before the first build** there's no stored offset, but the hand zones (deal spec, Phase 2) need one to render. Decide: compute it from the current board width until the first build, or compute and store it on mount. _Trade-off:_ computing on mount gives zones and walls one shared origin from the start, but it means the zones won't re-centre on resize until the next build either. That's consistent with the tiles, but it may look odd before any build.

```ts
// useWall return value gains:
tableOriginX: Readonly<Ref<number>>
wallSlotOnBoard(slot: Slot): Point & { orientation: Orientation }   // slotPosition(slot, brk) + stored offset
```

### Tests

This lives in a composable, so the cheapest coverage is pure:

- `getBoardXOffset` is already pure apart from reading `boardRef`. Pull it out as `tableOriginX(boardWidth: number): number` in `utils/wall.ts` and table-test it: a wide board centres the table; a board narrower than `TABLE_SIZE + 2 × HAND_MARGIN` clamps to 0.
- Removing the `1010` fallback is a candidate for the same change: with the function taking `boardWidth`, the caller decides what to do when `boardRef` is null.

Manual acceptance:

- [ ] Build the wall, resize the window narrower and wider, then (once Phase 5 exists) deal: every live-wall tile is found.
- [ ] Building again after a resize re-centres the new wall for the new width.

---

## 2 — Build leaves z-indices outside 0–135 (chore)

This is housekeeping, not a bug.

### Current behaviour

- **Shuffle and Order** set each tile's `zIndex` to its `id` (0–135) and reset `frontMostTile` to 136.
- **Build** (`resetTiles` in `useWall`) resets `frontMostTile` to 136, gives every bottom-layer tile `zIndex: 0`, then calls `bringToFront` on each top-layer tile. Tops end up at 136–203, bottoms all at 0, and the counter at 204.

### Goal

Build should end the way Shuffle and Order do: every tile's `zIndex` in 0–135 and `frontMostTile` at 136. After that, the counter keeps growing during play as before. Decision 3 in the summary stands.

### Fix direction

Number the bottoms first, then the tops: bottoms get 0–67 and tops 68–135, so every top tile still draws above every bottom tile. Resetting the counter to 0 and calling `bringToFront` on all bottom tiles, then all top tiles, does it with the existing helper and ends with the counter at 136. The order _within_ a layer doesn't matter, because same-layer tiles never overlap (wall spec, Phase 2 collision tests).

### Acceptance

- [ ] After a build: every `zIndex` is unique and in 0–135, `frontMostTile` is 136, every top tile is above every bottom tile (Vue devtools, or a temporary `console.table`).
- [ ] Stacks look the same as before the change.
- [ ] Picking tiles after a build still brings them to the front (137, 138, …).

_Optional test:_ if you pull the numbering out into a pure helper (e.g. `wallZIndices(assignment: Map<number, Slot>): Map<number, number>`), table-test it in `wall.spec.ts` against an `assignTiles` fixture. The tests: values are exactly 0–135, every bottom is below every top. For a few lines in `resetTiles`, the manual check is enough.

---

## Learning checkpoints

- **Bug 1:** the offset was a local variable because nothing needed it later. When does deriving a value on demand (from `boardRef.clientWidth`) beat storing it, and what changed here to flip that?
