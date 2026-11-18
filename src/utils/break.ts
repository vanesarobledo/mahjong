// import type { Slot } from "vue";
import type { Seat } from "@/utils/wall.ts";

export type Break = { total: number; seat: Seat; stack: number }

export function computeBreak(die1: number, die2: number): Break {
  // Return a stub
  return {
    total: 0,
    seat: 'East',
    stack: 1
  }
}

// export function deadWallStacks(brk: Break): Array<{ seat: Seat; stack: number }> {
//
// }