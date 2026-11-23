<script setup lang="ts">
import { computed, type Ref, ref, useTemplateRef } from "vue";
import { Tiles } from "@/data/tiles";
import TileDraggable from "@/components/TileDraggable.vue";
import type { Tile } from "@/types.ts";
import { hasMoved, type Point } from "@/utils/geometry.ts";
import {
  BREAK_MS,
  BUILD_SLIDE_MS,
  BUILD_STAGGER_MS,
  DRAG_THRESHOLD,
  TILE_HEIGHT,
  TILE_PADDING,
  TILE_WIDTH,
  TILES_PER_ROW,
} from "@/constants.ts";
import { bringToFront, flipTile, rotateTile } from "@/utils/tileActions.ts";
import { shuffle } from "@/utils/shuffle.ts";
import { useMarquee } from "@/composables/useMarquee.ts";
import { useSelection } from "@/composables/useSelection.ts";
import { useWall } from "@/composables/useWall.ts";
import { MIN_BOARD_HEIGHT, TABLE_SIZE } from "./utils/wall";

const boardRef = useTemplateRef("board");

const tiles = ref(
  Tiles.map((t, index): Tile => {
    const pos = getInitializedPosition(index);
    return {
      ...t,
      rotationY: 0,
      rotationZ: 0,
      isFaceUp: true,
      orientation: 0,
      x: pos.x,
      y: pos.y,
      zIndex: index,
    };
  }),
);

const frontMostTile = ref(Tiles.length);

const dragStartPos: Ref<Point | null> = ref(null);
const activeDragId: Ref<number | null> = ref(null);
const groupDragOrigin = ref(new Map<number, Point>());

const draggedId: Ref<number | null> = ref(null);
function isLifted(tile: Tile) {
  return tile.id === draggedId.value || groupDragOrigin.value.has(tile.id);
}

const selection = useSelection();
const { marquee, rect, handleMouseDown } = useMarquee(
  boardRef,
  tiles,
  selection,
);
const { diceResult, phase, buildWall } = useWall(
  boardRef,
  tiles,
  frontMostTile,
  selection,
);

const isBuilding = computed(() => phase.value !== "idle");
const slide_ms = computed(() => {
  if (phase.value === "building") {
    return BUILD_SLIDE_MS;
  }
  if (phase.value === "breaking") {
    return BREAK_MS;
  }
  return 0;
});

function getInitializedPosition(index: number) {
  const TILE_SPACING_X = TILE_WIDTH + (TILE_PADDING - 1);
  const TILE_SPACING_Y = TILE_HEIGHT;
  const col = index % TILES_PER_ROW;
  const row = Math.floor(index / TILES_PER_ROW);
  return {
    x: 10 + col * TILE_SPACING_X,
    y: 60 + row * TILE_SPACING_Y,
  };
}

function handleClick(e: MouseEvent, tile: Tile) {
  if (e.shiftKey) {
    selection.toggle(tile.id);
    return;
  }

  if (
    dragStartPos.value &&
    hasMoved(dragStartPos.value, tile, DRAG_THRESHOLD)
  ) {
    dragStartPos.value = null;
    return;
  }

  flipTile(tile);
}

function handleContextMenu(tile: Tile) {
  rotateTile(tile);
}

function handlePick(tile: Tile) {
  dragStartPos.value = {
    x: tile.x,
    y: tile.y,
  };

  draggedId.value = tile.id;

  if (selection.isInGroup(tile.id)) {
    activeDragId.value = tile.id;

    let groupTiles: Tile[] = [];

    selection.selectedIds.value.forEach((id) => {
      if (id === tile.id) {
        return;
      }
      const currentTile = tiles.value.find((t) => t.id === id);
      if (currentTile) {
        groupTiles.push(currentTile);
        groupDragOrigin.value.set(id, {
          x: currentTile.x,
          y: currentTile.y,
        });
      }
    });

    restackTiles(groupTiles);
  }
  bringToFront(tile, frontMostTile);
}

function restackTiles(group: Array<Tile>) {
  group.sort((a, b): number => {
    return a.zIndex - b.zIndex;
  });

  group.forEach((t) => bringToFront(t, frontMostTile));
}

function handleTileMove(position: Point, tile: Tile) {
  updateCoords(tile, position);

  if (activeDragId.value === tile.id) {
    if (!dragStartPos.value) {
      return;
    }

    const dx = position.x - dragStartPos.value.x;
    const dy = position.y - dragStartPos.value.y;

    groupDragOrigin.value.forEach((snapshotCoords, id) => {
      const currentTile = tiles.value.find((t) => t.id === id);
      if (currentTile) {
        currentTile.x = snapshotCoords.x + dx;
        currentTile.y = snapshotCoords.y + dy;
      }
    });
  }
}

function handleOnEnd(e: MouseEvent, tile: Tile) {
  activeDragId.value = null;
  draggedId.value = null;
  groupDragOrigin.value = new Map<number, Point>();

  if (!e.shiftKey && !selection.isInGroup(tile.id)) {
    selection.reset();
  }
}

function orderTiles() {
  tiles.value.forEach((tile) => {
    const pos = getInitializedPosition(tile.id);
    tile.rotationY = 0;
    tile.rotationZ = 0;
    tile.orientation = 0;
    tile.isFaceUp = true;
    tile.x = pos.x;
    tile.y = pos.y;
    tile.zIndex = tile.id;
  });

  frontMostTile.value = Tiles.length;
}

function shuffleTiles() {
  const board = boardRef.value;
  const boardWidth = board ? board.clientWidth : TABLE_SIZE;
  const boardHeight = board ? board.clientHeight : MIN_BOARD_HEIGHT;

  shuffle(tiles.value);

  tiles.value.forEach((tile) => {
    tile.isFaceUp = false;
    tile.rotationY = 180;
    tile.orientation = 0;
    tile.x = Math.random() * (boardWidth - TILE_WIDTH);
    tile.y = Math.random() * (boardHeight - TILE_HEIGHT);
    tile.zIndex = tile.id;
  });

  frontMostTile.value = Tiles.length;
}

function updateCoords(tile: Tile, position: Point) {
  tile.x = position.x;
  tile.y = position.y;
}
</script>

<template>
  <header>
    <h1>Mahjong</h1>
  </header>

  <div id="toolbar">
    <div id="buttons">
      <button @click="shuffleTiles">Shuffle Tiles</button>
      <button @click="orderTiles">Order Tiles</button>
      <button @click="selection.reset">Reset Selection</button>
      <button @click="buildWall" :disabled="isBuilding">Build the Wall</button>
    </div>
    <div id="message">
      <span v-if="phase === 'building'">Building the wall... </span>
      <span v-else-if="phase === 'rolling'"> Rolling...</span>
      <span v-else-if="diceResult.total > 0">
        {{ diceResult.die1 }} + {{ diceResult.die2 }} = {{ diceResult.total }} →
        {{ diceResult.wall }} Wall
      </span>
    </div>
  </div>

  <div
    ref="board"
    class="board"
    :class="isBuilding ? 'building' : ''"
    :style="{
      'min-height': `max(100vh, ${MIN_BOARD_HEIGHT}px)`,
    }"
    @mousedown="handleMouseDown"
  >
    <div
      class="marquee"
      v-show="marquee"
      :style="{
        zIndex: frontMostTile + 1,
        top: rect.top + 'px',
        left: rect.left + 'px',
        width: `${rect.right - rect.left}px`,
        height: `${rect.bottom - rect.top}px`,
      }"
    ></div>
    <TileDraggable
      v-for="(tile, i) in tiles"
      :key="tile.id"
      :container-ref="boardRef"
      class="tile"
      :initial-x="tile.x"
      :initial-y="tile.y"
      :prevent-default="true"
      :class="{
        selected: selection.selectedIds.value.has(tile.id),
        lifted: isLifted(tile),
      }"
      :style="{
        zIndex: tile.zIndex,
        transitionDelay:
          phase === 'building' ? i * BUILD_STAGGER_MS + `ms` : 0 + `ms`,
      }"
      @click="handleClick($event, tile)"
      @contextmenu.prevent="handleContextMenu(tile)"
      @pick="handlePick(tile)"
      @move="(position) => handleTileMove(position, tile)"
      @end="handleOnEnd($event, tile)"
    >
      <div
        class="tile-3d"
        :style="{
          transform: `rotateZ(${tile.orientation}deg) rotateY(${tile.rotationY}deg) rotateZ(${tile.rotationZ}deg)`,
        }"
      >
        <div class="face front">
          <img :src="tile.src" :alt="tile.name" />
        </div>
        <div class="face back"></div>
      </div>
    </TileDraggable>
  </div>
</template>

<style>
body {
  margin: 0;
  padding: 0;
  font-family: "Nunito Sans Variable", sans-serif;
  background: rgb(116, 183, 117);
}

header {
  text-align: center;
  margin: 0;
  padding: 0.5em;
  background: #111;
  color: rgb(244, 239, 231);
}

h1 {
  font-family: "Playfair Display Variable", serif;
  font-weight: 400;
  font-style: normal;
  font-size: 2em;
  text-transform: uppercase;
}

#toolbar {
  display: flex;
  gap: 2em;
  margin: 1em 0;
  padding: 1em;
  align-items: center;
  background: rgba(0, 0, 0, 0.5);
  color: rgb(244, 239, 231);
}

#buttons {
  display: flex;
  gap: 1em;
}

#buttons button {
  background: rgb(244, 239, 231);
  font-family: "Playfair Display Variable", serif;
  border: 0;
  padding: 1em;
  border-radius: 6px;
  box-shadow:
    inset 0 2px 1px rgba(255, 255, 255, 0.6),
    inset 0 -2px 2px rgba(0, 0, 0, 0.2);
}

#buttons button:hover {
  background: #000;
  color: rgb(244, 239, 231);
}

#buttons button:disabled,
#buttons button:disabled:hover {
  background: #ccc;
}

.board {
  position: relative;
  perspective: 800px;
}

.tile {
  position: absolute;
  width: v-bind("TILE_WIDTH + `px`");
  height: v-bind("TILE_HEIGHT + `px`");
}

.tile-3d {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform 0.4s;
  cursor: pointer;
  border-radius: 6px;
  box-shadow:
    0 4px 0 rgb(255, 215, 0),
    0 6px 6px rgba(0, 0, 0, 0.35);
}

.face {
  position: absolute;
  inset: 0;
  border-radius: 6px;
  background: center / auto no-repeat;
  backface-visibility: hidden;
  padding: v-bind("TILE_PADDING + `px`");
  box-shadow:
    inset 0 2px 1px rgba(255, 255, 255, 0.6),
    inset 0 -2px 2px rgba(0, 0, 0, 0.2);
}

.front {
  background-image: url("/img/tiles/Front.svg");
}

.front img {
  width: 100%;
  height: 100%;
}

.front::after,
.back::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
}

.front::after {
  background: linear-gradient(
    to bottom,
    rgba(255, 255, 255, 0.5),
    transparent 45%
  );
}

.back::after {
  background: linear-gradient(
    to bottom,
    rgba(255, 255, 255, 0.4),
    transparent 45%
  );
  mix-blend-mode: soft-light;
}

.back {
  background: rgb(255, 215, 0);
  transform: rotateY(180deg);
}

.selected > .tile-3d {
  outline: 3px rgba(0, 0, 0, 0.6) solid;
  outline-offset: -1px;
  border-radius: 3px;
}

.selected > .face {
  box-shadow: 2px 2px rgba(0, 0, 0, 0.2);
}

.marquee {
  position: absolute;
  pointer-events: none;
  border: 2px dashed #bbb;
}

.board.building .tile {
  transition:
    left v-bind("slide_ms + `ms`"),
    top v-bind("slide_ms + `ms`");
  pointer-events: none;
}

.tile.lifted {
  transition: 200ms;
  filter: drop-shadow(10px 10px 5px rgba(0, 0, 0, 0.2));
}

@media (prefers-reduced-motion: reduce) {
  .board.building .tile {
    transition: 0ms;
  }

  .tile-3d {
    transition: 0ms;
  }
}
</style>
