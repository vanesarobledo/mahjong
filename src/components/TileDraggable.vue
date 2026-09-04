<script setup lang="ts">
import {type Position, useDraggable} from "@vueuse/core";
import {useTemplateRef, watch} from "vue";

const props = defineProps<{
  initialX: number
  initialY: number
  containerRef: HTMLElement | null
}>()

const emit = defineEmits<{
  (e: 'pick'): void,
  (e: 'move', position: Position): void
}>()

const el = useTemplateRef('el')
const { x, y, position, style } = useDraggable(el, {
  initialValue: { x: props.initialX, y: props.initialY },
  containerElement: () => props.containerRef,
  preventDefault: true,
  onStart: () => emit('pick'),
  onMove: (position) => emit('move', position)
})

watch(
    [() => props.initialX, () => props.initialY],
    ([newX, newY]) => {
      if (x.value === newX && y.value === newY) {
        return;
      }
      position.value = { x: newX, y: newY}
    }
)

</script>

<template>
  <div ref="el" :style="style" class="tile-wrapper">
    <slot />
  </div>
</template>=