import type { Point, Rect } from "@/utils/geometry.ts";
import {
  BREAK_GAP,
  CORNER_GAP,
  HAND_MARGIN,
  STACK_OFFSET,
  TILE_HEIGHT,
  TILE_WIDTH,
  WALL_SIZE,
} from "@/constants.ts";
import  { type Break, deadWallStacks } from "@/utils/break.ts";

const SEATS = ["East", "South", "West", "North"] as const;

export type Seat = (typeof SEATS)[number];
export type Orientation = 0 | 90 | 180 | 270;
type Layer = "top" | "bottom";
export type Slot = { seat: Seat; stack: number; layer: Layer };

const TOTAL_TILES = 136;
const WALL_LENGTH = WALL_SIZE * TILE_WIDTH;
const SIDE_TILE_OFFSET = (TILE_HEIGHT - TILE_WIDTH) / 2;
export const TABLE_SIZE = 2 * CORNER_GAP + WALL_LENGTH;
export const MIN_BOARD_HEIGHT = 2 * HAND_MARGIN + TABLE_SIZE;

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

export function slotPosition(
  slot: Slot,
  brk?: Break,
): Point & { orientation: Orientation } {
  const tileOrientation = seatOrientation(slot.seat);

  let slotX = 0,
    slotY = 0;

  if (slot.seat === "East") {
    slotX = CORNER_GAP + (WALL_SIZE - slot.stack) * TILE_WIDTH;
    slotY = TABLE_SIZE - TILE_HEIGHT;
  }

  if (slot.seat === "South") {
    slotX = TABLE_SIZE - TILE_HEIGHT;
    slotY = CORNER_GAP + (slot.stack - 1) * TILE_WIDTH;
  }

  if (slot.seat === "West") {
    slotX = CORNER_GAP + (slot.stack - 1) * TILE_WIDTH;
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
    slotX += SIDE_TILE_OFFSET;
    slotY -= SIDE_TILE_OFFSET;
  }

  if (brk) {
    if (slot.seat === brk.seat && slot.stack > brk.total) {
      if (brk.seat === "East") slotX -= BREAK_GAP
      if (brk.seat === "South") slotY += BREAK_GAP;
      if (brk.seat === "West") slotX += BREAK_GAP;
      if (brk.seat === "North") slotY -= BREAK_GAP;
    }
  }

  slotX += HAND_MARGIN;
  slotY += HAND_MARGIN;

  return {
    x: slotX,
    y: slotY,
    orientation: tileOrientation,
  };
}

export function orientedRect(pos: Point, orientation: Orientation): Rect {
  const isRotated = orientation === 90 || orientation === 270;

  const centre = {
    x: pos.x + TILE_WIDTH / 2,
    y: pos.y + TILE_HEIGHT / 2,
  };

  const footprintWidth = isRotated ? TILE_HEIGHT / 2 : TILE_WIDTH / 2;
  const footprintHeight = isRotated ? TILE_WIDTH / 2 : TILE_HEIGHT / 2;

  return {
    left: centre.x - footprintWidth,
    right: centre.x + footprintWidth,
    top: centre.y - footprintHeight,
    bottom: centre.y + footprintHeight,
  };
}

export function assignTiles(shuffledIds: number[]): Map<number, Slot> {
  if (shuffledIds.length !== TOTAL_TILES) {
    throw new Error(`Length of shuffled IDs must be ${TOTAL_TILES}`);
  }

  const wallSlots = allSlots();

  return new Map(wallSlots.map((slot, index) => [shuffledIds[index]!, slot]));
}

function sameSlot(a: Slot, b: Slot): boolean {
  return a.seat === b.seat && a.stack === b.stack && a.layer === b.layer;
}

export function tileInSlot(assignment: Map<number, Slot>, slot: Slot): number | undefined {
  for (const [id, assignedSlot] of assignment) {
    if (sameSlot(assignedSlot, slot)) {
      return id;
    }
  }
  return undefined;
}