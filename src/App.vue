<script setup lang="ts">
import {computed, type Ref, ref, useTemplateRef} from "vue";
import {Tiles} from '@/data/tiles'
import TileDraggable from "@/components/TileDraggable.vue";
import type {Tile, Rect} from "@/types.ts";
import {type Position, useEventListener} from "@vueuse/core";

const boardRef = useTemplateRef('board')

const tiles = ref(
    Tiles.map((t, index) => {
      const pos = getInitializedPosition(index)
      return {
        ...t,
        rotationY: 0,
        rotationZ: 0,
        isFaceUp: true,
        x: pos.x,
        y: pos.y,
        zIndex: index,
      }
    })
)

const frontMostTile = ref(Tiles.length)

const selectedIds = ref(new Set<number>())

const marquee: Ref<{
  current: { x: number, y: number },
  start: { x: number, y: number },
  additive: boolean
} | null> = ref(null)

const dragStartPos: Ref<Position | null> = ref(null)
const activeDragId: Ref<number | null> = ref(null)
const groupDragOrigin: Ref<Map<number, Position>> = ref(new Map<number, Position>)

const TILE_WIDTH = 50, TILE_HEIGHT = 72
const TILE_PADDING = 10
const TILES_PER_ROW = 14

function getInitializedPosition(index: number) {
  const TILE_SPACING_X = TILE_WIDTH + (TILE_PADDING - 1)
  const TILE_SPACING_Y = TILE_HEIGHT
  const col = index % TILES_PER_ROW;
  const row = Math.floor(index / TILES_PER_ROW);
  return {
    x: 10 + col * TILE_SPACING_X,
    y: 60 + row * TILE_SPACING_Y
  }
}

function handleClick(e: MouseEvent, tile: Tile) {
  if (e.shiftKey) {
    if (selectedIds.value.has(tile.id)) {
      selectedIds.value.delete(tile.id)
    } else {
      selectedIds.value.add(tile.id)
    }
    return
  }

  if (dragStartPos.value) {
    if (Math.abs(dragStartPos.value.x - tile.x) >= 3 && Math.abs(dragStartPos.value.y - tile.y) >= 3) {
      return
    }
  }

  flipTile(tile);
}

function handleContextMenu(tile: Tile) {
  rotateTile(tile);
}

function handlePick(tile: Tile, position: Position) {
  dragStartPos.value = {
    x: tile.x,
    y: tile.y
  }

  if (selectedIds.value.has(tile.id) && selectedIds.value.size > 1) {
    activeDragId.value = tile.id

    let groupTiles: Tile[] = []

    selectedIds.value.forEach((id) => {
      if (id === tile.id) {
        return;
      }
      let currentTile = tiles.value.find((t) => t.id === id)
      if (currentTile) {
        groupTiles.push(currentTile)
        groupDragOrigin.value.set(id, {
          x: currentTile.x,
          y: currentTile.y
        })
      }
    })

    restackTiles(groupTiles)

  }
  bringToFront(tile);
}

function restackTiles(group: Array<Tile>) {
  group.sort((a, b): number => {
    return a.zIndex - b.zIndex
  })

  group.forEach(bringToFront)
}

function handleTileMove(position: Position, tile: Tile) {
  updateCoords(tile, position)

  if (activeDragId.value === tile.id) {
    groupDragOrigin.value.forEach((snapshotCoords, id) => {
      let currentTile = tiles.value.find((t) => t.id === id)
      if (currentTile && dragStartPos.value) {
        let dx = position.x - dragStartPos.value.x
        let dy = position.y - dragStartPos.value.y

        currentTile.x = snapshotCoords.x + dx
        currentTile.y = snapshotCoords.y + dy
      }
    })
  }
}

function handleOnEnd(e: MouseEvent, tile: Tile) {
  activeDragId.value = null
  groupDragOrigin.value = new Map<number, Position>()
  // dragStartPos.value = null

  if (!e.shiftKey && !(selectedIds.value.has(tile.id) && selectedIds.value.size > 1)) {
    selectedIds.value = new Set([])
  }
}

function handleMouseDown(event: MouseEvent) {
  // Guard only if mousedown is on an empty board and not a tile
  // Prevents tile-drag from being misread as marquee-start
  if (event.target !== boardRef.value) {
    return
  }

  event.preventDefault()

  const point = clientToBoard(event)
  marquee.value = {
    start: point,
    current: point,
    additive: event.shiftKey,
  }
}

useEventListener(window, 'mousemove', (event) => {
  if (marquee.value === null) {
    return
  }

  marquee.value.current = clientToBoard(event)

})

const rect = computed(() => {
  if (marquee.value === null) {
    return {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    }
  }

  return {
    left: Math.min(marquee.value.start.x, marquee.value.current.x),
    right: Math.max(marquee.value.start.x, marquee.value.current.x),
    top: Math.min(marquee.value.start.y, marquee.value.current.y),
    bottom: Math.max(marquee.value.start.y, marquee.value.current.y),
  }
});

useEventListener(window, 'mouseup', () => {
  if (marquee.value === null) {
    return
  }

  // tiles.value.forEach((tile) => {
  //   if (rectsIntersect(tileToReact(tile), rect.value)) {
  //     selectedIds.value.add(tile.id)
  //   }
  // })

  marquee.value = null

})

function clientToBoard(e: MouseEvent): Position {
  if (boardRef.value) {
    const boundingClientRect = boardRef.value.getBoundingClientRect();

    return {
      x: e.clientX - boundingClientRect.left,
      y: e.clientY - boundingClientRect.top
    }
  }

  throw new Error('We need a board in here, mount the board')
}

function tileToReact(tile: Tile): Rect {
  return {
    left: tile.x,
    right: tile.x + TILE_WIDTH,
    top: tile.y,
    bottom: tile.y + TILE_HEIGHT,
  }
}

function rectsIntersect(a: Rect, b: Rect): boolean {
  const xOverlap = !(b.left > a.right) || !(b.right < a.left);
  const yOverlap = !(b.top > a.bottom) || !(b.bottom < a.top);

  return xOverlap && yOverlap;
}

function flipTile(tile: Tile) {
  tile.isFaceUp = !tile.isFaceUp
  tile.rotationY = tile.isFaceUp ? 0 : 180
}

function rotateTile(tile: Tile) {
  tile.rotationZ = (tile.rotationZ ?? 0) === 0 ? 90 : 0;
}

function bringToFront(tile: Tile) {
  tile.zIndex = frontMostTile.value
  frontMostTile.value += 1
}

function orderTiles() {
  tiles.value.forEach(tile => {
    const pos = getInitializedPosition(tile.id)
    tile.rotationY = 0
    tile.rotationZ = 0
    tile.isFaceUp = false
    tile.x = pos.x
    tile.y = pos.y
    tile.zIndex = tile.id
  })
}

function resetGame() {
  const board = boardRef.value;
  const boardWidth = board ? board.clientWidth : 800;
  const boardHeight = board ? board.clientHeight : 1000;

  shuffleAllTiles(tiles.value)

  tiles.value.forEach(tile => {
    tile.isFaceUp = false
    tile.rotationY = 180
    tile.x = Math.random() * (boardWidth - TILE_WIDTH)
    tile.y = Math.random() * (boardHeight - TILE_HEIGHT)
    tile.zIndex = tile.id
  })

}

function shuffleAllTiles(arr: Array<Tile | undefined>) {
// Fisher-Yates Shuffle
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
}

function updateCoords(tile: Tile, position: Position) {
  tile.x = position.x;
  tile.y = position.y;
}

</script>

<template>
  <h1>Mahjong Test</h1>

  <button @click="resetGame()">Shuffle Tiles</button>
  <button @click="orderTiles()">Order Tiles</button>

  <div
      ref="board"
      class="board"
      @mousedown="handleMouseDown"
  >
    <div
        class="marquee"
        v-show="marquee"
        :style="{
          zIndex: frontMostTile + 1,
          top: rect.top + 'px',
          left: rect.left + 'px',
          width: `${Math.abs(rect.right - rect.left)}px`,
          height: `${Math.abs(rect.bottom - rect.top)}px`,
        }"
    >
    </div>
    <TileDraggable
        v-for="tile in tiles"
        :key="tile.id"
        :container-ref="boardRef"
        class="tile"
        :initial-x="tile.x"
        :initial-y="tile.y"
        :prevent-default="true"
        :class="{ selected: selectedIds.has(tile.id) }"
        :style="{ zIndex: tile.zIndex }"
        @click="handleClick($event, tile)"
        @contextmenu.prevent="handleContextMenu(tile)"
        @pick="(position) => handlePick(tile, position)"
        @move="(position) => handleTileMove(position, tile)"
        @end="handleOnEnd($event, tile)"
    >
      <div
          class="tile-3d"
          :style="{ transform: `rotateY(${tile.rotationY}deg) rotateZ(${tile.rotationZ}deg)` }"
      >
        <div class="face front">
          <img :src="tile.src" :alt="tile.name"/>
        </div>
        <div class="face back"></div>
      </div>
    </TileDraggable>
  </div>

</template>

<style scoped>
.board {
  position: relative;
  perspective: 800px;
  min-height: 100vh;
}

.tile {
  position: absolute;
  width: v-bind('TILE_WIDTH + `px`');
  height: v-bind('TILE_HEIGHT + `px`');
}

.tile-3d {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform 0.4s;
  cursor: pointer;
}

.face {
  position: absolute;
  inset: 0;
  border-radius: 4px;
  background: center / auto no-repeat;
  backface-visibility: hidden;
  padding: v-bind('TILE_PADDING + `px`');
  box-shadow: inset 1px 1px 1px 1px rgba(0, 0, 0, 0.2);
}

.front {
  background-image: url('/img/tiles/Front.svg');
}

.front img {
  width: 100%;
  height: 100%;
}

.back {
  background-image: url('/img/tiles/Back.svg');
  transform: rotateY(180deg);
}

.selected {
  outline: 3px rgb(255, 215, 0) solid;
  outline-offset: -1px;
  border-radius: 3px;
}

.marquee {
  position: absolute;
  pointer-events: none;
  border: 2px dashed #ccc;
}
</style>
