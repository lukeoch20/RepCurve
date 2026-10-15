import { describe, expect, it } from "vitest";
import { lbToKg } from "./formulas.js";
import { availableLoadsKg } from "./loads.js";
import { platesFor, plateText } from "./plates.js";
import type { Equipment } from "./types.js";

const bare: Equipment = { dumbbells: { kind: "none" }, treadmill: false, mat: false, abRoller: false, pullupBar: false, bench: false, bands: [], barbell: true };

describe("plate maths", () => {
  it("loads a 45 lb bar with the fewest plates per side", () => {
    const load = platesFor(lbToKg(125), 20, "lb");
    expect(load).toEqual({ bar: 45, perSide: [35, 5], total: 125, exact: true });
    expect(plateText(load, "lb")).toBe("45 lb bar + 35 + 5 each side");
    expect(platesFor(lbToKg(115), 20, "lb", [45, 25, 10, 5, 2.5]).perSide).toEqual([25, 10]);
    expect(platesFor(lbToKg(315), 20, "lb").perSide).toEqual([45, 45, 45]);
    expect(platesFor(lbToKg(50), 20, "lb").perSide).toEqual([2.5]);
  });

  it("works in kg, down to 1.25 kg plates", () => {
    const load = platesFor(62.5, 20, "kg");
    expect(load.perSide).toEqual([20, 1.25]);
    expect(plateText(load, "kg")).toBe("20 kg bar + 20 + 1.25 each side");
    expect(platesFor(102.5, 20, "kg").perSide).toEqual([25, 15, 1.25]);
  });

  it("says when it's just the bar", () => {
    const load = platesFor(20, 20, "kg");
    expect(load).toEqual({ bar: 20, perSide: [], total: 20, exact: true });
    expect(plateText(load, "kg")).toBe("Empty 20 kg bar");
    // A lighter bar (an EZ bar) in lb is the nearest 5 lb, as its loads are.
    expect(platesFor(lbToKg(20), 10, "lb")).toMatchObject({ bar: 20, perSide: [], exact: true });
  });

  it("falls back to the nearest load below when the plates can't make it", () => {
    const load = platesFor(lbToKg(100), 20, "lb", [45, 25, 10]);
    expect(load).toEqual({ bar: 45, perSide: [25], total: 95, exact: false });
    expect(plateText(load, "lb")).toBe("45 lb bar + 25 each side (95 lb, the closest the plates make)");
    // No plates at all: only the bar.
    expect(platesFor(lbToKg(135), 20, "lb", [])).toEqual({ bar: 45, perSide: [], total: 45, exact: false });
    // Lighter than the bar.
    expect(platesFor(10, 20, "kg")).toMatchObject({ perSide: [], total: 20, exact: false });
  });

  it("makes every load the app can prescribe on a bar exactly", () => {
    for (const units of ["lb", "kg"] as const) {
      for (const barKg of [10, 15, 20, 25]) {
        for (const kg of availableLoadsKg({ loadType: "barbell", barKg }, bare, units)) {
          expect(platesFor(kg, barKg, units).exact, `${kg} kg on a ${barKg} kg bar in ${units}`).toBe(true);
        }
      }
    }
  });
});
