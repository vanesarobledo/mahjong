import {describe, expect, it} from "vitest";
import {allSlots, type Orientation, type Seat, seatOrientation, slotPosition} from "@/utils/wall.ts";
import type {Position} from "@vueuse/core";

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

describe('slotPosition', () => {
    it.each<{
        seat: Seat,
        axis: 'x' | 'y',
        stack1Is: 'greater' | 'less',
    }>([
        {
            seat: 'East',
            axis: 'x',
            stack1Is: 'greater'
        },
        {
            seat: 'South',
            axis: 'y',
            stack1Is: 'less'
        },
        {
            seat: 'West',
            axis: 'x',
            stack1Is: 'less'
        },
        {
            seat: 'North',
            axis: 'y',
            stack1Is: 'greater'
        },
    ])('returns the stack 1 is $stack1Is than stack 17 for $seat seat', ({seat, axis, stack1Is}) => {
        const slot1 = slotPosition({ seat, stack: 1, layer: 'top' })
        const slot17 = slotPosition({ seat, stack: 17, layer: 'top' })

        const isGreater = stack1Is === 'greater';

        if (isGreater) {
            expect(slot1[axis]).toBeGreaterThan(slot17[axis]);
        }
        else {
            expect(slot1[axis]).toBeLessThan(slot17[axis]);
        }

        if (axis === 'x') {
            expect(slot1['y']).toBe(slot17['y']);
        }
        else {
            expect(slot1['x']).toBe(slot17['x']);
        }

    });
});