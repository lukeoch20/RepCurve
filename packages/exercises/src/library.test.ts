import { describe, expect, it } from "vitest";
import { CATALOG, SOURCES } from "./catalog.js";
import { EXERCISES, STARTING_LOAD_RATIO, findExercise, ladderExercises } from "./library.js";

describe("exercise library", () => {
  it("has unique ids", () => {
    const ids = EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has every record of the evidence review's catalog: 106, one of them retired", () => {
    expect(EXERCISES).toHaveLength(CATALOG.length);
    expect(EXERCISES).toHaveLength(106);
    expect(EXERCISES.filter((e) => e.tier === "retired").map((e) => e.id)).toEqual(["towel_door_row"]);
    expect(EXERCISES.filter((e) => e.tier === "default")).toHaveLength(CATALOG.filter((c) => c.defaultPool).length);
  });

  it("keeps the ids logs were saved under", () => {
    for (const id of ["goblet_squat", "db_rdl", "one_arm_db_row", "bw_split_squat", "kneeling_ab_rollout", "elevated_pike_push_up", "towel_door_row"]) {
      expect(findExercise(id), id).toBeDefined();
    }
  });

  it("every loaded exercise has a starting load ratio", () => {
    const loaded = ["dumbbell_pair", "single_dumbbell", "barbell", "machine", "cable"];
    for (const e of EXERCISES) {
      if (loaded.includes(e.loadType)) expect(STARTING_LOAD_RATIO[e.id], e.id).toBeDefined();
    }
  });

  it("every bodyweight exercise that is not time-based has a bodyweight fraction", () => {
    for (const e of EXERCISES) {
      if (e.loadType === "bodyweight" && e.pattern !== "core") {
        expect(e.bodyweightFraction, e.id).toBeGreaterThan(0);
      }
    }
  });

  it("barbell exercises know the weight of the empty bar", () => {
    for (const e of EXERCISES.filter((x) => x.loadType === "barbell")) expect(e.barKg, e.id).toBeGreaterThan(0);
  });

  it("only puts exercises on one ladder when one really leads to the next, never across tiers", () => {
    const ladders = new Set(EXERCISES.map((e) => e.ladder));
    for (const l of ladders) {
      const on = ladderExercises(l);
      expect(new Set(on.map((e) => e.pattern)).size, l).toBe(1);
      expect(new Set(on.map((e) => e.family)).size, l).toBe(1);
      // The planner only moves you along a ladder between exercises it may pick for you.
      if (on.length > 1 && on.some((e) => e.tier === "default")) {
        expect(on.every((e) => e.tier === "default"), l).toBe(true);
      }
    }
  });

  it("names its sources: every evidence reference is in the source list", () => {
    const ids = new Set(SOURCES.map((s) => s.id));
    for (const e of EXERCISES) {
      for (const r of [...e.evidence!.direct, ...e.evidence!.context]) expect(ids.has(r), `${e.id}: ${r}`).toBe(true);
    }
  });

  it("counts stabilisers out of weekly volume", () => {
    const rdl = findExercise("db_rdl")!;
    expect(rdl.primary).toEqual(["hamstrings", "glutes"]);
    expect(rdl.secondary).toEqual([]);
    expect(rdl.targets.stabilizers).toContain("spinal_erectors");
  });
});
