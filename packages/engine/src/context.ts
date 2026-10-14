import { availableDumbbellLoadsKg, availableLoadsKg, loadUnitsFor } from "@repcurve/shared";
import type { Equipment, Exercise, Profile, Split, TrainingLevel, Units } from "@repcurve/shared";
import { progressedLevel, trainingLevel } from "./level.js";
import { buildPool } from "./pool.js";
import { effectiveSplit, weeklyTemplate } from "./template.js";
import type { Pool, SessionKind } from "./types.js";

/** Everything the engine derives once from a profile and an equipment list. */
export interface EngineContext {
  profile: Profile;
  equipment: Equipment;
  /** Level from onboarding: exercise choice, rep ranges and starting loads. */
  level: TrainingLevel;
  /** Level the weekly volume is set for: the onboarding level, stepped up by sessions logged. */
  volumeLevel: TrainingLevel;
  /** The split the plan uses (push/pull/legs needs three lifting days; see effectiveSplit). */
  split: Split;
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

/** What the engine knows about the person's history when it plans. */
export interface ContextHistory {
  /** Strength sessions logged so far (the training state's count). */
  strengthSessionsLogged?: number;
}

export function makeContext(profile: Profile, equipment: Equipment, history: ContextHistory = {}): EngineContext {
  const template = weeklyTemplate(profile.daysPerWeek, profile.goal, equipment);
  const strengthPerWeek = template.filter((k) => k === "strength").length;
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
    volumeLevel: progressedLevel(profile, history.strengthSessionsLogged ?? 0),
    split: effectiveSplit(profile, strengthPerWeek),
    pool: buildPool(equipment, profile.injuries, profile),
    ownedLoadsKg: availableDumbbellLoadsKg(equipment.dumbbells),
    loadsFor,
    template,
    strengthPerWeek,
    loadUnits,
  };
}
