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

  it("index 0 is at the owner's left for $seat hand", () => {
    const eastHand = getHand("East");
    const northHand = getHand("North");
    const westHand = getHand("West");
    const southHand = getHand("South");

    if (!eastHand[0] || !westHand[0] || !northHand[0] || !southHand[0]) {
      throw new Error("Hand(s) not built correctly");
    }

    const eastX = eastHand.map((s) => s.position.x);
    const westX = westHand.map((s) => s.position.x);
    const northY = northHand.map((s) => s.position.y);
    const southY = southHand.map((s) => s.position.y);

    expect(new Set(eastX).size).toBe(HAND_SIZE);
    expect(new Set(westX).size).toBe(HAND_SIZE);
    expect(new Set(northY).size).toBe(HAND_SIZE);
    expect(new Set(southY).size).toBe(HAND_SIZE);

    expect(Math.min(...eastX), "East 0 has smallest x").toBe(eastHand[0].position.x);
    expect(Math.max(...westX), "West 0 has largest x").toBe(westHand[0].position.x);
    expect(Math.min(...northY), "North 0 has smallest y").toBe(northHand[0].position.y);
    expect(Math.max(...southY), "South 0 has the largest y").toBe(southHand[0].position.y);
  });

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
