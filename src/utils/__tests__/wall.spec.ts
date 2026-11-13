import {describe, expect, it} from "vitest";
import {allSlots, type Orientation, type Seat, seatOrientation} from "@/utils/wall.ts";

describe('allSlots', () => {
    it('returns all 136 slots, all unique', () => {
        const wall = allSlots();
        expect(wall.length).toBe(136);
        expect(new Set(wall).size !== wall.length).toBe(false);
    });

    it.each([
        'East',
        'South',
        'West',
        'North'
    ])('returns 2 stacks of 17 layers in each seat', (seat: string) => {
        const wall = allSlots();
        const stackRange = Array.from(
            {length: 17},
            (_, i) => 1 + i
        );
        const seatWall = wall.filter((slot) => {
            if (slot.seat === seat) return slot;
        });
        const topStack = seatWall.filter((slot) => {
            if (slot.layer === 'top') return slot;
        });
        const bottomStack = seatWall.filter((slot) => {
            if (slot.layer === 'bottom') return slot;
        });

        const stackNumbers = seatWall.map(s => s.stack).sort();

        expect(seatWall.length).toBe(34);
        expect(topStack.length).toBe(17);
        expect(bottomStack.length).toBe(17);
        expect(new Set(stackNumbers).size === stackRange.length).toBe(true);
        expect(Math.min(...stackNumbers)).toBe(1);
        expect(Math.max(...stackNumbers)).toBe(17);
    });
});

// TODO: Ensure these are the right orientations
describe('seatOrientation', () => {
    it.each<{
        seat: Seat;
        expected: Orientation
    }>([
        {
            seat: 'East',
            expected: 0
        },
        {
            seat: 'South',
            expected: 270
        },
        {
            seat: 'West',
            expected: 180
        },
        {
            seat: 'North',
            expected: 90
        },
    ])('returns orientation $orientation for the $expected seat', ({seat, expected}) => {
        const sOrientation = seatOrientation(seat);

        expect(sOrientation).toBe(expected);
    });
});