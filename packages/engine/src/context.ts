import { availableDumbbellLoadsKg, availableLoadsKg, loadUnitsFor } from "@repcurve/shared";
import type { Equipment, Exercise, Profile, TrainingLevel, Units } from "@repcurve/shared";
import { trainingLevel } from "./level.js";
import { buildPool } from "./pool.js";
import { weeklyTemplate } from "./template.js";
import type { Pool, SessionKind } from "./types.js";

/** Everything the engine derives once from a profile and an equipment list. */
export interface EngineContext {
  profile: Profile;
  equipment: Equipment;
  level: TrainingLevel;
  pool: Pool;
  /** Owned per-dumbbell loads in kg, ascending. */
  ownedLoadsKg: number[];
  /** Loads that can be set for an exercise, kg ascending: owned dumbbells, bar plus plates, or a stack. */
  loadsFor: (e: Pick<Exercise, "loadType" | "barKg">) => number[];
  template: SessionKind[];
  strengthPerWeek: number;
  /** Units loads are shown in (the dumbbells' own unit when there are dumbbells). */
  loadUnits: Units;
}

export function makeContext(profile: Profile, equipment: Equipment): EngineContext {
  const template = weeklyTemplate(profile.daysPerWeek, profile.goal, equipment);
  const loadUnits = loadUnitsFor(profile, equipment);
  const cache = new Map<string, number[]>();
  const loadsFor = (e: Pick<Exercise, "loadType" | "barKg">): number[] => {
    const key = `${e.loadType}:${e.barKg ?? ""}`;
    let loads = cache.get(key);
    if (!loads) cache.set(key, (loads = availableLoadsKg(e, equipment, loadUnits)));
    return loads;
  };
  return {
    profile,
    equipment,
    level: trainingLevel(profile),
    pool: buildPool(equipment, profile.injuries, profile),
    ownedLoadsKg: availableDumbbellLoadsKg(equipment.dumbbells),
    loadsFor,
    template,
    strengthPerWeek: template.filter((k) => k === "strength").length,
    loadUnits,
  };
}
