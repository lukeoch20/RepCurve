import { lbToKg, kgToLb } from "./formulas.js";
import type { Dumbbells, Equipment, EquipmentItem, LoadType, Machine, Units } from "./types.js";

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

const range = (from: number, to: number, step: number): number[] => {
  const out: number[] = [];
  for (let w = from; w <= to + 1e-9; w += step) out.push(Math.round(w * 1000) / 1000);
  return out;
};

/**
 * Settings you can choose for a load type, in kg, ascending: owned dumbbells; a barbell loaded in
 * the smallest common plate steps from the empty bar; or a machine or cable stack. Gym loads step
 * in the units the user thinks in (5 lb or 2.5 kg on a bar, 10 lb or 5 kg on a machine).
 */
export function availableLoadsKg(e: { loadType: LoadType; barKg?: number }, eq: Equipment, units: Units): number[] {
  const lb = units === "lb";
  switch (e.loadType) {
    case "dumbbell_pair":
    case "single_dumbbell":
      return availableDumbbellLoadsKg(eq.dumbbells);
    case "barbell": {
      const barKg = e.barKg ?? 20;
      if (!lb) return range(barKg, 300, 2.5);
      const barLb = Math.max(5, Math.round(kgToLb(barKg) / 5) * 5);
      return range(barLb, 650, 5).map(lbToKg);
    }
    case "machine":
      return lb ? range(10, 500, 10).map(lbToKg) : range(5, 250, 5);
    case "cable":
      return lb ? range(5, 200, 5).map(lbToKg) : range(2.5, 100, 2.5);
    default:
      return [];
  }
}

/** Whether the load type can be served by the equipment at all. */
export function canLoad(loadType: LoadType, eq: Equipment): boolean {
  switch (loadType) {
    case "dumbbell_pair":
      return eq.dumbbells.kind !== "none" && eq.dumbbells.pairs;
    case "single_dumbbell":
      return eq.dumbbells.kind !== "none";
    case "band":
      // A band exercise that also works on a cable (Pallof press) lists both in its requirements.
      return eq.bands.length > 0 || eq.cables === true;
    case "barbell":
      return eq.barbell === true || eq.trapBar === true || eq.ezBar === true;
    case "machine":
      return (eq.machines?.length ?? 0) > 0;
    case "cable":
      return eq.cables === true;
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
  if (item.startsWith("machine:")) return eq.machines?.includes(item.slice(8) as Machine) ?? false;
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
      return eq.bench || eq.flatBench === true || eq.adjustableBench === true;
    case "flat_bench":
      return eq.flatBench === true || eq.adjustableBench === true;
    case "adjustable_bench":
      return eq.adjustableBench === true;
    case "bands":
      return eq.bands.length > 0;
    case "band_anchor":
      return eq.bandAnchor === true;
    case "sliders":
      return eq.sliders === true;
    case "suspension":
      return eq.suspension === true;
    case "jump_rope":
      return eq.jumpRope === true;
    case "barbell":
      return eq.barbell === true;
    case "rack":
      return eq.rack === true;
    case "trap_bar":
      return eq.trapBar === true;
    case "ez_bar":
      return eq.ezBar === true;
    case "cables":
      return eq.cables === true;
  }
  return false;
}

/** True if at least one of the alternative requirement sets is fully satisfied. */
export function meetsRequirements(requires: EquipmentItem[][], eq: Equipment): boolean {
  if (requires.length === 0) return true;
  return requires.some((set) => set.every((item) => hasItem(eq, item)));
}

/**
 * Units loads are shown in: the dumbbells' own unit when the user has dumbbells, so every
 * prescription matches a label they own; otherwise the profile's units.
 */
export function loadUnitsFor(profile: { units: Units }, equipment: { dumbbells: { kind: string; unit?: Units } }): Units {
  return equipment.dumbbells.kind !== "none" && equipment.dumbbells.unit ? equipment.dumbbells.unit : profile.units;
}

/** Load in the user's units, rounded to the nearest 0.5 lb or 0.25 kg so owned weights round-trip exactly. */
export function displayLoad(loadKg: number, units: Units): number {
  return units === "lb" ? Math.round(kgToLb(loadKg) * 2) / 2 : Math.round(loadKg * 4) / 4;
}

export function formatLoad(loadKg: number | null, loadType: LoadType, units: Units): string {
  if (loadKg === null) {
    if (loadType === "time") return "";
    if (loadType === "band") return "band";
    return "bodyweight";
  }
  const n = displayLoad(loadKg, units);
  const suffix = loadType === "dumbbell_pair" ? ` ${units} each` : ` ${units}`;
  return `${n}${suffix}`;
}
