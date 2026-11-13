// import type {Point, Rect} from "@/utils/geometry.ts";

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

// export function slotPosition(slot: Slot): Point & { orientation: Orientation } {
//
// }
// export function orientedRect(pos: Point, orientation: Orientation): Rect {
//
// }