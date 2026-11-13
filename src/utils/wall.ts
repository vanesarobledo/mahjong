// import type {Point, Rect} from "@/utils/geometry.ts";

import type {Point} from "@/utils/geometry.ts";
import {TILE_HEIGHT, TILE_WIDTH} from "@/constants.ts";

const seats = ["East", "South", "West", "North"] as const;
export type Seat = (typeof seats)[number];
export type Orientation = 0 | 90 | 180 | 270;
type Layer = 'top' | 'bottom';
export type Slot = { seat: Seat; stack: number; layer: Layer};

const WALL_SIZE = 17;

export function allSlots(): Slot[] {
    let wallSlots: Slot[] = []

    for (const seatWind of seats) {
        for (let i = 1; i <= (WALL_SIZE * 2); i++) {
            const isTop = i <= WALL_SIZE;
            const stackNumber= isTop ? i : i - WALL_SIZE;
            const stackLayer: Layer = isTop ? 'top': 'bottom';

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
    switch(seat) {
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

    if (slot.seat === 'East') {
        return {
            x: ((WALL_SIZE + 1) - slot.stack) * TILE_WIDTH,
            y: TILE_HEIGHT,
            orientation: tileOrientation
        }
    }

    if (slot.seat === 'South') {
        return {
            x: TILE_HEIGHT,
            y: slot.stack * TILE_WIDTH,
            orientation: tileOrientation
        }
    }

    if (slot.seat === 'West') {
        return {
            x: slot.stack * TILE_WIDTH,
            y: TILE_HEIGHT,
            orientation: tileOrientation
        }
    }

    if (slot.seat === 'North') {
        return {
            x: TILE_HEIGHT,
            y: ((WALL_SIZE + 1) - slot.stack)  * TILE_WIDTH,
            orientation: tileOrientation
        }
    }

    return {
        x: 0,
        y: 0,
        orientation: 0
    }
}

// export function orientedRect(pos: Point, orientation: Orientation): Rect {
//
// }