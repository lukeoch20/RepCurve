import { describe, expect, it } from "vitest";
import { HOW_TO, getHowTo } from "./howto.js";
import { EXERCISES } from "./library.js";

describe("how-to guides", () => {
  it("covers every exercise in the library", () => {
    const missing = EXERCISES.filter((e) => !getHowTo(e.id)).map((e) => e.id);
    expect(missing).toEqual([]);
  });

  it("has no guides for exercises that don't exist", () => {
    const ids = new Set(EXERCISES.map((e) => e.id));
    expect(Object.keys(HOW_TO).filter((id) => !ids.has(id))).toEqual([]);
  });

  it("gives every guide a setup, at least three steps, and cues and mistakes", () => {
    for (const e of EXERCISES) {
      const h = getHowTo(e.id)!;
      expect(h.setup.length, e.id).toBeGreaterThan(20);
      expect(h.steps.length, e.id).toBeGreaterThanOrEqual(3);
      expect(h.cues.length, e.id).toBeGreaterThanOrEqual(2);
      expect(h.mistakes.length, e.id).toBeGreaterThanOrEqual(2);
      for (const line of [h.setup, ...h.steps, ...h.cues, ...h.mistakes]) expect(line.trim(), e.id).toBe(line);
    }
  });

  it("tells one-sided exercises to switch sides, and only those", () => {
    for (const e of EXERCISES) {
      const switches = getHowTo(e.id)!.steps.some((s) => /switch sides/i.test(s));
      // The renegade row alternates arms within the set, which is still one side then the other.
      expect(switches, e.id).toBe(e.unilateral);
    }
  });
});
