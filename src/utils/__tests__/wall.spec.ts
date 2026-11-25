import { describe, expect, it } from "vitest";
import {
  allSlots,
  assignTiles,
  getTableOriginX,
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
  HAND_MARGIN,
  STACK_OFFSET,
  TILE_HEIGHT,
  TILE_WIDTH,
  WALL_SIZE,
} from "@/constants.ts";
import { type Point, type Rect, rectsIntersect } from "@/utils/geometry.ts";
import { type Break, deadWallStacks } from "@/utils/break.ts";

type Stack = { seat: Seat; stack: number };

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

function isInStacks(slot: Slot, stacks: Stack[]): boolean {
  return stacks.some((s) => slot.seat === s.seat && slot.stack === s.stack);
}

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

function sameLayerCollisions(brk?: Break): string[] {
  const slots = allSlots();
  const topStack = slots.filter((slot) => slot.layer === "top");
  const bottomStack = slots.filter((slot) => slot.layer === "bottom");

  return [
    ...collisionsInSlots(topStack, brk),
    ...collisionsInSlots(bottomStack, brk),
  ];
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
      const expectedBottomStack = Array.from({ length: WALL_SIZE }, (_, i) => ({
        seat,
        stack: i + 1,
        layer: "bottom",
      }));

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
    "returns orientation $expected for the $seat seat",
    ({ seat, expected }) => {
      const sOrientation = seatOrientation(seat);

      expect(sOrientation).toBe(expected);
    },
  );
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

describe("slotPosition", () => {
  describe("without a break", () => {
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

    it("no two tiles in the same layer intersect", () => {
      expect(sameLayerCollisions()).toEqual([]);
    });

    describe("table square", () => {
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

      it("every footprint lies inside the table square", () => {
        for (const [_i, wallFootprint] of wallFootprints.entries()) {
          expect(
            wallFootprint.rect.top,
            `${wallFootprint.label} top`,
          ).toBeGreaterThanOrEqual(tableSquare.top);
          expect(
            wallFootprint.rect.left,
            `${wallFootprint.label} left`,
          ).toBeGreaterThanOrEqual(tableSquare.left);
          expect(
            wallFootprint.rect.bottom,
            `${wallFootprint.label} bottom`,
          ).toBeLessThanOrEqual(tableSquare.bottom);
          expect(
            wallFootprint.rect.right,
            `${wallFootprint.label} right`,
          ).toBeLessThanOrEqual(tableSquare.right);
        }
      });

      it("the walls fill the table square edge to edge", () => {
        const boundingBox: Rect = {
          top: Math.min(...wallFootprints.map((f) => f.rect.top)),
          left: Math.min(...wallFootprints.map((f) => f.rect.left)),
          bottom: Math.max(...wallFootprints.map((f) => f.rect.bottom)),
          right: Math.max(...wallFootprints.map((f) => f.rect.right)),
        };

        expect(boundingBox).toEqual(tableSquare);
      });
    });
  });

  describe("after a break", () => {
    const TOWARD_STACK_17: Record<Seat, Point> = {
      East: { x: -BREAK_GAP, y: 0 },
      South: { x: 0, y: BREAK_GAP },
      West: { x: BREAK_GAP, y: 0 },
      North: { x: 0, y: -BREAK_GAP },
    };

    // Asserts both layers of every given stack moved `multiplier` × BREAK_GAP
    // toward their own wall's stack 17 (0 = didn't move), compared to no break
    function expectShift(stacks: Stack[], brk: Break, multiplier: number) {
      const pairs = allSlots()
        .filter((slot) => isInStacks(slot, stacks))
        .map((slot) => ({
          slot,
          base: slotPosition(slot),
          shifted: slotPosition(slot, brk),
        }));

      expect(pairs).toHaveLength(stacks.length * 2);

      for (const { slot, base, shifted } of pairs) {
        const label = `${slot.seat} ${slot.stack} ${slot.layer}`;
        const step = TOWARD_STACK_17[slot.seat];

        expect(shifted.x, `${label} x-axis`).toBe(base.x + multiplier * step.x);
        expect(shifted.y, `${label} y-axis`).toBe(base.y + multiplier * step.y);
        expect(shifted.orientation, `${label} orientation`).toBe(
          base.orientation,
        );
      }
    }

    function rectAfterBreak(slot: Stack, brk: Break): Rect {
      const pos = slotPosition({ ...slot, layer: "bottom" }, brk);
      return orientedRect(pos, pos.orientation);
    }

    function axisGap(a: Rect, b: Rect, axis: "x" | "y") {
      if (axis === "x") {
        if (b.left > a.left) {
          return b.left - a.right;
        } else {
          return a.left - b.right;
        }
      } else {
        if (b.bottom > a.bottom) {
          return b.top - a.bottom;
        } else {
          return a.top - b.bottom;
        }
      }
    }

    function getAxis(seat: Seat) {
      if (seat === "North" || seat === "South") {
        return "y";
      }
      return "x";
    }

    it.each<{
      brk: Break;
      nearLive: Stack[];
    }>([
      {
        brk: {
          seat: "North",
          total: 12,
        },
        nearLive: [
          { seat: "North", stack: 13 },
          { seat: "North", stack: 14 },
          { seat: "North", stack: 15 },
          { seat: "North", stack: 16 },
          { seat: "North", stack: 17 },
        ],
      },
      {
        brk: {
          seat: "East",
          total: 9,
        },
        nearLive: [
          { seat: "East", stack: 10 },
          { seat: "East", stack: 11 },
          { seat: "East", stack: 12 },
          { seat: "East", stack: 13 },
          { seat: "East", stack: 14 },
          { seat: "East", stack: 15 },
          { seat: "East", stack: 16 },
          { seat: "East", stack: 17 },
        ],
      },
      {
        brk: {
          seat: "South",
          total: 10,
        },
        nearLive: [
          { seat: "South", stack: 11 },
          { seat: "South", stack: 12 },
          { seat: "South", stack: 13 },
          { seat: "South", stack: 14 },
          { seat: "South", stack: 15 },
          { seat: "South", stack: 16 },
          { seat: "South", stack: 17 },
        ],
      },
      {
        brk: {
          seat: "West",
          total: 11,
        },
        nearLive: [
          { seat: "West", stack: 12 },
          { seat: "West", stack: 13 },
          { seat: "West", stack: 14 },
          { seat: "West", stack: 15 },
          { seat: "West", stack: 16 },
          { seat: "West", stack: 17 },
        ],
      },
    ])(
      "near live side of a $brk.seat $brk.total break shifts 2 × BREAK_GAP toward stack 17",
      ({ brk, nearLive }) => {
        expectShift(nearLive, brk, 2);
      },
    );

    it.each<Break>([
      {
        seat: "West",
        total: 7,
      },
      {
        seat: "North",
        total: 8,
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
      {
        seat: "North",
        total: 12,
      },
    ])(
      "non-wrapped dead-wall stacks from a $seat $total shift BREAK_GAP toward their own wall's stack 17",
      (brk) => {
        const deadWall = deadWallStacks(brk);

        expect(deadWall.map((s) => s.seat)).toEqual(Array(7).fill(brk.seat));

        expectShift(deadWall, brk, 1);
      },
    );

    it.each<{
      brk: Break;
      expectedWrapped: Stack[];
    }>([
      {
        brk: { seat: "South", total: 2 },
        expectedWrapped: [
          { seat: "West", stack: 13 },
          { seat: "West", stack: 14 },
          { seat: "West", stack: 15 },
          { seat: "West", stack: 16 },
          { seat: "West", stack: 17 },
        ],
      },
      {
        brk: { seat: "West", total: 3 },
        expectedWrapped: [
          { seat: "North", stack: 14 },
          { seat: "North", stack: 15 },
          { seat: "North", stack: 16 },
          { seat: "North", stack: 17 },
        ],
      },
      {
        brk: { seat: "North", total: 4 },
        expectedWrapped: [
          { seat: "East", stack: 15 },
          { seat: "East", stack: 16 },
          { seat: "East", stack: 17 },
        ],
      },
      {
        brk: { seat: "East", total: 5 },
        expectedWrapped: [
          { seat: "South", stack: 16 },
          { seat: "South", stack: 17 },
        ],
      },
      {
        brk: { seat: "South", total: 6 },
        expectedWrapped: [{ seat: "West", stack: 17 }],
      },
    ])(
      "wrapped dead-wall stacks from a $brk.seat $brk.total break slide toward their own corner",
      ({ brk, expectedWrapped }) => {
        expect(expectedWrapped.map((s) => s.seat)).not.toContain(brk.seat);

        expectShift(expectedWrapped, brk, 1);
      },
    );

    it.each<Break>([
      { seat: "North", total: 8 },
      { seat: "East", total: 9 },
      { seat: "South", total: 10 },
      { seat: "West", total: 11 },
      { seat: "North", total: 12 },
    ])(
      "live stacks past the far end of a $seat $total break don't move",
      (brk) => {
        const farLive = Array.from({ length: brk.total - 7 }, (_, i) => ({
          seat: brk.seat,
          stack: i + 1,
        }));

        expectShift(farLive, brk, 0);
      },
    );

    it.each<Break>([
      {
        seat: "South",
        total: 2,
      },
      {
        seat: "West",
        total: 3,
      },
      {
        seat: "North",
        total: 4,
      },
      {
        seat: "East",
        total: 5,
      },
      {
        seat: "South",
        total: 6,
      },
      {
        seat: "North",
        total: 8,
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
      {
        seat: "North",
        total: 12,
      },
    ])("dead wall is separated at both ends: $seat $total", (brk) => {
      const deadWall = deadWallStacks(brk);

      const near = {
        dead: rectAfterBreak(deadWall[0]!, brk),
        live: rectAfterBreak({ seat: brk.seat, stack: brk.total + 1 }, brk),
      };

      const far = {
        dead: rectAfterBreak(deadWall[6]!, brk),
        live: rectAfterBreak(
          { seat: deadWall[6]!.seat, stack: deadWall[6]!.stack - 1 },
          brk,
        ),
      };

      expect(axisGap(near.dead, near.live, getAxis(deadWall[0]!.seat))).toBe(
        BREAK_GAP,
      );
      expect(axisGap(far.dead, far.live, getAxis(deadWall[6]!.seat))).toBe(
        BREAK_GAP,
      );
    });

    // West 7 is a separate check - far end is stack 1, which has no neighbour
    it("dead wall is separated from live wall end: West 7", () => {
      const brk: Break = { total: 7, seat: "West" };
      const deadWall = deadWallStacks(brk);

      const pair = {
        dead: rectAfterBreak(deadWall[0]!, brk),
        live: rectAfterBreak({ seat: brk.seat, stack: brk.total + 1 }, brk),
      };

      expect(axisGap(pair.dead, pair.live, getAxis(deadWall[0]!.seat))).toBe(
        BREAK_GAP,
      );
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
    ])(
      "no two tiles in the same layer intersect: $seat $total",
      (brk: Break) => {
        expect(sameLayerCollisions(brk)).toEqual([]);
      },
    );
  });
});

const TOTAL_TILES = 136;
const ids = Array.from({ length: TOTAL_TILES }, (_, i) => i + 1);

describe("assignTiles", () => {
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
});

describe("tileInSlot", () => {
  it("returns the correct tile ID given a slot, a different ID with the same stack but different layer, and undefined for invalid stack", () => {
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

    const doraTileId = tileInSlot(tilesToSlots, doraSlot);
    const otherSlotId = tileInSlot(tilesToSlots, otherSlot);
    const nonExistentSlotId = tileInSlot(tilesToSlots, nonExistentSlot);

    expect(doraTileId).toBe(expectedId);
    expect(otherSlotId).toBe(otherExpectedId);
    expect(nonExistentSlotId).toBeUndefined();
  });
});

describe("tableOriginX", () => {
  it.each<{
    description: string;
    boardWidth: number;
    expected: number;
  }>([
    {
      description: "centres the table on a wide board",
      boardWidth: TABLE_SIZE + 2 * HAND_MARGIN + 200,
      expected: 100,
    },
    {
      description: "returns 0 at exactly the minimum width",
      boardWidth: TABLE_SIZE + 2 * HAND_MARGIN,
      expected: 0,
    },
    {
      description: "clamps to 0 on a board narrow than the table + margins",
      boardWidth: TABLE_SIZE + 2 * HAND_MARGIN - 200,
      expected: 0,
    },
  ])("$description", ({ boardWidth, expected }) => {
    expect(getTableOriginX(boardWidth)).toBe(expected);
  });
});
