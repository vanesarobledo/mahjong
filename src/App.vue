<script setup lang="ts">
import {type Ref, ref, useTemplateRef} from "vue";
import { Tiles } from '@/data/tiles'
import TileDraggable from "@/components/TileDraggable.vue";
import type {Tile} from "@/types.ts";
import type {Position} from "@vueuse/core";

const boardRef = useTemplateRef('board')
const tiles = ref(
    Tiles.map((t, index) => {
      const pos = getInitializedPosition(index)
      return {
        ...t,
        rotationY: 0,
        rotationZ: 0,
        isFaceUp: false,
        x: pos.x,
        y: pos.y,
      }
    })
)

const selectedIds = ref(new Set<number>())
const marquee = ref(null)

const dragStartPos: Ref<Position | null> = ref(null)
const activeDragId: Ref<number | null> = ref(null)
const groupDragOrigin: Ref<Map<number, Position>> = ref(new Map<number, Position>)

const TILE_WIDTH = 50, TILE_HEIGHT = 72
const TILE_PADDING = 10
const TILES_PER_ROW = 14

function getInitializedPosition(index : number) {
  let TILE_SPACING_X = TILE_WIDTH + (TILE_PADDING - 1)
  let TILE_SPACING_Y = TILE_HEIGHT
  const col = index % TILES_PER_ROW;
  const row = Math.floor(index / TILES_PER_ROW);
  return {
    x: 10 + col * TILE_SPACING_X,
    y: 60 + row * TILE_SPACING_Y
  }
}

function handleClick(e: any, tile: Tile) {
  if (e.shiftKey) {
    // toggle tile id in selectedId
    if (selectedIds.value.has(tile.id)) {
      selectedIds.value.delete(tile.id)
      console.log(`removed selected id: ${tile.id}`)
    }
    else {
      selectedIds.value.add(tile.id)
      console.log(`added selected id: ${tile.id}`)
    }
    return;
  }

  flipTile(tile);
}

function handleContextMenu(tile: Tile) {
  rotateTile(tile);
}

function handlePick(tile: Tile) {
  if (selectedIds.value.has(tile.id) && selectedIds.value.size > 1) {
    // start of group drag
    // snapshot other selected tiles' current x/y in groupDragOrigin
    dragStartPos.value = {
      x: tile.x,
      y: tile.y
    }
    activeDragId.value = tile.id
    selectedIds.value.forEach((id) => {
      if (id === tile.id) {
        return;
      }
      let currentTile = tiles.value.find((t) => t.id === id)
      if (currentTile) {
        groupDragOrigin.value.set(id, {
          x: currentTile.x,
          y: currentTile.y
        })
      }
    })

    console.log(groupDragOrigin.value)
  }

  bringToFront(tile);
}

function handleTileMove(position: Position, tile: Tile) {
  updateCoords(tile, position)

  if (activeDragId.value === tile.id && groupDragOrigin.value && dragStartPos.value) {
    // compute dx/dy
    let dx = position.x - dragStartPos.value.x
    let dy = position.y - dragStartPos.value.y

    groupDragOrigin.value.forEach((pos) => {
        pos.x += dx
        pos.y += dy
    })
  }
}
function handleOnEnd(e: any, tile: Tile) {
  activeDragId.value = null
  groupDragOrigin.value = new Map<number, Position>()
  dragStartPos.value = null

  // collapse
  if (!e.shiftKey && !selectedIds.value.has(tile.id) && selectedIds.value.size > 1) {
      selectedIds.value = new Set([tile.id])
  }
}

function flipTile(tile : Tile) {
  tile.isFaceUp = !tile.isFaceUp
  tile.rotationY = tile.isFaceUp ? 0: 180
}

function rotateTile(tile : Tile) {
  tile.rotationZ = (tile.rotationZ ?? 0) === 0 ? 90 : 0;
}

function bringToFront(tile : Tile) {
  const index = tiles.value.indexOf(tile);
  tiles.value.splice(index, 1)
  tiles.value.push(tile)
}

function orderTiles() {
  tiles.value.forEach(tile => {
    const pos = getInitializedPosition(tile.id)
    tile.rotationY = 0
    tile.isFaceUp = false
    tile.x = pos.x
    tile.y = pos.y
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
  })

}

function shuffleAllTiles(arr: Array<Tile | undefined>) {
// Fisher-Yates Shuffle
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
}

function updateCoords(tile : Tile, position: Position) {
  tile.x = position.x;
  tile.y = position.y;
}

</script>

<template>
  <h1>Mahjong Test</h1>

  <button @click="resetGame()">Shuffle Tiles</button>
  <button @click="orderTiles()">Order Tiles</button>

  <div ref="board" class="board">
    <TileDraggable
        v-for="tile in tiles"
        :key="tile.id"
        :container-ref="boardRef"
        class="tile"
        :initial-x="tile.x"
        :initial-y="tile.y"
        :prevent-default="true"
        @click="($event: any) => handleClick($event, tile)"
        @contextmenu.prevent="handleContextMenu(tile)"
        @pick="handlePick(tile)"
        @move="(position) => handleTileMove(position, tile)"
        @end="($event) => handleOnEnd($event, tile)"
    >
      <div
          class="tile-3d"
          :style="{ transform: `rotateY(${tile.rotationY}deg) rotateZ(${tile.rotationZ}deg)` }"
      >
        <div class="face front">
          <img :src="tile.src" :alt="tile.name" />
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

.grid-board {
  /*display: flex;*/
}

.wall {
  display: grid;

}

</style>
