import { describe, expect, it } from "vitest";
import {
  allSlots,
  type Orientation,
  type Seat,
  seatOrientation,
  slotPosition,
} from "@/utils/wall.ts";
import { STACK_OFFSET, TILE_WIDTH, WALL_SIZE } from "@/constants.ts";

describe("building the wall", () => {
  describe("allSlots", () => {
    it("returns all 136 slots, all unique", () => {
      const wall = allSlots();
      // Convert objects to strings to test uniqueness
      const keys = wall.map((slot) => {
        return `${slot.seat},${slot.stack},${slot.layer}`;
      });

      expect(wall.length).toBe(136);
      expect(new Set(keys).size).toBe(wall.length);
    });

    it.each<Seat>(["East", "South", "West", "North"])(
      "returns 17 stacks of 2 layers for %s wall",
      (seat: string) => {
        const wall = allSlots();
        const seatWall = wall.filter((slot) => {
          return slot.seat === seat;
        });
        const topStack = seatWall.filter((slot) => {
          return slot.layer === "top";
        });
        const bottomStack = seatWall.filter((slot) => {
          return slot.layer === "bottom";
        });
        const expectedTopStack = Array.from({ length: 17 }, (_, i) => ({
          seat,
          stack: i + 1,
          layer: "top",
        }));
        const expectedBottomStack = Array.from(
          { length: WALL_SIZE },
          (_, i) => ({
            seat,
            stack: i + 1,
            layer: "bottom",
          }),
        );

        expect(topStack).toEqual(expectedTopStack);
        expect(bottomStack).toEqual(expectedBottomStack);
      },
    );
  });

  // Assumes rotation is using CSS rotate(), where positive angle turns clockwise
  describe("seatOrientation", () => {
    it.each<{
      seat: Seat;
      expected: Orientation;
    }>([
      {
        seat: "East",
        expected: 0,
      },
      {
        seat: "South",
        expected: 270,
      },
      {
        seat: "West",
        expected: 180,
      },
      {
        seat: "North",
        expected: 90,
      },
    ])(
      "returns orientation $orientation for the $expected seat",
      ({ seat, expected }) => {
        const sOrientation = seatOrientation(seat);

        expect(sOrientation).toBe(expected);
      },
    );
  });

  describe("slotPosition", () => {
    it.each<{
      seat: Seat;
      axis: "x" | "y";
      stack1Is: "greater" | "less";
      side: string;
    }>([
      {
        seat: "East",
        axis: "x",
        stack1Is: "greater",
        side: "right",
      },
      {
        seat: "South",
        axis: "y",
        stack1Is: "less",
        side: "top",
      },
      {
        seat: "West",
        axis: "x",
        stack1Is: "less",
        side: "left",
      },
      {
        seat: "North",
        axis: "y",
        stack1Is: "greater",
        side: "bottom",
      },
    ])(
      "returns that stack 1 is at $seat wall's right end (screen-$side)",
      ({ seat, axis, stack1Is }) => {
        const slot1 = slotPosition({ seat, stack: 1, layer: "top" });
        const slot17 = slotPosition({ seat, stack: 17, layer: "top" });

        const isGreater = stack1Is === "greater";

        if (isGreater) {
          expect(slot1[axis]).toBeGreaterThan(slot17[axis]);
        } else {
          expect(slot1[axis]).toBeLessThan(slot17[axis]);
        }

        if (axis === "x") {
          expect(slot1["y"]).toBe(slot17["y"]);
        } else {
          expect(slot1["x"]).toBe(slot17["x"]);
        }
      },
    );

    it.each<{
      seat: Seat;
      axis: "x" | "y";
    }>([
      {
        seat: "East",
        axis: "x",
      },
      {
        seat: "South",
        axis: "y",
      },
      {
        seat: "West",
        axis: "x",
      },
      {
        seat: "North",
        axis: "y",
      },
    ])(
      "returns stacks TILE_WIDTH apart along the $seat wall's axis",
      ({ seat, axis }) => {
        for (let stack = 1; stack < WALL_SIZE; stack++) {
          const current = slotPosition({ seat, stack, layer: "top" });
          const next = slotPosition({ seat, stack: stack + 1, layer: "top" });

          expect(
            Math.abs(current[axis] - next[axis]),
            `stacks ${stack}->${stack + 1}`,
          ).toBe(TILE_WIDTH);
        }
      },
    );

    it.each<Seat>(["East", "South", "West", "North"])(
      "returns top tile is STACK_OFFSET above bottom tile in screen space for %s wall",
      (seat) => {
        const stacks = Array.from({ length: 17 }, (_, i) => 1 + i);

        for (const stack of stacks) {
          const top = slotPosition({ seat, stack, layer: "top" });
          const bottom = slotPosition({ seat, stack, layer: "bottom" });

          expect(top.x, `stack ${stack} x`).toBe(bottom.x);
          expect(top.y, `stack ${stack} y`).toBe(bottom.y - STACK_OFFSET);
          expect(top.orientation).toBe(bottom.orientation);
        }
      },
    );

    it.todo(
      "no two bottom-layer footprints overlap across all four walls, including corners",
      () => {},
    );
  });
});
