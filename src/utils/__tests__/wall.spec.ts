import { describe, expect, it } from "vitest";
import {
  allSlots,
  type Orientation,
  orientedRect,
  type Seat,
  seatOrientation,
  type Slot,
  slotPosition,
} from "@/utils/wall.ts";
import {
  STACK_OFFSET,
  TILE_HEIGHT,
  TILE_WIDTH,
  WALL_SIZE,
} from "@/constants.ts";
import { rectsIntersect, tileToRect } from "@/utils/geometry.ts";
import type { Tile } from "@/types.ts";

describe("building the wall", () => {
  function wallSlots(seat: Seat): Slot[] {
    const stackNumbers = Array.from({ length: 17 }, (_, i) => i + 1);
    return stackNumbers.flatMap((stack) => [
      {
        seat,
        stack: stack,
        layer: "top",
      },
      {
        seat,
        stack: stack,
        layer: "bottom",
      },
    ]);
  }
  const tile: Tile = {
    id: 1,
    src: "",
    name: "",
    rotationY: 0,
    rotationZ: 0,
    isFaceUp: false,
    x: 0,
    y: 0,
    zIndex: 1,
  };

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

    it("places East wall below the West wall", () => {
      const eastY = wallSlots("East").map((slot) => slotPosition(slot).y);
      const westY = wallSlots("West").map((slot) => slotPosition(slot).y);

      expect(Math.min(...eastY)).toBeGreaterThan(Math.max(...westY));
    });

    it("places the South wall to the right of North wall", () => {
      const southX = wallSlots("South").map((slot) => slotPosition(slot).x);
      const northX = wallSlots("North").map((slot) => slotPosition(slot).x);

      expect(Math.max(...northX)).toBeLessThan(Math.min(...southX));
    });

    it(
      "no two bottom-layer footprints overlap across all four walls, including corners",
      () => {
        const wall = allSlots();
        const bottomWall = wall
          .filter((stack) => stack.layer === "bottom")
          .map((slot) => {
            const slotPos = slotPosition(slot);
            const rect = orientedRect(slotPos, slotPos.orientation);
            return {
              label: `${slot.seat} ${slot.stack}`,
              rect,
            };
          });

        expect(bottomWall.length).toBe(wall.length / 2);

        for (let i = 0; i < bottomWall.length; i++) {
          for (let j = i + 1; j < bottomWall.length; j++) {
            expect(
              rectsIntersect(bottomWall[i].rect, bottomWall[j].rect),
              `${bottomWall[i].label} vs ${bottomWall[j].label}`,
            ).toBe(false);
          }
        }
      },
    );
  });

  describe("orientedRect", () => {
    it("at 0 / 180 equals today's tileToRect", () => {
      const pos = {x: 100, y: 200};
      const expected = tileToRect({... tile, ...pos});
      const orientedRect0 = orientedRect(pos, 0);
      const orientedRect180 = orientedRect(pos, 180);

      expect(orientedRect0).toEqual(expected);
      expect(orientedRect180).toEqual(expected);
    });

    it("at 90 / 270 has width and height swap around the tile's centre.", () => {
      const pos = { x: 829, y: 817 };

      expect(orientedRect(pos, 90)).toEqual({
        left: 818,
        right: 890,
        top: 828,
        bottom: 878,
      });
      expect(orientedRect(pos, 270)).toEqual({
        left: 818,
        right: 890,
        top: 828,
        bottom: 878,
      });

    });
  });
});
