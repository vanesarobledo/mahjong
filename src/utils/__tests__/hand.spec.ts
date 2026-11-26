import { describe, expect, it } from "vitest";
import { HAND_SIZE, handSlotPosition } from "@/utils/hand.ts";
import { type Orientation, type Seat } from "@/utils/wall.ts";
import type { Point } from "@/utils/geometry.ts";

describe("handSlotPosition", () => {
  it("throws for an index outside 0-13", () => {
    expect(() => handSlotPosition("East", 14)).toThrow("Invalid slot index");
  });

  it.each<{ seat: Seat; expected: Orientation }>([
    { seat: "East", expected: 0 },
    { seat: "North", expected: 90 },
    { seat: "West", expected: 180 },
    { seat: "South", expected: 270 },
  ])("returns orientation for $seat = $expected", ({ seat, expected }) => {
    expect(handSlotPosition(seat, 1).orientation).toBe(expected);
  });

  const handSlots = Array.from({ length: HAND_SIZE }, (_, i) => i);

  function getHand(
    seat: Seat,
  ): { index: number; position: Point & { orientation: Orientation } }[] {
    return handSlots.map((index) => {
      return {
        index,
        position: handSlotPosition(seat, index),
      };
    });
  }

  it.each<{
    seat: Seat;
    axis: "x" | "y";
    size: "smallest" | "largest";
  }>([
    {
      seat: "East",
      axis: "x",
      size: "smallest",
    },
    {
      seat: "West",
      axis: "x",
      size: "largest",
    },
    {
      seat: "North",
      axis: "y",
      size: "smallest",
    },
    {
      seat: "South",
      axis: "y",
      size: "largest",
    },
  ])(
    "index 0 is at the owner's left for $seat hand",
    ({ seat, axis, size }) => {
      const hand = getHand(seat);
      const otherAxis = axis === "x" ? "y" : "x";

      if (!hand[0]) {
        throw new Error("Hand not built correctly");
      }

      const positions = hand.map((s) => s.position[axis]);
      const otherPositions = hand.map((s) => s.position[otherAxis]);

      expect(new Set(positions).size).toBe(HAND_SIZE);
      expect(new Set(otherPositions).size).toBe(1);

      const actual =
        size === "smallest" ? Math.min(...positions) : Math.max(...positions);

      expect(actual, `${seat} 0 has ${size} ${axis}`).toBe(
        hand[0].position[axis],
      );
    },
  );

  describe("adjacent indices are TILE_WIDTH apart along the hand's axis", () => {
    it.each([])("", () => {});
  });

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
