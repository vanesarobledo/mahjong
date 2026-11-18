// import type { Slot } from "vue";
import type { Seat } from "@/utils/wall.ts";
import { WALL_SIZE } from "@/constants.ts";

export type Break = { total: number; seat: Seat; }

const breakSouth = [2, 6, 10];
const breakWest = [3, 7, 11];
const breakNorth = [4, 8, 12];

export function computeBreak(die1: number, die2: number): Break {
  // // Add a test for this guard if you implement it
  // if (die1 > 6 || die2 < 6) {
  //   throw new Error('You should only be rolling d6s');
  // }

  const total = die1 + die2;
  let seat: Seat = 'East';
  if (breakSouth.includes(total)) {
    seat = 'South';
  }
  else if (breakWest.includes(total)) {
    seat = 'West';
  }
  else if (breakNorth.includes(total)) {
    seat = 'North';
  }

  return {
    total,
    seat
  }
}

export function deadWallStacks(brk: Break): Array<{ seat: Seat; stack: number }> {
  let deadWall = [];

  let seat = brk.seat;
  let stack = brk.total;
  if (brk.seat === "North") stack += 17;
  if (brk.seat === "West") stack += 34;
  if (brk.seat === "South") stack += 51;

  for (let i = 0; i < 7; i++) {
    let stackNum = Math.abs(stack - i) % WALL_SIZE;

    // Wrap occurred
    if (stackNum === 0) {
      if (brk.seat === "East") seat = "South"
      if (brk.seat === "North") seat = "East"
      if (brk.seat === "West") seat = "North"
      if (brk.seat === "South") seat = "West"
    }

    deadWall.push({
      seat,
      stack: stackNum === 0 ? WALL_SIZE : stackNum,
    });
  }
  return deadWall;
}