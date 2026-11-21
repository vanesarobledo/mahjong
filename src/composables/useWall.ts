import {onScopeDispose, ref, type Ref, type ShallowRef} from "vue";
import type {Tile} from "@/types.ts";
import {shuffle} from "@/utils/shuffle.ts";
import {type Break, computeBreak, doraIndicatorSlot} from "@/utils/break.ts";
import {assignTiles, type Seat, type Slot, slotPosition, TABLE_SIZE,} from "@/utils/wall.ts";
import type {useSelection} from "@/composables/useSelection.ts";
import {bringToFront} from "@/utils/tileActions.ts";
import {Tiles} from "@/data/tiles.ts";
import {
  BREAK_MS,
  BUILD_SLIDE_MS,
  BUILD_STAGGER_MS,
  DICE_REVEAL_MS,
  HAND_MARGIN,
} from "@/constants.ts";

export type Phase = "idle" | "building" | "rolling" | "breaking";

export const useWall = (
  boardRef: Readonly<ShallowRef<HTMLDivElement | null, HTMLDivElement | null>>,
  tiles: Ref<Tile[]>,
  frontMostTile: Ref<number>,
  selection: ReturnType<typeof useSelection>,
) => {
  const diceResult: Ref<{
    die1: number;
    die2: number;
    total: number;
    wall: Seat | "";
  }> = ref({
    die1: 0,
    die2: 0,
    total: 0,
    wall: "",
  });
  const phase: Ref<Phase> = ref("idle");
  const pendingTimers = new Set<ReturnType<typeof setTimeout>>();
  const brk: Ref<Break | null> = ref(null);

  function getBoardXOffset(): number {
    const boardWidth = boardRef.value ? boardRef.value.clientWidth : 1010;
    const tableOriginX = (boardWidth - TABLE_SIZE) / 2 - HAND_MARGIN;
    return Math.max(0, tableOriginX);
  }

  onScopeDispose(() => {
    pendingTimers.forEach((id) => {
      clearTimeout(id);
    });
  });

  function wait(ms: number): Promise<void> {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const id = setTimeout(() => {
        pendingTimers.delete(id);
        resolve();
      }, ms);

      pendingTimers.add(id);
    });
  }

  function rollD6(): number {
    return Math.ceil(Math.random() * 6);
  }

  function assignDiceResult(die1: number, die2: number) {
    if (!brk.value) {
      return;
    }

    diceResult.value.die1 = die1;
    diceResult.value.die2 = die2;
    diceResult.value.total = diceResult.value.die1 + diceResult.value.die2;
    diceResult.value.wall = brk.value.seat;
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

  function shuffleTilesToSlots() {
    shuffle(tiles.value);
    const slots = assignTiles(tiles.value.map((t) => t.id));
    selection.reset();
    return slots;
  }

  function breakWall(slots: Map<number, Slot>, xOffset: number) {
    if (!brk.value) {
      return;
    }

    phase.value = "breaking";
    placeTiles(slots, xOffset, brk.value);
  }

  async function buildWall() {
    if (phase.value !== "idle") {
      return;
    }

    // Beat 1: Build
    phase.value = "building";
    diceResult.value = {
      die1: 0,
      die2: 0,
      total: 0,
      wall: "",
    };
    const slots = shuffleTilesToSlots();
    const xOffset = getBoardXOffset();
    resetTiles(slots);
    placeTiles(slots, xOffset);

    await wait(BUILD_SLIDE_MS + (Tiles.length - 1) * BUILD_STAGGER_MS);

    // Beat 2: Roll the dice
    phase.value = "rolling";

    const die1 = rollD6();
    const die2 = rollD6();

    brk.value = computeBreak(die1, die2);

    assignDiceResult(die1, die2);

    await wait(DICE_REVEAL_MS);

    // Beat 3: Break
    breakWall(slots, xOffset);

    await wait(BREAK_MS);

    // Dora flip
    const doraSlot = doraIndicatorSlot(brk.value);
    for (const [i, slot] of slots.entries()) {
      if (slot.seat === doraSlot.seat && slot.stack == doraSlot.stack && slot.layer === "top") {
        tiles.value.find((t) =>  {
          if (i === t.id) {
            t.isFaceUp = true;
            t.rotationY = 0;
          }
        });

        break;
      }
    }

    phase.value = "idle";
  }


  return {
    diceResult,
    phase,
    buildWall,
  };
};
