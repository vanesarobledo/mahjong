# Riichi Mahjong Vue Project — Architecture Summary

## Goal & scope philosophy

Building a digital Riichi mahjong set on a Vue page. The philosophy is that only the setup minimally required to play the game is needed and players enforce the rules themselves. Cheating is explicitly allowed.

- **Setup and bookkeeping can be automated.** Building the wall, dealing hands, tracking seats/rounds, and (eventually) scoring are tedious mechanical chores a real table does by hand — the app is allowed to do them for players as optional convenience helpers.
- **Play itself stays self-enforced.** Turn order, legal draws, legal riichi timing, and generally "is this move allowed" are never checked or blocked by the app. Players police that themselves, exactly as at a physical table.
- **Cheating is a permanent, explicit design commitment**. Every tile is freely movable between any zone (hand, wall, dead wall, discard pile) at all times, and a dedicated swap gesture exists specifically to make swapping tiles fast. This is never something to "fix" by adding zone restrictions.

The question to ask is: **does this feature ever block or validate a player's move, or does it just do labor for them that they could still override by hand?** Only the former is out of scope.

Scope is split into two tiers below: **Near-term** (setup/bookkeeping helpers, being actively built) and **Stretch/future** (a genuine rules engine for scoring, and a longer-term pluggable rule-toggle architecture — aspirational, not currently shaping code).

### Near-term scope

- **Wall / dead-wall auto-build**: an action arranges all 136 tiles into a physically-accurate 4-wall square (17 stacked pairs per seat), with the 14-tile dead wall split off from a corner — matching how a real game is built. Requires a real wall data model (each tile's position in the wall, live vs. dead).
- **Hand zones**: four labeled per-seat regions. Dealing into them can optionally be automated (a "deal" helper draws starting tiles from the wall into each hand), but manual drag-to-fill remains fully supported — dealing is a convenience.
- **Swap mode**: a dedicated cheat gesture — click "swap," then click two tiles — exchanges their positions/identities in one step, on top of the free drag-anywhere that already works today.
- **Seat / round indicators**: labels players manually set/cycle themselves (e.g. click to advance E→S→W→N, or bump the round by hand). No app-driven turn logic drives them.
- **Riichi tracking**: a per-seat "in Riichi" flag plus a running count of riichi sticks in the pot, layered on top of the existing rotate-discard-90° gesture that already marks a riichi discard.

### Stretch / future scope

- **Scoring via a "win" button**: a player declares a win and submits their hand; the app returns either a score or "not a valid winning hand." Tsumo vs. Ron stays player-tracked, not app-tracked. This is honestly a full rules engine (hand-shape/yaku detection) and a much bigger undertaking than everything else in this doc — it's optional and never required to finish a game.
- **Command-pattern-style pluggable rule toggles**: a grander long-term idea where every rule (legal draws, riichi legality, yaku validation, etc.) is implemented as an independently toggleable unit, so enforcement can be turned on or off per rule. Documented here as aspirational direction only — not something current architecture decisions are being made around yet.

## Tech stack

- **Vue 3** (`<script setup>`, Composition API, TypeScript)
- **@vueuse/core** — specifically `useDraggable` (used directly as a composable, not the `<UseDraggable>` wrapper component — see below for why)
- Tile art: SVGs from the [FluffyStuff/riichi-mahjong-tiles](https://github.com/FluffyStuff/riichi-mahjong-tiles) repo, `Regular` tile set, served from `/img/tiles/`

## Data layer

`src/data/tiles.js` — a static JSON array of the 136-tile riichi set:
```js
{ id: number, src: string, name: string }
```
- 4 copies of each suit tile (Man/Pin/Sou 1–9), except 5s: 3 regular + 1 `-Dora` variant (red five) per suit — 3 + 1 = 4, matching standard tile counts
- 4 copies of each honour tile (Ton, Nan, Shaa, Pei, Hatsu, Chun, Haku)
- Ordered: Man → Pin → Sou → Ton → Nan → Shaa → Pei → Hatsu → Chun → Haku
- `name` is the filename without extension (e.g. `Man5-Dora`)
- This is purely descriptive data — **no position, rotation, or game state lives here**. Runtime state (x, y, isFaceUp, rotationY, rotationZ) is added to each tile object at component-mount time in the parent's `ref()`.

## Component architecture

**Two-component split**, chosen specifically to work around a vueuse limitation:

- **Parent (board component):** owns the `tiles` ref (array of tile+state objects), owns `boardRef` (template ref to the `.board` container), and owns all cross-tile logic — flip, bring-to-front, shuffle/reset.
- **`TileDraggable.vue` (child, one per tile):** wraps a single tile's `useDraggable()` call. Receives `initialX`/`initialY`/`containerRef` as props, emits `pick` (on drag start) up to the parent.

**Why a custom child component instead of the `<UseDraggable>` component from `@vueuse/components`:** that wrapper component doesn't expose the `containerElement` option, which is required to make `position: absolute` dragging behave correctly relative to a parent container instead of the viewport. Using the `useDraggable` composable directly, inside a small wrapper component, was the only way to access that option.

## Key architectural decisions (and the bugs that motivated them)

1. **`position: absolute` on tiles, `position: relative` + `perspective` on the board**, with `containerElement: () => props.containerRef` passed into `useDraggable`. 
   - *Why:* `useDraggable` computes x/y via `getBoundingClientRect()`, which is always viewport-relative unless you explicitly pass `containerElement`. Without it, tiles "jump" and drag incorrectly inside any ancestor with `position`/`perspective`/`transform` set (these properties change what `position: fixed` means, and `absolute` alone doesn't fix vueuse's internal math).

2. **Every tile is a separate child component, keyed by `tile.id`** (not array index). 
   - *Why:* Vue reuses component instances across re-renders when a stable `:key` is used, which is required so each tile's internal drag position (state living *inside* `useDraggable`, not in the parent array) survives array reordering (e.g. bring-to-front, shuffle).

3. **"Bring to front" (z-ordering) is implemented via DOM order, not a numeric z-index.** 
   - On pick (drag start / `onStart`), the clicked tile is spliced out of the `tiles` array and pushed to the end. Because no `z-index` is set anywhere, default stacking context means the last-rendered element paints on top — reusing behavior that was already occurring naturally, rather than introducing a separate z-index counter property.

4. **Tile position (`x`, `y`) is stored on the tile object itself, not derived from array index.** 
   - *Bug this fixed:* an earlier version computed each tile's initial position from its index in the array (`getInitializedPosition(index)`). Once array reordering was introduced (bring-to-front), every tile's index shifted, which cascaded into every subsequent tile's position changing as an unintended side effect. Fix: assign `x`/`y` once at construction time and treat them as real, independent tile state from then on.

5. **Resetting/shuffling tile position uses `watch` inside the child component, not a forced remount.** 
   - The parent updates `tile.x`/`tile.y` (after a Fisher-Yates shuffle of the array + randomizing coordinates); the child watches `[() => props.initialX, () => props.initialY]` and imperatively sets the composable's internal `position.value` when they change. Chosen deliberately over the "bump a key to force remount" alternative, for learning purposes (understanding `watch`'s explicit source-tracking model, in contrast to React's `useEffect`).

6. **Flip (`rotateY`) and riichi-call rotation (`rotateZ`) are separate transform axes on the same element**, composed together in one `transform` string. Both coexist safely because `transform-style: preserve-3d` is set on the tile wrapper.

7. **Interaction model, to avoid gesture collisions:**
   - Single click → flip face up/down
   - Right-click (`@contextmenu.prevent`) → rotate 90° for riichi calls (desktop)
   - Double-click/double-tap (via a manual click-debounce, ~250ms) → same rotate action, as a touch-friendly fallback where right-click/long-press isn't reliable
   - Pointerdown (drag start) → bring tile to front
   - These were deliberately kept as separate, non-overlapping gestures rather than combined/overloaded, after hitting a concrete bug where naively adding both `@click` and `@dblclick` handlers caused a double-click to also fire two flips before rotating.

## Known open items / not yet implemented

- **Snap-to-grid**: not natively supported by `useDraggable` (confirmed via docs — no `grid`/`snap` option exists). Plan is to implement manually via the `onEnd` callback, rounding final position to a grid — but scoped only to wall/dead-wall/hand areas (via a bounds check against those regions), leaving discards and calls freely draggable.
- **Wall / dead-wall data model**: not yet built. Needs a real model of wall position (per-seat, ordered) and live/dead status per tile, to drive the auto-build helper.
- **Hand zones, seat/round indicators, riichi flag+pool, swap mode**: none implemented yet — see Near-term scope above for what each should do.
- **Mobile touch testing**: `touch-action: manipulation` was added to prevent double-tap-to-zoom from swallowing the double-tap-rotate gesture, but this hasn't been tested on an actual device yet.
