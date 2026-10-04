import { describe, expect, it } from "vitest";
import { EXERCISES, STARTING_LOAD_RATIO, ladderExercises } from "./library.js";

describe("exercise library", () => {
  it("has unique ids", () => {
    const ids = EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every loaded dumbbell exercise has a starting load ratio", () => {
    for (const e of EXERCISES) {
      if (e.loadType === "dumbbell_pair" || e.loadType === "single_dumbbell") {
        expect(STARTING_LOAD_RATIO[e.id], e.id).toBeDefined();
      }
    }
  });

  it("every bodyweight exercise that is not time-based has a bodyweight fraction", () => {
    for (const e of EXERCISES) {
      if (e.loadType === "bodyweight" && e.pattern !== "core") {
        expect(e.bodyweightFraction, e.id).toBeGreaterThan(0);
      }
    }
  });

  it("ladder levels are contiguous from 1", () => {
    const ladders = new Set(EXERCISES.map((e) => e.ladder));
    for (const l of ladders) {
      const levels = ladderExercises(l).map((e) => e.ladderLevel);
      expect(levels, l).toEqual(levels.map((_, i) => i + 1));
    }
  });
});
