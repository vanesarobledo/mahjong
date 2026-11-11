import {ref, type Ref} from "vue";
import type {Point} from "@/utils/geometry.ts";

export function useGroupDrag() {
    const dragStartPos: Ref<Point | null> = ref(null)
    const activeDragId: Ref<number | null> = ref(null)
    const groupDragOrigin: Ref<Map<number, Point>> = ref(new Map<number, Point>)

    return {
        dragStartPos,
        activeDragId,
        groupDragOrigin
    }
}