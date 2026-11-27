import {
  type Orientation,
  type Seat,
  seatOrientation,
  SIDE_TILE_OFFSET,
  TABLE_SIZE,
} from "@/utils/wall.ts";
import type { Point, Rect } from "@/utils/geometry.ts";
import { DRAWN_TILE_GAP, TILE_WIDTH } from "@/constants.ts";

export const HAND_SIZE = 14;
export const HAND_LENGTH = HAND_SIZE * TILE_WIDTH + DRAWN_TILE_GAP;
const HAND_INSET = (TABLE_SIZE - HAND_LENGTH) / 2;

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
    handX = index * TILE_WIDTH;
    handY = 0;
  }

  if (seat === "South") {
    handX = 0;
    handY = (HAND_SIZE - index) * TILE_WIDTH - DRAWN_TILE_GAP - SIDE_TILE_OFFSET;
  }

  if (seat === "West") {
    handX = (HAND_SIZE - index) * TILE_WIDTH - DRAWN_TILE_GAP;
    handY = 0;
  }

  if (seat === "North") {
    handX = 0;
    handY = index * TILE_WIDTH - SIDE_TILE_OFFSET;
  }

  if (seat === "East") handX += HAND_INSET;
  if (seat === "West") handX += HAND_INSET;
  if (seat === "South") handY += HAND_INSET;
  if (seat === "North") handY += HAND_INSET;


  if (index === 13) {
    if (seat === "South") handY -= DRAWN_TILE_GAP;
    if (seat === "North") handY += DRAWN_TILE_GAP;
    if (seat === "West") handX -= DRAWN_TILE_GAP;
    if (seat === "East") handX += DRAWN_TILE_GAP;
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