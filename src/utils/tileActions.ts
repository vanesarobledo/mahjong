import type { Tile } from "@/types.ts";
import type { Ref } from "vue";
import type { Orientation } from "@/utils/wall.ts";

export function flipTile(tile: Tile) {
  tile.isFaceUp = !tile.isFaceUp;
  tile.rotationY = tile.isFaceUp ? 0 : 180;
}

export function rotateTile(tile: Tile) {
  tile.orientation = ((tile.orientation + 90) % 360) as Orientation;
}

export function bringToFront(tile: Tile, frontMostTile: Ref<number>) {
  tile.zIndex = frontMostTile.value;
  frontMostTile.value++;
}
