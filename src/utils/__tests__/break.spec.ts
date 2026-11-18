import { describe, expect, it } from "vitest";
import type { Seat } from "@/utils/wall.ts";
import { computeBreak, deadWallStacks } from "@/utils/break.ts";

describe("break", () => {
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

    it.each<{ die1: number; die2: number }>([
      {
        die1: -1,
        die2: 1,
      },
      {
        die1: 1,
        die2: 8,
      },
    ])("throws an error when dice inputs are out of range", ({ die1, die2 }) => {
      expect(() => {
        computeBreak(die1, die2);
      }).toThrow("Dice rolled must be 1d6; only inputs 1-6 are allowed");
    });
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

        // TODO: Find better assertion?
        expect(new Set(deadWallSeats).size).toBe(1);
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
});
