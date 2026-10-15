import { barWeight, displayLoad } from "./loads.js";
import type { Units } from "./types.js";

/** Plates a gym or home plate set usually has, heaviest first. The small ones make the 5 lb or 2.5 kg steps loads move in. */
export const PLATES: Record<Units, number[]> = {
  lb: [45, 35, 25, 10, 5, 2.5],
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
};

/** How to load a bar, in the user's units. */
export interface PlateLoad {
  bar: number;
  /** Plates on each side, heaviest first. */
  perSide: number[];
  /** What the bar weighs loaded this way. */
  total: number;
  /** False when the plates can't make the load exactly: `total` is then the nearest below it (or the empty bar). */
  exact: boolean;
}

/**
 * Plates for each side of the bar to make `totalKg`: the heaviest that fit go on first, so the
 * fewest plates. When they can't make it exactly, the nearest load below it.
 */
export function platesFor(totalKg: number, barKg: number | undefined, units: Units, plates: number[] = PLATES[units]): PlateLoad {
  const bar = barWeight(barKg, units);
  const target = displayLoad(totalKg, units);
  // In hundredths, so 2.5 and 1.25 add up exactly.
  const c = (x: number) => Math.round(x * 100);
  let side = Math.max(0, Math.floor((c(target) - c(bar)) / 2));
  const perSide: number[] = [];
  for (const p of plates.filter((x) => x > 0).sort((a, b) => b - a)) {
    while (c(p) <= side) {
      perSide.push(p);
      side -= c(p);
    }
  }
  const total = (c(bar) + 2 * perSide.reduce((s, p) => s + c(p), 0)) / 100;
  return { bar, perSide, total, exact: c(total) === c(target) };
}

/** "45 lb bar + 25 + 10 each side", with the nearest load the plates make when it isn't exact. */
export function plateText(load: PlateLoad, units: Units): string {
  const base = load.perSide.length === 0 ? `Empty ${load.bar} ${units} bar` : `${load.bar} ${units} bar + ${load.perSide.join(" + ")} each side`;
  return load.exact ? base : `${base} (${load.total} ${units}, the closest the plates make)`;
}
