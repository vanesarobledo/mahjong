import type { Orientation, Seat } from "@/utils/wall.ts";
import type { Point, Rect } from "@/utils/geometry.ts";

export function handSlotPosition(
  seat: Seat,
  index: number,
): Point & { orientation: Orientation } {
  return {
    x: 0,
    y: 0,
    orientation: 0,
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