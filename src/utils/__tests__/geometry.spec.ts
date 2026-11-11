import { describe, expect, it } from "vitest";
import { rectsIntersect } from "@/utils/geometry.ts";

// Smoke test: proves Vitest runs, TypeScript compiles, and the "@" alias resolves.
describe("rectsIntersect", () => {
  it("treats touching edges as non-overlapping", () => {
    const a = { left: 0, right: 10, top: 0, bottom: 10 };
    const b = { left: 10, right: 20, top: 0, bottom: 10 };

    expect(rectsIntersect(a, b)).toBe(false);
  });
});
