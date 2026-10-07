import { availableDumbbellLoadsKg, loadUnitsFor } from "@repcurve/shared";
import type { Equipment, Profile, TrainingLevel, Units } from "@repcurve/shared";
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
  template: SessionKind[];
  strengthPerWeek: number;
  /** Units loads are shown in (the dumbbells' own unit when there are dumbbells). */
  loadUnits: Units;
}

export function makeContext(profile: Profile, equipment: Equipment): EngineContext {
  const template = weeklyTemplate(profile.daysPerWeek, profile.goal, equipment);
  return {
    profile,
    equipment,
    level: trainingLevel(profile),
    pool: buildPool(equipment, profile.injuries),
    ownedLoadsKg: availableDumbbellLoadsKg(equipment.dumbbells),
    template,
    strengthPerWeek: template.filter((k) => k === "strength").length,
    loadUnits: loadUnitsFor(profile, equipment),
  };
}
