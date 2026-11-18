import type { Tile } from "@/types.ts";
import { allSlots, type Slot } from "@/utils/wall.ts";

const TOTAL_TILES = 136;
export function flipTile(tile: Tile) {
  tile.isFaceUp = !tile.isFaceUp;
  tile.rotationY = tile.isFaceUp ? 0 : 180;
}

export function rotateTile(tile: Tile) {
  tile.rotationZ = tile.rotationZ === 0 ? 90 : 0;
}

export function assignTiles(shuffledIds: number[]): Map<number, Slot> {
  if (shuffledIds.length !== TOTAL_TILES) {
    throw new Error(`Length of shuffled IDs must be ${TOTAL_TILES}`)
  }

  const wallSlots = allSlots();

  return new Map(
    wallSlots.map((slot, index) => [shuffledIds[index]!, slot])
  );
}
