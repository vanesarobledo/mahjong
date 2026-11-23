import type { Tile } from "@/types.ts";
import type { Ref } from "vue";

export function flipTile(tile: Tile) {
  tile.isFaceUp = !tile.isFaceUp;
  tile.rotationY = tile.isFaceUp ? 0 : 180;
}

export function rotateTile(tile: Tile) {
  tile.rotationZ = tile.rotationZ === 0 ? 90 : 0;
}

export function bringToFront(tile: Tile, frontMostTile: Ref<number>) {
  tile.zIndex = frontMostTile.value;
  frontMostTile.value++;
}
