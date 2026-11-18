import { describe, expect, it } from "vitest";
import type { Seat } from "@/utils/wall.ts";
import { computeBreak } from "@/utils/break.ts";

describe('break', () => {
  describe('computeBreak', () => {
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
  });
});