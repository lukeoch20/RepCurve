import { lbToKg, kgToLb, round1 } from "./formulas.js";
import type { Dumbbells, Equipment, EquipmentItem, LoadType, Units } from "./types.js";

/** Sorted ascending list of per-dumbbell loads in kg the user owns. */
export function availableDumbbellLoadsKg(d: Dumbbells): number[] {
  if (d.kind === "none") return [];
  const toKg = (w: number) => (d.unit === "lb" ? lbToKg(w) : w);
  if (d.kind === "fixed") {
    return [...new Set(d.weights)].map(toKg).sort((a, b) => a - b);
  }
  const out: number[] = [];
  for (let w = d.min; w <= d.max + 1e-9; w += d.step) out.push(toKg(w));
  return out;
}

/** Whether the load type can be served by the equipment at all. */
export function canLoad(loadType: LoadType, eq: Equipment): boolean {
  switch (loadType) {
    case "dumbbell_pair":
      return eq.dumbbells.kind !== "none" && eq.dumbbells.pairs;
    case "single_dumbbell":
      return eq.dumbbells.kind !== "none";
    case "band":
      return eq.bands.length > 0;
    case "bodyweight":
    case "time":
      return true;
  }
}

/** Largest owned load that is <= target. Returns the smallest owned load if none fit. */
export function roundDownToOwned(targetKg: number, owned: number[]): number | null {
  if (owned.length === 0) return null;
  let best: number | null = null;
  for (const w of owned) {
    if (w <= targetKg + 1e-9) best = w;
  }
  return best ?? owned[0]!;
}

export function nextOwnedLoad(currentKg: number, owned: number[]): number | null {
  for (const w of owned) if (w > currentKg + 1e-9) return w;
  return null;
}

export function prevOwnedLoad(currentKg: number, owned: number[]): number | null {
  let prev: number | null = null;
  for (const w of owned) {
    if (w >= currentKg - 1e-9) break;
    prev = w;
  }
  return prev;
}

export function hasItem(eq: Equipment, item: EquipmentItem): boolean {
  switch (item) {
    case "dumbbells":
      return eq.dumbbells.kind !== "none";
    case "treadmill":
      return eq.treadmill;
    case "mat":
      return eq.mat;
    case "ab_roller":
      return eq.abRoller;
    case "pullup_bar":
      return eq.pullupBar;
    case "bench":
      return eq.bench;
    case "bands":
      return eq.bands.length > 0;
  }
}

/** True if at least one of the alternative requirement sets is fully satisfied. */
export function meetsRequirements(requires: EquipmentItem[][], eq: Equipment): boolean {
  if (requires.length === 0) return true;
  return requires.some((set) => set.every((item) => hasItem(eq, item)));
}

export function formatLoad(loadKg: number | null, loadType: LoadType, units: Units): string {
  if (loadKg === null) {
    return loadType === "time" ? "" : "bodyweight";
  }
  const n = units === "lb" ? Math.round(kgToLb(loadKg)) : round1(loadKg);
  const suffix = loadType === "dumbbell_pair" ? ` ${units} each` : ` ${units}`;
  return `${n}${suffix}`;
}
