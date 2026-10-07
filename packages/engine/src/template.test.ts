import type { Equipment } from "@repcurve/shared";
import { describe, expect, it } from "vitest";
import { weeklyTemplate } from "./template.js";

const withTreadmill: Equipment = { dumbbells: { kind: "none" }, treadmill: true, mat: true, abRoller: false, pullupBar: false, bench: false, bands: [] };
const noTreadmill: Equipment = { ...withTreadmill, treadmill: false };

describe("weekly template", () => {
  it("spreads cardio between strength days", () => {
    expect(weeklyTemplate(4, "both", withTreadmill)).toEqual(["strength", "strength", "cardio", "strength"]);
    expect(weeklyTemplate(5, "both", withTreadmill)).toEqual(["strength", "cardio", "strength", "cardio", "strength"]);
    expect(weeklyTemplate(6, "fitness", withTreadmill)).toEqual(["strength", "cardio", "strength", "cardio", "strength", "cardio"]);
  });

  it("turns cardio into strength without a treadmill only for a strength-first goal", () => {
    expect(weeklyTemplate(4, "strength_muscle", noTreadmill)).toEqual(["strength", "strength", "strength", "strength"]);
    expect(weeklyTemplate(6, "strength_muscle", noTreadmill).filter((k) => k === "strength")).toHaveLength(4);
  });

  it("keeps outdoor cardio for cardio-led goals without a treadmill (RC-12)", () => {
    expect(weeklyTemplate(3, "both", noTreadmill)).toEqual(weeklyTemplate(3, "both", withTreadmill));
    for (const d of [2, 3, 4]) expect(weeklyTemplate(d, "fitness", noTreadmill).filter((k) => k === "cardio").length, `${d}`).toBeGreaterThan(0);
  });

  it("always returns exactly days entries", () => {
    for (let d = 1; d <= 6; d++) {
      for (const g of ["strength_muscle", "both", "fitness"] as const) {
        expect(weeklyTemplate(d, g, withTreadmill)).toHaveLength(d);
      }
    }
  });
});
