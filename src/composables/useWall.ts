import { ref, type Ref, type ShallowRef } from "vue";
import type { Tile } from "@/types.ts";

type Phase = "idle" | "building" | "rolling" | "breaking";
export const useWall = (
  boardRef: Readonly<ShallowRef<HTMLDivElement | null, HTMLDivElement | null>>,
  tiles: Ref<Tile[]>,
  frontMostTile: Ref<number>,
  selection,
) => {
  const diceResult: { die1: number; die2: number } = {
    die1: rollD6(),
    die2: rollD6(),
  };

  const phase: Ref<Phase> = ref("idle");

  function rollD6(): number {
    return Math.floor(Math.random() * 6);
  }

  function buildWall(tiles: Ref<Tile[]>): void {}

  return {
    diceResult,
    phase,
    buildWall,
  };
};
