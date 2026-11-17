// import type {Point, Rect} from "@/utils/geometry.ts";

import type { Point, Rect } from "@/utils/geometry.ts";
import {
  CORNER_GAP,
  STACK_OFFSET,
  TILE_HEIGHT,
  TILE_WIDTH,
  WALL_SIZE,
} from "@/constants.ts";

const SEATS = ["East", "South", "West", "North"] as const;

export type Seat = (typeof SEATS)[number];
export type Orientation = 0 | 90 | 180 | 270;
type Layer = "top" | "bottom";
export type Slot = { seat: Seat; stack: number; layer: Layer };

export function allSlots(): Slot[] {
  let wallSlots: Slot[] = [];

  for (const seatWind of SEATS) {
    for (let i = 1; i <= WALL_SIZE * 2; i++) {
      const isTop = i <= WALL_SIZE;
      const stackNumber = isTop ? i : i - WALL_SIZE;
      const stackLayer: Layer = isTop ? "top" : "bottom";

      wallSlots.push({
        seat: seatWind,
        stack: stackNumber,
        layer: stackLayer,
      });
    }
  }
  return wallSlots;
}

export function seatOrientation(seat: Seat): Orientation {
  switch (seat) {
    case "East":
      return 0;
    case "South":
      return 270;
    case "West":
      return 180;
    case "North":
      return 90;
    default:
      throw new Error("Invalid seat orientation");
  }
}


// TODO: Adjust x/y based on offset when rotated for South & North
export function slotPosition(slot: Slot): Point & { orientation: Orientation } {
  const WALL_LENGTH = WALL_SIZE * TILE_WIDTH;
  const SIDE_TILE_OFFSET = (TILE_HEIGHT - TILE_WIDTH) / 2;
  const tileOrientation = seatOrientation(slot.seat);

  let slotX = 0,
    slotY = 0;

  if (slot.seat === "East") {
    slotX = ((WALL_SIZE - slot.stack) * TILE_WIDTH) + CORNER_GAP;
    slotY = (2 * CORNER_GAP) + WALL_LENGTH - TILE_HEIGHT;
  }

  if (slot.seat === "South") {
    slotX = (2 * CORNER_GAP) + WALL_LENGTH - TILE_HEIGHT;
    slotY = CORNER_GAP + (slot.stack * TILE_WIDTH);
  }

  if (slot.seat === "West") {
    slotX = CORNER_GAP + (slot.stack * TILE_WIDTH);
    slotY = 0;
  }

  if (slot.seat === "North") {
    slotX = 0;
    slotY = CORNER_GAP + (WALL_SIZE - slot.stack) * TILE_WIDTH;
  }

  if (slot.layer === "bottom") {
    slotY += STACK_OFFSET;
  }

  if (slot.seat === "South" || slot.seat === "North") {
    slotX += SIDE_TILE_OFFSET
    slotY -= SIDE_TILE_OFFSET;
  }

  return {
    x: slotX,
    y: slotY,
    orientation: tileOrientation,
  };
}

export function orientedRect(pos: Point, orientation: Orientation): Rect {
  return {
    top: 0,
    left: 0,
    bottom: 0,
    right: 0
  }
}
