import type {Tile} from "@/types.ts";

export function flipTile(tile: Tile) {
    tile.isFaceUp = !tile.isFaceUp
    tile.rotationY = tile.isFaceUp ? 0 : 180
}

export function rotateTile(tile: Tile) {
    tile.rotationZ = (tile.rotationZ) === 0 ? 90 : 0;
}