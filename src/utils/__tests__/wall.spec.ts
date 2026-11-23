import { describe, expect, it } from "vitest";
import {
  allSlots,
  assignTiles,
  type Orientation,
  orientedRect,
  type Seat,
  seatOrientation,
  type Slot,
  slotPosition,
  TABLE_SIZE,
  tileInSlot,
} from "@/utils/wall.ts";
import {
  BREAK_GAP,
  CORNER_GAP,
  HAND_MARGIN,
  STACK_OFFSET,
  TILE_HEIGHT,
  TILE_WIDTH,
  WALL_SIZE,
} from "@/constants.ts";
import { type Rect, rectsIntersect } from "@/utils/geometry.ts";
import {
  type Break,
  deadWallStacks,
  doraIndicatorSlot,
} from "@/utils/break.ts";

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

  function isInDeadWall(
    slot: Slot,
    deadWall: Array<{ seat: Seat; stack: number }>,
  ): boolean {
    return deadWall.some((s) => slot.seat === s.seat && slot.stack === s.stack);
  }

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

    it("no two bottom-layer footprints overlap across all four walls, including corners", () => {
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

      for (const [i, a] of bottomWall.entries()) {
        for (const b of bottomWall.slice(i + 1)) {
          expect(
            rectsIntersect(a.rect, b.rect),
            `${a.label} vs ${b.label}`,
          ).toBe(false);
        }
      }
    });

    it("table square is calculated correctly using CORNER_GAP, WALL_SIZE, TILE_WIDTH, and HAND_MARGIN", () => {
      const tableSquare: Rect = {
        top: HAND_MARGIN,
        left: HAND_MARGIN,
        right: TABLE_SIZE + HAND_MARGIN,
        bottom: TABLE_SIZE + HAND_MARGIN,
      };
      const expectedSquare: Rect = {
        top: HAND_MARGIN,
        left: HAND_MARGIN,
        right: 2 * CORNER_GAP + WALL_SIZE * TILE_WIDTH + HAND_MARGIN,
        bottom: 2 * CORNER_GAP + WALL_SIZE * TILE_WIDTH + HAND_MARGIN,
      };

      expect(tableSquare).toEqual(expectedSquare);
    });

    it("every footprint lies inside the table square", () => {
      const tableSquare: Rect = {
        top: HAND_MARGIN,
        left: HAND_MARGIN,
        right: TABLE_SIZE + HAND_MARGIN,
        bottom: TABLE_SIZE + HAND_MARGIN,
      };
      const wall = allSlots();
      const wallFootprints = wall.map((slot) => {
        const slotPos = slotPosition(slot);
        const rect = orientedRect(slotPos, slotPos.orientation);
        return {
          label: `${slot.seat} ${slot.stack}`,
          rect,
        };
      });

      for (const [_i, wallFootprint] of wallFootprints.entries()) {
        expect(
          rectsIntersect(wallFootprint.rect, tableSquare),
          `${wallFootprint.label}`,
        ).toBe(true);
      }
    });
  });

  describe("orientedRect", () => {
    it("at 0 / 180 returns rect the size of tile width and height", () => {
      const pos = { x: 100, y: 200 };
      const expected = {
        left: pos.x,
        right: pos.x + TILE_WIDTH,
        top: pos.y,
        bottom: pos.y + TILE_HEIGHT,
      };
      const orientedRect0 = orientedRect(pos, 0);
      const orientedRect180 = orientedRect(pos, 180);

      expect(orientedRect0).toEqual(expected);
      expect(orientedRect180).toEqual(expected);
    });

    it("at 90 / 270 has width and height swap around the tile's centre", () => {
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

  describe("the dead-wall stacks on the dice wall shift BREAK_GAP away from the break, toward the corner", () => {
    it.each<{ brk: Break; expected: Array<{ seat: Seat; stack: number }> }>([
      {
        brk: {
          seat: "South",
          total: 2,
        },
        expected: [
          { seat: "South", stack: 2 },
          { seat: "South", stack: 1 },
          { seat: "West", stack: 17 },
          { seat: "West", stack: 16 },
          { seat: "West", stack: 15 },
          { seat: "West", stack: 14 },
          { seat: "West", stack: 13 },
        ],
      },
      {
        brk: {
          seat: "West",
          total: 3,
        },
        expected: [
          { seat: "West", stack: 3 },
          { seat: "West", stack: 2 },
          { seat: "West", stack: 1 },
          { seat: "North", stack: 17 },
          { seat: "North", stack: 16 },
          { seat: "North", stack: 15 },
          { seat: "North", stack: 14 },
        ],
      },
      {
        brk: {
          seat: "North",
          total: 4,
        },
        expected: [
          { seat: "North", stack: 4 },
          { seat: "North", stack: 3 },
          { seat: "North", stack: 2 },
          { seat: "North", stack: 1 },
          { seat: "East", stack: 17 },
          { seat: "East", stack: 16 },
          { seat: "East", stack: 15 },
        ],
      },
      {
        brk: {
          seat: "East",
          total: 5,
        },
        expected: [
          { seat: "East", stack: 5 },
          { seat: "East", stack: 4 },
          { seat: "East", stack: 3 },
          { seat: "East", stack: 2 },
          { seat: "East", stack: 1 },
          { seat: "South", stack: 17 },
          { seat: "South", stack: 16 },
        ],
      },
    ])("dead wall for $brk.seat $brk.total", ({ brk, expected }) => {
      expect(deadWallStacks(brk)).toEqual(expected);
    });

    it.each<{
      brk: Break;
      axis: "x" | "y";
      offset: number;
      expectedDeadWall: Array<{ seat: Seat; stack: number }>;
    }>([
      {
        brk: {
          seat: "North",
          total: 12,
        },
        axis: "y",
        offset: BREAK_GAP,
        expectedDeadWall: [
          { seat: "North", stack: 12 },
          { seat: "North", stack: 11 },
          { seat: "North", stack: 10 },
          { seat: "North", stack: 9 },
          { seat: "North", stack: 8 },
          { seat: "North", stack: 7 },
          { seat: "North", stack: 6 },
        ],
      },
      {
        brk: {
          seat: "East",
          total: 9,
        },
        axis: "x",
        offset: BREAK_GAP,
        expectedDeadWall: [
          { seat: "East", stack: 9 },
          { seat: "East", stack: 8 },
          { seat: "East", stack: 7 },
          { seat: "East", stack: 6 },
          { seat: "East", stack: 5 },
          { seat: "East", stack: 4 },
          { seat: "East", stack: 3 },
        ],
      },
      {
        brk: {
          seat: "South",
          total: 10,
        },
        axis: "y",
        offset: -BREAK_GAP,
        expectedDeadWall: [
          { seat: "South", stack: 10 },
          { seat: "South", stack: 9 },
          { seat: "South", stack: 8 },
          { seat: "South", stack: 7 },
          { seat: "South", stack: 6 },
          { seat: "South", stack: 5 },
          { seat: "South", stack: 4 },
        ],
      },
      {
        brk: {
          seat: "West",
          total: 11,
        },
        axis: "x",
        offset: -BREAK_GAP,
        expectedDeadWall: [
          { seat: "West", stack: 11 },
          { seat: "West", stack: 10 },
          { seat: "West", stack: 9 },
          { seat: "West", stack: 8 },
          { seat: "West", stack: 7 },
          { seat: "West", stack: 6 },
          { seat: "West", stack: 5 },
        ],
      },
    ])(
      "when dead wall stack is all on the $brk.seat wall",
      ({ brk, axis, offset, expectedDeadWall }) => {
        const otherAxis = axis === "x" ? "y" : "x";

        const pairs = allSlots()
          .filter((slot) => isInDeadWall(slot, expectedDeadWall))
          .map((slot) => ({
            slot,
            base: slotPosition(slot),
            shifted: slotPosition(slot, brk),
          }));

        for (const { slot, base, shifted } of pairs) {
          expect(
            shifted[axis],
            `${slot.seat} ${slot.stack} ${slot.layer} ${axis}`,
          ).toBe(base[axis] + offset);
          expect(
            shifted[otherAxis],
            `${slot.seat} ${slot.stack} ${slot.layer} ${otherAxis}`,
          ).toBe(base[otherAxis]);
        }
      },
    );

    it.each<Break>([
      {
        seat: "North",
        total: 12,
      },
      {
        seat: "East",
        total: 9,
      },
      {
        seat: "South",
        total: 10,
      },
      {
        seat: "West",
        total: 11,
      },
    ])("stacks outside the dead wall don't move", (brk) => {
      const expectedDeadWall = deadWallStacks(brk);

      const pairs = allSlots()
        .filter((slot) => !isInDeadWall(slot, expectedDeadWall))
        .map((slot) => ({
          slot,
          base: slotPosition(slot),
          brk: slotPosition(slot, brk),
        }));

      for (const { slot, base, brk } of pairs) {
        expect(
          brk["x"],
          `${slot.seat} ${slot.stack} ${slot.layer} x-axis`,
        ).toBe(base["x"]);
        expect(
          brk["y"],
          `${slot.seat} ${slot.stack} ${slot.layer} y-axis`,
        ).toBe(base["y"]);
      }
    });

    it.each<{
      brk: Break;
      shift: { x: number; y: number };
      expectedDeadWall: Array<{ seat: Seat; stack: number }>;
    }>([
      {
        brk: { seat: "South", total: 2 },
        shift: { x: 0, y: -BREAK_GAP },
        expectedDeadWall: [
          { seat: "South", stack: 2 },
          { seat: "South", stack: 1 },
          { seat: "West", stack: 17 },
          { seat: "West", stack: 16 },
          { seat: "West", stack: 15 },
          { seat: "West", stack: 14 },
          { seat: "West", stack: 13 },
        ],
      },
      {
        brk: { seat: "West", total: 3 },
        shift: { x: -BREAK_GAP, y: 0 },
        expectedDeadWall: [
          { seat: "West", stack: 3 },
          { seat: "West", stack: 2 },
          { seat: "West", stack: 1 },
          { seat: "North", stack: 17 },
          { seat: "North", stack: 16 },
          { seat: "North", stack: 15 },
          { seat: "North", stack: 14 },
        ],
      },
      {
        brk: { seat: "North", total: 4 },
        shift: { x: 0, y: +BREAK_GAP },
        expectedDeadWall: [
          { seat: "North", stack: 4 },
          { seat: "North", stack: 3 },
          { seat: "North", stack: 2 },
          { seat: "North", stack: 1 },
          { seat: "East", stack: 17 },
          { seat: "East", stack: 16 },
          { seat: "East", stack: 15 },
        ],
      },
      {
        brk: { seat: "East", total: 5 },
        shift: { x: BREAK_GAP, y: 0 },
        expectedDeadWall: [
          { seat: "East", stack: 5 },
          { seat: "East", stack: 4 },
          { seat: "East", stack: 3 },
          { seat: "East", stack: 2 },
          { seat: "East", stack: 1 },
          { seat: "South", stack: 17 },
          { seat: "South", stack: 16 },
        ],
      },
    ])(
      "dead wall from a $brk.seat break at $brk.total shifts as one piece",
      ({ brk, shift, expectedDeadWall }) => {
        const pairs = allSlots()
          .filter((slot) => isInDeadWall(slot, expectedDeadWall))
          .map((slot) => ({
            slot,
            base: slotPosition(slot),
            shifted: slotPosition(slot, brk),
          }));

        expect(pairs.length).toBe(14);

        for (const { slot, base, shifted } of pairs) {
          const label = `${slot.seat} ${slot.stack} ${slot.layer}`;
          expect(shifted.x, label).toBe(base.x + shift.x);
          expect(shifted.y, label).toBe(base.y + shift.y);
        }
      },
    );
  });

  describe("no two tiles in the same layer intersect", () => {
    const slots = allSlots();

    function collisionsInSlots(slots: Slot[], brk?: Break): string[] {
      let collisions = [];
      const slotRects = slots.map((slot) => {
        const slotPos = slotPosition(slot, brk);
        return {
          slot,
          rect: orientedRect(slotPos, slotPos.orientation),
        };
      });

      for (const [i, a] of slotRects.entries()) {
        for (const b of slotRects.slice(i + 1)) {
          if (rectsIntersect(a.rect, b.rect)) {
            collisions.push(
              `${a.slot.layer} ${a.slot.seat} ${a.slot.stack} × ${b.slot.layer} ${b.slot.seat} ${b.slot.stack}`,
            );
          }
        }
      }
      return collisions;
    }

    it("with no break", () => {
      const topStack = slots.filter((slot) => slot.layer === "top");
      const bottomStack = slots.filter((slot) => slot.layer === "bottom");

      const collisions = [
        ...collisionsInSlots(topStack),
        ...collisionsInSlots(bottomStack),
      ];

      expect(collisions).toEqual([]);
    });

    it.each<Break>([
      {
        total: 2,
        seat: "South",
      },
      {
        total: 3,
        seat: "West",
      },
      {
        total: 4,
        seat: "North",
      },
      {
        total: 5,
        seat: "East",
      },
      {
        total: 6,
        seat: "South",
      },
      {
        total: 7,
        seat: "West",
      },
      {
        total: 8,
        seat: "North",
      },
      {
        total: 9,
        seat: "East",
      },
      {
        total: 10,
        seat: "South",
      },
      {
        total: 11,
        seat: "West",
      },
      {
        total: 12,
        seat: "North",
      },
    ])("$seat $total", (brk: Break) => {
      const topStack = slots.filter((slot) => slot.layer === "top");
      const bottomStack = slots.filter((slot) => slot.layer === "bottom");

      const collisions = [
        ...collisionsInSlots(topStack, brk),
        ...collisionsInSlots(bottomStack, brk),
      ];

      expect(collisions).toEqual([]);
    });
  });

  describe("assignTiles", () => {
    const TOTAL_TILES = 136;
    const ids = Array.from({ length: TOTAL_TILES }, (_, i) => i + 1);

    it("the same id order gives the same assignment", () => {
      const slots = allSlots();
      const differentIds = [...ids].reverse();
      const expectedMap = new Map(
        slots.map((slot, index) => [differentIds[index], slot]),
      );

      const tilesToSlots = assignTiles(differentIds);

      expect(tilesToSlots).toEqual(expectedMap);
    });

    it("throws if not given exactly 136 IDs", () => {
      expect(() => {
        assignTiles(Array.from({ length: TOTAL_TILES + 1 }, (_, i) => i + 1));
      }).toThrow("Length of shuffled IDs must be 136");
    });

    it("returns only one Dora indicator", () => {
      const slots = allSlots();
      const tilesToSlots = assignTiles(ids);

      const doraSlot: Slot = {
        seat: "West",
        stack: 1,
        layer: "top",
      };
      const expectedId =
        ids[
          slots.findIndex(
            (s) =>
              s.seat === doraSlot.seat &&
              s.stack === doraSlot.stack &&
              s.layer === doraSlot.layer,
          )
        ];

      // Same slot, different layer
      const otherSlot: Slot = {
        ...doraSlot,
        layer: "bottom",
      };
      const otherExpectedId =
        ids[
          slots.findIndex(
            (s) =>
              s.seat === otherSlot.seat &&
              s.stack === otherSlot.stack &&
              s.layer === otherSlot.layer,
          )
        ];

      const nonExistentSlot: Slot = {
        seat: "West",
        stack: 18,
        layer: "top",
      };
      const expectedNonExistentSlotId =
        ids[
          slots.findIndex(
            (s) =>
              s.seat === nonExistentSlot.seat &&
              s.stack === nonExistentSlot.stack &&
              s.layer === nonExistentSlot.layer,
          )
        ];

      const doraTileId = tileInSlot(tilesToSlots, doraSlot);
      const otherSlotId = tileInSlot(tilesToSlots, otherSlot);
      const nonExistentSlotId = tileInSlot(tilesToSlots, nonExistentSlot);

      expect(doraTileId).toBe(expectedId);
      expect(otherSlotId).toBe(otherExpectedId);
      expect(nonExistentSlotId).toBe(expectedNonExistentSlotId);
    });
  });
});
