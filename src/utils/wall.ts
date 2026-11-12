// import type {Point, Rect} from "@/utils/geometry.ts";

const seats = ["East", "South", "West", "North"] as const;
export type Seat = (typeof seats)[number];
export type Orientation = 0 | 90 | 180 | 270;
type Layer = 'top' | 'bottom';
export type Slot = { seat: Seat; stack: number; layer: Layer};

export function allSlots(): Slot[] {
    let wallSlots: Slot[] = []

    for (const seatWind of seats) {
        for (let i = 1; i <= 34; i++) {
            const stackNumber= i <= 17 ? i : i - 17;
            const stackLayer: Layer = i <= 17 ? 'top': 'bottom';

            wallSlots.push({
                seat: seatWind,
                stack: stackNumber,
                layer: stackLayer,
            })
        }
    }
    return wallSlots;
}

// export function seatOrientation(seat: Seat): Orientation {
//
// }
// export function slotPosition(slot: Slot): Point & { orientation: Orientation } {
//
// }
// export function orientedRect(pos: Point, orientation: Orientation): Rect {
//
// }