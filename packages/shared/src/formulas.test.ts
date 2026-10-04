import { describe, expect, it } from "vitest";
import { e1RM, epley1RM, loadForReps, repsAtLoad } from "./formulas.js";
import { availableDumbbellLoadsKg, displayLoad, formatLoad, roundDownToOwned, nextOwnedLoad, prevOwnedLoad } from "./loads.js";
import { lbToKg } from "./formulas.js";

describe("formulas", () => {
  it("Epley matches the textbook value", () => {
    expect(epley1RM(100, 10)).toBeCloseTo(133.33, 1);
    expect(epley1RM(100, 1)).toBe(100);
  });

  it("e1RM credits reps in reserve", () => {
    expect(e1RM(20, 8, 2)).toBeCloseTo(epley1RM(20, 10));
  });

  it("loadForReps inverts repsAtLoad", () => {
    const e = 60;
    const load = loadForReps(e, 10, 2);
    expect(repsAtLoad(e, load)).toBe(12);
  });
});

describe("loads", () => {
  const owned = availableDumbbellLoadsKg({ kind: "fixed", weights: [10, 15, 20, 25], unit: "lb", pairs: true });

  it("converts and sorts owned loads", () => {
    expect(owned).toHaveLength(4);
    expect(owned[0]).toBeCloseTo(lbToKg(10));
  });

  it("rounds down to an owned dumbbell, never up", () => {
    expect(roundDownToOwned(lbToKg(17), owned)).toBeCloseTo(lbToKg(15));
    expect(roundDownToOwned(lbToKg(5), owned)).toBeCloseTo(lbToKg(10));
  });

  it("steps up and down the owned set", () => {
    expect(nextOwnedLoad(lbToKg(15), owned)).toBeCloseTo(lbToKg(20));
    expect(nextOwnedLoad(lbToKg(25), owned)).toBeNull();
    expect(prevOwnedLoad(lbToKg(15), owned)).toBeCloseTo(lbToKg(10));
    expect(prevOwnedLoad(lbToKg(10), owned)).toBeNull();
  });

  it("formats owned weights back to the numbers the user typed", () => {
    const adj = availableDumbbellLoadsKg({ kind: "adjustable", min: 5, max: 52.5, step: 2.5, unit: "lb", pairs: true });
    expect(adj.map((w) => displayLoad(w, "lb"))).toContain(22.5);
    expect(formatLoad(lbToKg(22.5), "dumbbell_pair", "lb")).toBe("22.5 lb each");
    expect(formatLoad(7.5, "single_dumbbell", "kg")).toBe("7.5 kg");
    expect(formatLoad(null, "band", "kg")).toBe("band");
    expect(formatLoad(null, "bodyweight", "kg")).toBe("bodyweight");
  });

  it("adjustable sets expand into steps", () => {
    const adj = availableDumbbellLoadsKg({ kind: "adjustable", min: 5, max: 20, step: 5, unit: "lb", pairs: true });
    expect(adj).toHaveLength(4);
  });
});
