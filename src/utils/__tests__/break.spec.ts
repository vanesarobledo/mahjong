import { describe, expect, it } from "vitest";
import { allSlots, type Seat } from "@/utils/wall.ts";
import {
  type Break,
  computeBreak,
  deadWallStacks,
  doraIndicatorSlot,
} from "@/utils/break.ts";
import { BREAK_GAP } from "@/constants.ts";

describe("breaking the wall", () => {
  describe("computeBreak", () => {
    it.each<{
      die1: number;
      die2: number;
      total: number;
      seat: Seat;
    }>([
      {
        die1: 1,
        die2: 1,
        total: 2,
        seat: "South",
      },
      {
        die1: 1,
        die2: 2,
        total: 3,
        seat: "West",
      },
      {
        die1: 2,
        die2: 2,
        total: 4,
        seat: "North",
      },
      {
        die1: 2,
        die2: 3,
        total: 5,
        seat: "East",
      },
      {
        die1: 3,
        die2: 3,
        total: 6,
        seat: "South",
      },
      {
        die1: 3,
        die2: 4,
        total: 7,
        seat: "West",
      },
      {
        die1: 4,
        die2: 4,
        total: 8,
        seat: "North",
      },
      {
        die1: 4,
        die2: 5,
        total: 9,
        seat: "East",
      },
      {
        die1: 5,
        die2: 5,
        total: 10,
        seat: "South",
      },
      {
        die1: 5,
        die2: 6,
        total: 11,
        seat: "West",
      },
      {
        die1: 6,
        die2: 6,
        total: 12,
        seat: "North",
      },
    ])("$die1 + $die2 = $total → $seat", ({ die1, die2, total, seat }) => {
      const wallBreak = computeBreak(die1, die2);

      expect(wallBreak.total).toBe(total);
      expect(wallBreak.seat).toBe(seat);
    });

    it.each<{ range: string; die1: number; die2: number }>([
      {
        range: "below",
        die1: -1,
        die2: 1,
      },
      {
        range: "above",
        die1: 1,
        die2: 8,
      },
    ])(
      "throws an error when dice inputs are $range the range",
      ({ die1, die2 }) => {
        expect(() => {
          computeBreak(die1, die2);
        }).toThrow("Dice rolled must be 1d6; only inputs 1-6 are allowed");
      },
    );
  });

  describe("deadWallStacks", () => {
    it("always returns 7 distinct stacks", () => {
      const deadWall = deadWallStacks({ total: 12, seat: "North" });
      // Convert objects to strings to test uniqueness
      const keys = deadWall.map((slot) => {
        return `${slot.seat},${slot.stack}`;
      });

      expect(deadWall.length).toEqual(7);
      expect(new Set(keys).size).toEqual(deadWall.length);
    });

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

    describe("when the dead wall fits on the dice wall", () => {
      it("stops at stack 2 when the total is 8, leaving stack 1 live", () => {
        const total = 8;
        const deadWall = deadWallStacks({ total, seat: "North" });
        const deadWallStackNumbers = deadWall.map((s) => {
          return s.stack;
        });

        expect(Math.min(...deadWallStackNumbers)).toBe(2);
        expect(Math.max(...deadWallStackNumbers)).toBe(total);
        expect(deadWallStackNumbers.includes(1)).toBe(false);
      });

      it("stays on one wall at the highest total (12)", () => {
        const total = 12;
        const deadWall = deadWallStacks({ total, seat: "North" });
        const deadWallSeats = deadWall.map((s) => {
          return s.seat;
        });

        expect(new Set(deadWallSeats)).toEqual(new Set(["North"]));
      });
    });

    describe("when the dead wall wraps into the next wall", () => {
      it("continues from the next wall's stack 17 after running out of stacks (total 3)", () => {
        const total = 3;
        const deadWall = deadWallStacks({ total, seat: "West" });
        const nextWallWrap = deadWall.filter((s) => {
          return s.seat === "North";
        });

        expect(nextWallWrap.length).toBe(4);
        expect(deadWall.find((s) => s.stack === total)?.seat).toBe("West");
        expect(deadWall.find((s) => s.stack === 17)?.seat).toBe("North");
      });

      it("takes most of its stacks from the next wall at the lowest total (2)", () => {
        const total = 2;
        const seat: Seat = "South";
        const deadWall = deadWallStacks({ total, seat });
        const sameWall = deadWall.filter((s) => {
          return s.seat === seat;
        });
        const nextWallWrap = deadWall.filter((s) => {
          return s.seat === "West";
        });

        expect(nextWallWrap.length).toBeGreaterThan(sameWall.length);
      });
    });
  });

  describe("flips the correct Dora indicator in the dead wall", () => {
    it.each<{
      total: number;
      seat: Seat;
      expectedSeat: Seat;
      expectedStack: number;
    }>([
      {
        total: 8,
        seat: "North",
        expectedSeat: "North",
        expectedStack: 6,
      },
      {
        total: 3,
        seat: "West",
        expectedSeat: "West",
        expectedStack: 1,
      },
      {
        total: 2,
        seat: "South",
        expectedSeat: "West",
        expectedStack: 17,
      },
    ])(
      "flips $expectedSeat stack $expectedStack",
      ({ total, seat, expectedSeat, expectedStack }) => {
        const actual = doraIndicatorSlot({ total, seat });

        expect(actual.seat).toBe(expectedSeat);
        expect(actual.stack).toBe(expectedStack);
        expect(actual.layer).toBe("top");
      },
    );
  });
});
