// import type {Point, Rect} from "@/utils/geometry.ts";

import type {Point} from "@/utils/geometry.ts";
import {TILE_HEIGHT, TILE_WIDTH} from "@/constants.ts";

const SEATS = ["East", "South", "West", "North"] as const;

export type Seat = (typeof SEATS)[number];
export type Orientation = 0 | 90 | 180 | 270;
type Layer = 'top' | 'bottom';
export type Slot = { seat: Seat; stack: number; layer: Layer };

const WALL_SIZE = 17;

export function allSlots(): Slot[] {
    let wallSlots: Slot[] = []

    for (const seatWind of SEATS) {
        for (let i = 1; i <= (WALL_SIZE * 2); i++) {
            const isTop = i <= WALL_SIZE;
            const stackNumber = isTop ? i : i - WALL_SIZE;
            const stackLayer: Layer = isTop ? 'top' : 'bottom';

            wallSlots.push({
                seat: seatWind,
                stack: stackNumber,
                layer: stackLayer,
            })
        }
    }
    return wallSlots;
}

export function seatOrientation(seat: Seat): Orientation {
    switch (seat) {
        case 'East':
            return 0;
        case 'South':
            return 270;
        case 'West':
            return 180;
        case 'North':
            return 90;
        default:
            throw new Error('Invalid seat orientation');
    }
}

export function slotPosition(slot: Slot): Point & { orientation: Orientation } {
    const tileOrientation = seatOrientation(slot.seat);
    let slotX = TILE_WIDTH;
    let slotY = TILE_HEIGHT;

    if (slot.seat === 'East') {
        slotX = ((WALL_SIZE + 1) - slot.stack) * TILE_WIDTH;
    }

    if (slot.seat === 'South') {
        slotX = TILE_HEIGHT;
        slotY = slot.stack * TILE_WIDTH
    }

    if (slot.seat === 'West') {
        slotX = slot.stack * TILE_WIDTH;
    }

    if (slot.seat === 'North') {
        slotX = TILE_HEIGHT;
        slotY = ((WALL_SIZE + 1) - slot.stack) * TILE_WIDTH
    }

    return {
        x: slotX,
        y: slotY,
        orientation: tileOrientation
    }
}

// export function orientedRect(pos: Point, orientation: Orientation): Rect {
//
// }