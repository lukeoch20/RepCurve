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

  it("tells one-sided exercises how sides work, and only those", () => {
    for (const e of EXERCISES) {
      const steps = getHowTo(e.id)!.steps.join(" ");
      // Most do one side then the other; the renegade row alternates arms within the set.
      expect(/switch sides|alternate arms/i.test(steps), e.id).toBe(e.unilateral);
    }
  });

  it("only treats a bench as optional when the exercise doesn't require one", () => {
    for (const e of EXERCISES) {
      const needsBench = e.requires.every((set) => set.includes("bench") || set.includes("flat_bench"));
      if (needsBench) continue;
      const h = getHowTo(e.id)!;
      for (const line of [h.setup, ...h.steps]) {
        if (/\bbench\b/i.test(line)) expect(/\bor\b/.test(line), `${e.id}: ${line}`).toBe(true);
      }
    }
  });

  it("never requires a mat for exercises that don't need one", () => {
    for (const e of EXERCISES) {
      if (e.requires.some((set) => set.includes("mat"))) continue;
      const h = getHowTo(e.id)!;
      for (const line of [h.setup, ...h.steps]) {
        if (/\bon a mat\b/i.test(line)) expect(/mat, rug|mat or/i.test(line), `${e.id}: ${line}`).toBe(true);
      }
    }
  });

  it("tells you to hold something only when a hand is free", () => {
    for (const e of EXERCISES.filter((x) => x.loadType === "dumbbell_pair")) {
      const h = getHowTo(e.id)!;
      for (const line of [...h.cues, ...h.mistakes]) expect(/hold (something|a wall|onto)/i.test(line), `${e.id}: ${line}`).toBe(false);
    }
  });
});
