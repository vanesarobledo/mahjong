import { ref, type Ref, type ShallowRef } from "vue";
import type { Tile } from "@/types.ts";
import { shuffle } from "@/utils/shuffle.ts";
import { type Break, computeBreak } from "@/utils/break.ts";
import { assignTiles, type Slot, slotPosition } from "@/utils/wall.ts";
import type { useSelection } from "@/composables/useSelection.ts";
import { bringToFront } from "@/utils/tileActions.ts";

export type Phase = "idle" | "building" | "rolling" | "breaking";
export const useWall = (
  boardRef: Readonly<ShallowRef<HTMLDivElement | null, HTMLDivElement | null>>,
  tiles: Ref<Tile[]>,
  frontMostTile: Ref<number>,
  selection: ReturnType<typeof useSelection>,
) => {
  const diceResult: Ref<{ die1: number; die2: number }> = ref({
    die1: 0,
    die2: 0,
  });
  const phase: Ref<Phase> = ref("idle");
  function rollD6(): number {
    return Math.ceil(Math.random() * 6);
  }

  function rollDice(die1: number, die2: number): void {
    phase.value = "rolling";
    diceResult.value.die1 = die1;
    diceResult.value.die2 = die2;
  }

  function resetTiles(slots: Map<number, Slot>) {
    tiles.value.forEach((tile) => {
      const slot = slots.get(tile.id);
      if (!slot) throw new Error("Need all 136 tiles");

      tile.rotationY = 180;
      tile.rotationZ = 0;

      if (slot.layer === "top") bringToFront(tile, frontMostTile);
    });
  }

  function placeTiles(slots: Map<number, Slot>, brk?: Break) {
    tiles.value.forEach((tile) => {
      const slot = slots.get(tile.id);
      if (!slot) throw new Error("Need all 136 tiles");

      const position = slotPosition(slot, brk);

      tile.orientation = position.orientation;
      tile.x = position.x;
      tile.y = position.y;
    });
  }

  function breakWall(slots: Map<number, Slot>) {
    phase.value = "breaking";
    const brk = computeBreak(diceResult.value.die1, diceResult.value.die2);
    placeTiles(slots, brk);
  }

  function shuffleTilesToSlots() {
    shuffle(tiles.value);
    const slots = assignTiles(tiles.value.map((t) => t.id));
    selection.reset();
    return slots;
  }

  function buildWall(): void {
    // 1. Shuffle all of the tiles and assign them to slots, reset selection
    const slots = shuffleTilesToSlots();

    // 2. Roll dice and set result
    rollDice(rollD6(), rollD6());

    // 3. Slide tiles into closed 4-wall-square, flip down
    resetTiles(slots);
    placeTiles(slots);

    // 4. Break the wall
    breakWall(slots);

    // 5. Flip the dora indicator
  }

  return {
    diceResult,
    phase,
    buildWall,
  };
};
