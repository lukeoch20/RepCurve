/** Shared helpers for engine tests. Not exported from the package. */
import type { Equipment, Profile, Rir, SetLog } from "@repcurve/shared";
import { makeContext, type EngineContext } from "./context.js";
import type { Prescription, SessionPlan } from "./types.js";
import { prescriptionsOf } from "./state.js";

export const referenceProfile: Profile = {
  sex: "male",
  age: 33,
  heightCm: 178,
  bodyweightKg: 84,
  trainingHistory: "never",
  goal: "both",
  daysPerWeek: 4,
  minutesPerSession: 20,
  injuries: [],
  units: "lb",
};

export const referenceEquipment: Equipment = {
  dumbbells: { kind: "fixed", weights: [10, 15, 20, 25, 30], unit: "lb", pairs: true },
  treadmill: true,
  mat: true,
  abRoller: true,
  pullupBar: false,
  bench: false,
  bands: [],
};

export const adjustableEquipment: Equipment = {
  ...referenceEquipment,
  dumbbells: { kind: "adjustable", min: 5, max: 50, step: 2.5, unit: "lb", pairs: true },
};

export function referenceContext(overrides: { profile?: Partial<Profile>; equipment?: Equipment } = {}): EngineContext {
  return makeContext({ ...referenceProfile, ...overrides.profile }, overrides.equipment ?? referenceEquipment);
}

export function sets(exerciseId: string, loadKg: number | null, reps: number[], rir: Rir | Rir[]): SetLog[] {
  return reps.map((r, i) => ({ exerciseId, setIndex: i, loadKg, reps: r, rir: Array.isArray(rir) ? rir[i]! : rir }));
}

/** Log every prescribed set using `perform` to decide reps and effort. */
export function logSession(
  session: SessionPlan,
  perform: (p: Prescription, setIndex: number) => { reps: number; rir: Rir; loadKg?: number | null; painFlag?: boolean },
): SetLog[] {
  const out: SetLog[] = [];
  for (const p of prescriptionsOf(session)) {
    for (let i = 0; i < p.sets; i++) {
      const r = perform(p, i);
      const log: SetLog = { exerciseId: p.exerciseId, slot: p.slot, setIndex: i, loadKg: r.loadKg === undefined ? p.loadKg : r.loadKg, reps: r.reps, rir: r.rir };
      if (r.painFlag) log.painFlag = true;
      out.push(log);
    }
  }
  return out;
}

/** Hit the target on every set with two reps left. */
export const onTarget = (p: Prescription) => ({ reps: p.targetReps, rir: 2 as Rir });
