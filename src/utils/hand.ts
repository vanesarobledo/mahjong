import  { type Orientation, type Seat, seatOrientation } from "@/utils/wall.ts";
import type { Point, Rect } from "@/utils/geometry.ts";

export function handSlotPosition(
  seat: Seat,
  index: number,
): Point & { orientation: Orientation } {
  if (index < 0 || index > 13) {
    throw new Error("Invalid slot index");
  }


  return {
    x: 0,
    y: 0,
    orientation: seatOrientation(seat),
  }
}
export function handZoneRect(seat: Seat): Rect {
  return {
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  }
}