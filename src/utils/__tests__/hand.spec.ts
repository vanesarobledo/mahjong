import { describe, expect, it } from "vitest";
import { HAND_SIZE, handSlotPosition } from "@/utils/hand.ts";
import { type Orientation, type Seat } from "@/utils/wall.ts";
import type { Point } from "@/utils/geometry.ts";
import { DRAWN_TILE_GAP, TILE_WIDTH } from "@/constants.ts";

describe("handSlotPosition", () => {
  it("throws for an index outside 0-13", () => {
    expect(() => handSlotPosition("East", 14)).toThrow("Invalid slot index");
  });

  describe("orientation per seat equals seatOrientation(seat)", () => {
    it.each<{ seat: Seat; expected: Orientation }>([
      { seat: "East", expected: 0 },
      { seat: "North", expected: 90 },
      { seat: "West", expected: 180 },
      { seat: "South", expected: 270 },
    ])("returns orientation for $seat = $expected", ({ seat, expected }) => {
      expect(handSlotPosition(seat, 1).orientation).toBe(expected);
    });
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

  describe("index 0 is at the owner's left for each hand", () => {
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
    ])("$seat has the $size $axis", ({ seat, axis, size }) => {
      const otherAxis = axis === "x" ? "y" : "x";

      const hand = getHand(seat);

      if (!hand[0]) {
        throw new Error("Hand not built correctly");
      }

      const positions = hand.map((s) => s.position[axis]);
      const otherPositions = hand.map((s) => s.position[otherAxis]);

      // Guard against empty hand
      expect(new Set(positions).size).toBe(HAND_SIZE);
      expect(new Set(otherPositions).size).toBe(1);

      const actual =
        size === "smallest" ? Math.min(...positions) : Math.max(...positions);

      expect(actual, `${seat} 0 has ${size} ${axis}`).toBe(
        hand[0].position[axis],
      );
    });
  });

  describe("adjacent indices from 0-12 are TILE_WIDTH apart along the hand's axis", () => {
    it.each<{
      seat: Seat;
      axis: "x" | "y";
    }>([
      {
        seat: "East",
        axis: "x",
      },
      {
        seat: "West",
        axis: "x",
      },
      {
        seat: "North",
        axis: "y",
      },
      {
        seat: "South",
        axis: "y",
      },
    ])("$seat along $axis axis", ({ seat, axis }) => {
      for (let i = 0; i < 12; i++) {
        const current = handSlotPosition(seat, i);
        const next = handSlotPosition(seat, i + 1);

        expect(
          Math.abs(current[axis] - next[axis]),
          `slots ${i}->${i + 1}`,
        ).toBe(TILE_WIDTH);
      }
    });
  });

  describe("index 12 → 13 is TILE_WIDTH + DRAWN_TILE_GAP apart", () => {
    it.each<{
      seat: Seat;
      axis: "x" | "y";
    }>([
      {
        seat: "East",
        axis: "x",
      },
      {
        seat: "West",
        axis: "x",
      },
      {
        seat: "North",
        axis: "y",
      },
      {
        seat: "South",
        axis: "y",
      },
    ])("$seat along $axis axis", ({ seat, axis }) => {
      const index12 = handSlotPosition(seat, 12);
      const index13 = handSlotPosition(seat, 13);

      expect(Math.abs(index13[axis] - index12[axis])).toBe(
        TILE_WIDTH + DRAWN_TILE_GAP,
      );
    });
  });

  // describe.todo("each hand is centred along its table side");
});

// describe("handZoneRect", () => {
//   describe.todo("no hand footprint intersects any wall footprint");
//   describe.todo(
//     "every hand footprint lies inside its own handZoneRect and does not intersect each other or table square",
//   );
//   describe.todo(
//     "every hand footprint lies inside MIN_BOARD_WIDTH  × MIN_BOARD_HEIGHT",
//   );
// });
