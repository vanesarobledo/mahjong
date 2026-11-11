import {computed, ref, type Ref, type ShallowRef} from "vue";
import {hasMoved, type Point, rectsIntersect, tileToRect} from "@/utils/geometry.ts";
import type {Tile} from "@/types.ts";
import {useEventListener} from "@vueuse/core";
import {DRAG_THRESHOLD} from "@/constants.ts";

export function useMarquee(
    boardRef: ShallowRef<HTMLDivElement | null>,
    tiles: Ref<Array<Tile>>,
    selectedIds: Ref<Set<number>>,
    resetSelection: () => void
) {
    const marquee: Ref<{
        current: Point,
        start: Point,
        additive: boolean
    } | null> = ref(null)

    const rect = computed(() => {
        if (marquee.value === null) {
            return {
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
            }
        }

        return {
            left: Math.min(marquee.value.start.x, marquee.value.current.x),
            right: Math.max(marquee.value.start.x, marquee.value.current.x),
            top: Math.min(marquee.value.start.y, marquee.value.current.y),
            bottom: Math.max(marquee.value.start.y, marquee.value.current.y),
        }
    });

    function clientToBoard(e: MouseEvent): Point {
        if (boardRef.value) {
            const boundingClientRect = boardRef.value.getBoundingClientRect();

            return {
                x: e.clientX - boundingClientRect.left,
                y: e.clientY - boundingClientRect.top
            }
        }

        throw new Error('We need a board in here, mount the board')
    }

    function handleMouseDown(event: MouseEvent) {
        // Guard only if mousedown is on an empty board and not a tile
        // Prevents tile-drag from being misread as marquee-start
        if (event.target !== boardRef.value) {
            return
        }

        event.preventDefault()

        const point = clientToBoard(event)
        marquee.value = {
            start: point,
            current: point,
            additive: event.shiftKey,
        }
    }

    useEventListener(window, 'mousemove', (event) => {
        if (marquee.value === null) {
            return
        }

        marquee.value.current = clientToBoard(event)
    })

    useEventListener(window, 'mouseup', () => {
        if (marquee.value === null) {
            return
        }

        if (!marquee.value.additive) {
            resetSelection()
        }

        if (!hasMoved(marquee.value.start, marquee.value.current, DRAG_THRESHOLD)) {
            marquee.value = null;
            return
        }

        tiles.value.forEach((tile) => {
            if (rectsIntersect(tileToRect(tile), rect.value)) {
                selectedIds.value.add(tile.id)
            }
        })

        marquee.value = null
    })
    return {
        marquee, rect, handleMouseDown
    }
}
