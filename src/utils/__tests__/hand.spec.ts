import { describe, expect, it } from "vitest";
import { handSlotPosition } from "@/utils/hand.ts";
import type { Orientation, Seat } from "@/utils/wall.ts";

describe("handSlotPosition", () => {
  it("throws for an index outside 0-13", () => {
    expect(() => handSlotPosition("East", 14)).toThrow("Invalid slot index");
  });

  it.each<{ seat: Seat; expected: Orientation }>([
    { seat: "East", expected: 0, },
    { seat: "North", expected: 90, },
    { seat: "West", expected: 180, },
    { seat: "South", expected: 270, },
  ])("returns orientation for $seat = $expected", ({seat, expected}) => {
    expect(handSlotPosition(seat, 1).orientation).toBe(expected);
  });

  describe.todo("index 0 is at the owner's left");
  describe.todo("adjacent indices are TILE_WIDTH apart along the hand's axis");
  it.todo("index 12 → 13 is TILE_WIDTH + DRAWN_TILE_GAP apart");
  describe.todo("each hand is centred along its table side");
});

describe("handZoneRect", () => {
  describe.todo("no hand footprint intersects any wall footprint");
  describe.todo(
    "every hand footprint lies inside its own handZoneRect and does not intersect each other or table square",
  );
  describe.todo(
    "every hand footprint lies inside MIN_BOARD_WIDTH  × MIN_BOARD_HEIGHT",
  );
});
