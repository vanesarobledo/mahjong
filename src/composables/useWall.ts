import { ref, type Ref, type ShallowRef } from "vue";
import type { Tile } from "@/types.ts";
import { shuffle } from "@/utils/shuffle.ts";
import { computeBreak } from "@/utils/break.ts";
import { assignTiles, slotPosition } from "@/utils/wall.ts";
import type { useSelection } from "@/composables/useSelection.ts";

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
    diceResult.value.die1 = die1;
    diceResult.value.die2 = die2;
  }

  function buildWall(): void {
    // 1. Shuffle all of the tiles and assign them to slots, reset selection
    shuffle(tiles.value);
    const slots = assignTiles(tiles.value.map((t) => t.id));
    selection.reset();

    // 2. Roll dice and set result
    rollDice(rollD6(), rollD6());

    // 3. Slide tiles into closed 4-wall-square, flip down
    tiles.value.forEach((tile) => {
      const slot = slots.get(tile.id);
      if (!slot) throw new Error("Need all 136 tiles");

      const position = slotPosition(slot);

      tile.rotationY = 180;
      tile.orientation = position.orientation;
      tile.x = position.x;
      tile.y = position.y;
    });

    // Update z-index of each tile so that all top stack tiles are above the bottom stack

    // 4. Break the wall
    const brk = computeBreak(diceResult.value.die1, diceResult.value.die2);

    // Slide the break gap
    // Like step 3

    // 5. Flip the dora indicator
  }

  return {
    diceResult,
    phase,
    buildWall,
  };
};
