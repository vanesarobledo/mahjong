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

  it.each<Orientation>([90, 270])(
    "reads the tile's orientation at %s",
    (orientation) => {
      const currentTile = { ...tile, orientation };

      const tileRect = tileToRect(currentTile);
      const tileOrientRect = {
        top: currentTile.y + TILE_HEIGHT / 2 - TILE_WIDTH / 2,
        left: currentTile.x + TILE_WIDTH / 2 - TILE_HEIGHT / 2,
        bottom: currentTile.y + TILE_HEIGHT / 2 + TILE_WIDTH / 2,
        right: currentTile.x + TILE_WIDTH / 2 + TILE_HEIGHT / 2,
      };

      expect(tileRect).toEqual(tileOrientRect);
    },
  );

  it("", () => {});
});
