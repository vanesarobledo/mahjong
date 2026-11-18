import { describe, expect, it } from "vitest";
import { assignTiles } from "@/utils/tileActions.ts";
import { computeBreak } from "@/utils/break.ts";

describe("assignTiles", () => {
  const TOTAL_TILES = 136;

  it("every slot is used exactly once", () => {
    const ids = Array.from({ length: TOTAL_TILES }, (_, i) => i + 1);

    const tilesToSlots = assignTiles(ids);

    expect(tilesToSlots.size).toBe(TOTAL_TILES);
    expect(new Set(tilesToSlots).size).toBe(TOTAL_TILES);
  });

  it.todo("is deterministic; the same id order gives the same assignment");

  it("throws if not given exactly 136 unique IDs", () => {
    expect(() => {
      assignTiles([1, 2, 3, 4]);
    }).toThrow("Length of shuffled IDs must be 136");
  });
});