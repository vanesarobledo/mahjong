// import type { Slot } from "vue";
import type { Seat } from "@/utils/wall.ts";

export type Break = { total: number; seat: Seat; stack: number }

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
    seat,
    stack: 1
  }
}

// export function deadWallStacks(brk: Break): Array<{ seat: Seat; stack: number }> {
//
// }