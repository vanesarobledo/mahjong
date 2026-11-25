import { describe, it } from "vitest";

describe("handSlotPosition", () => {
  it.todo("throws for an index outside 0-13");
  describe.todo("orientation per seat equals seatOrientation(seat)");
  describe.todo("index 0 is at the owner's left");
  describe.todo("adjacent indices are TILE_WIDTH apart along the hand's axis");
  it.todo("index 12 → 13 is TILE_WIDTH + DRAWN_TILE_GAP apart");
  describe.todo("each hand is centred along its table side");
});

describe("handZoneRect", () => {
  describe.todo("no hand footprint intersects any wall footprint");
  describe.todo("every hand footprint lies inside its own handZoneRect and does not intersect each other or table square");
  describe.todo(
    "every hand footprint lies inside MIN_BOARD_WIDTH  × MIN_BOARD_HEIGHT",
  );
});