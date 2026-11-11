import type {Tile} from "@/types.ts";
import {TILE_HEIGHT, TILE_WIDTH} from "@/constants.ts";

export type Point = {
    x: number, y: number
}

export type Rect = {
    top: number,
    right: number,
    left: number,
    bottom: number
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
    // Touching the edge does not count as overlap
    const xOverlap = !(b.left >= a.right) && !(b.right <= a.left);
    const yOverlap = !(b.top >= a.bottom) && !(b.bottom <= a.top);

    return xOverlap && yOverlap;
}

export function hasMoved(from: Point, to: Point, threshold: number): boolean {
    let dx = to.x - from.x;
    let dy = to.y - from.y;

    return Math.hypot(dx, dy) > threshold
}

export function tileToRect(tile: Tile): Rect {
    return {
        left: tile.x,
        right: tile.x + TILE_WIDTH,
        top: tile.y,
        bottom: tile.y + TILE_HEIGHT,
    }
}