import { describe, expect, it } from "vitest";
import { assignTiles } from "@/utils/tileActions.ts";
import { allSlots } from "@/utils/wall.ts";

describe("assignTiles", () => {
  const TOTAL_TILES = 136;
  const ids = Array.from({ length: TOTAL_TILES }, (_, i) => i + 1);

  it("the same id order gives the same assignment", () => {
    const slots = allSlots();
    const differentIds = [...ids].reverse();
    const expectedMap = new Map(slots.map((slot, index) => [
      differentIds[index], slot
    ]));

    const tilesToSlots = assignTiles(differentIds);

    expect(tilesToSlots).toEqual(expectedMap);
  });

  it("throws if not given exactly 136 unique IDs", () => {
    expect(() => {
      assignTiles(Array.from({ length: TOTAL_TILES + 1}, (_, i) => i + 1));
    }).toThrow("Length of shuffled IDs must be 136");
  });
});