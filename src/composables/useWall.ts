import { ref, type Ref, type ShallowRef } from "vue";
import type { Tile } from "@/types.ts";
import { shuffle } from "@/utils/shuffle.ts";
import { type Break, computeBreak } from "@/utils/break.ts";
import {
  assignTiles,
  type Slot,
  slotPosition,
  TABLE_SIZE,
} from "@/utils/wall.ts";
import type { useSelection } from "@/composables/useSelection.ts";
import { bringToFront } from "@/utils/tileActions.ts";
import { Tiles } from "@/data/tiles.ts";
import { HAND_MARGIN } from "@/constants.ts";

export type Phase = "idle" | "building" | "rolling" | "breaking";

export const useWall = (
  boardRef: Readonly<ShallowRef<HTMLDivElement | null, HTMLDivElement | null>>,
  tiles: Ref<Tile[]>,
  frontMostTile: Ref<number>,
  selection: ReturnType<typeof useSelection>,
) => {
  const diceResult: Ref<{ die1: number; die2: number, total: number }> = ref({
    die1: 0,
    die2: 0,
    total: 0,
  });
  const phase: Ref<Phase> = ref("idle");

  const boardWidth = boardRef.value ? boardRef.value.clientWidth : 1010;

  function getBoardXOffset(): number {
    const tableOriginX =  (boardWidth - TABLE_SIZE) / 2 - HAND_MARGIN;
    return Math.max(0, tableOriginX);
  }

  function rollD6(): number {
    return Math.ceil(Math.random() * 6);
  }

  function rollDice(die1: number, die2: number): void {
    phase.value = "rolling";
    diceResult.value.die1 = die1;
    diceResult.value.die2 = die2;
    diceResult.value.total = die1 + die2;
  }

  function resetTiles(slots: Map<number, Slot>) {
    frontMostTile.value = Tiles.length;

    tiles.value.forEach((tile) => {
      const slot = slots.get(tile.id);
      if (!slot) throw new Error("Need all 136 tiles");

      tile.isFaceUp = false;
      tile.rotationY = 180;
      tile.rotationZ = 0;
      tile.zIndex = 0;

      if (slot.layer === "top") {
        bringToFront(tile, frontMostTile);
      }
    });
  }

  function placeTiles(slots: Map<number, Slot>, xOffset: number, brk?: Break) {
    tiles.value.forEach((tile) => {
      const slot = slots.get(tile.id);
      if (!slot) throw new Error("Need all 136 tiles");

      const position = slotPosition(slot, brk);

      tile.orientation = position.orientation;
      tile.x = position.x + xOffset;
      tile.y = position.y;
    });
  }

  function breakWall(slots: Map<number, Slot>, xOffset: number) {
    phase.value = "breaking";
    const brk = computeBreak(diceResult.value.die1, diceResult.value.die2);
    placeTiles(slots, xOffset, brk);
  }

  function shuffleTilesToSlots() {
    shuffle(tiles.value);
    const slots = assignTiles(tiles.value.map((t) => t.id));
    selection.reset();
    return slots;
  }

  function buildWall(): void {
    phase.value = "building";

    // 1. Shuffle all of the tiles and assign them to slots, reset selection
    const slots = shuffleTilesToSlots();

    // 2. Roll dice and set result
    rollDice(rollD6(), rollD6());

    // 3. Slide tiles into closed 4-wall-square, flip down
    const xOffset = getBoardXOffset();
    resetTiles(slots);
    placeTiles(slots, xOffset);

    // 4. Break the wall and slide it
    breakWall(slots, xOffset);

    // 5. Flip the dora indicator

    phase.value = "idle";
  }

  return {
    diceResult,
    phase,
    buildWall,
  };
};
