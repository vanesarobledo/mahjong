import { describe, expect, it } from "vitest";
import { rectsIntersect, tileToRect } from "@/utils/geometry.ts";
import { type Orientation } from "@/utils/wall.ts";
import type { Tile } from "@/types.ts";
import { TILE_HEIGHT, TILE_WIDTH } from "@/constants.ts";

// Smoke test: proves Vitest runs, TypeScript compiles, and the "@" alias resolves.
describe("rectsIntersect", () => {
  it("treats touching edges as non-overlapping", () => {
    const a = { left: 0, right: 10, top: 0, bottom: 10 };
    const b = { left: 10, right: 20, top: 0, bottom: 10 };

    expect(rectsIntersect(a, b)).toBe(false);
  });
});

describe("tilesToRect", () => {
  const tile: Tile = {
    id: 1,
    src: "",
    name: "",
    rotationY: 0,
    rotationZ: 0,
    orientation: 0,
    isFaceUp: false,
    x: 0,
    y: 0,
    zIndex: 1,
  };

  it("swaps width and height for a side-wall tile (orientation: 90)", () => {
    const pos = { x: 100, y: 200 };
    const orientation: Orientation = 90;
    const currentTile = { ...tile, ...pos, orientation };
    const expected = { top: 211, left: 89, bottom: 261, right: 161 };

    console.log(expected);

    const tileRect = tileToRect(currentTile);

    expect(tileRect).toEqual(expected);
  });

  it("ignores Riichi rotation", () => {
    const rotationZ = 90;
    const currentTile = { ...tile, rotationZ };
    const expected = {
      top: currentTile.y,
      left: currentTile.x,
      bottom: currentTile.y + TILE_HEIGHT,
      right: currentTile.x + TILE_WIDTH,
    };

    const tileRect = tileToRect(currentTile);

    expect(tileRect).toEqual(expected);
  });
});
