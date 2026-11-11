import {ref} from "vue";

export function useSelection() {
    const selectedIds = ref(new Set<number>())
    const reset = ()=> {
        selectedIds.value = new Set([]);
    }

    function toggle(id: number) {
        if (selectedIds.value.has(id)) {
            selectedIds.value.delete(id)
        } else {
            selectedIds.value.add(id)
        }
    }

    function addId(id: number) {
        selectedIds.value.add(id)
    }

    function isInGroup(id: number): boolean {
        return selectedIds.value.has(id) && selectedIds.value.size > 1 ;
    }

    return {
        selectedIds,
        reset,
        toggle,
        addId,
        isInGroup
    }
}