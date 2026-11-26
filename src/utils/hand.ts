import { type Orientation, type Seat, seatOrientation } from "@/utils/wall.ts";
import type { Point, Rect } from "@/utils/geometry.ts";
import { TILE_WIDTH } from "@/constants.ts";

export const HAND_SIZE = 14;
export function handSlotPosition(
  seat: Seat,
  index: number,
): Point & { orientation: Orientation } {
  if (index < 0 || index > HAND_SIZE - 1) {
    throw new Error("Invalid slot index");
  }

  let handX = 0,
    handY = 0;
  const orientation = seatOrientation(seat);

  if (seat === "East") {
    handX = (index - 1) * TILE_WIDTH;
    handY = 0;
  }

  if (seat === "South") {
    handX = 0;
    handY = (HAND_SIZE - index) * TILE_WIDTH;
  }

  if (seat === "West") {
    handX = (HAND_SIZE - index) * TILE_WIDTH;
    handY = 0;
  }

  if (seat === "North") {
    handX = 0;
    handY = (index - 1) * TILE_WIDTH;
  }

  return {
    x: handX,
    y: handY,
    orientation: orientation,
  };
}
export function handZoneRect(seat: Seat): Rect {
  return {
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  };
}