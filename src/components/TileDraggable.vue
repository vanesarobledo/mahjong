<script setup lang="ts">
import {type Position, useDraggable} from "@vueuse/core";
import {useTemplateRef, watch} from "vue";

const props = defineProps<{
  initialX: number
  initialY: number
  containerRef: HTMLElement | null
}>()

const emit = defineEmits<{
  (e: 'pick', position: Position): void,
  (e: 'move', position: Position): void,
  (e: 'end', event: MouseEvent): void
}>()

const el = useTemplateRef('el')
const { x, y, position, style } = useDraggable(el, {
  initialValue: { x: props.initialX, y: props.initialY },
  containerElement: () => props.containerRef,
  preventDefault: true,
  onStart: (position) => emit('pick', position),
  onMove: (position) => emit('move', position),
  onEnd: (position, event) => emit('end', event)
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
</template>