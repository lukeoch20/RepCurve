import { preferExercise } from "@repcurve/engine";
import type { Equipment, Profile } from "@repcurve/shared";
import { describe, expect, it } from "vitest";
import { reducer, INITIAL } from "../store/reducer";
import { currentProgram, newCore, planFor, positionOf, weekSlots } from "./plan";
import { previewProgram } from "./projection";
import type { AppState } from "../store/reducer";
import { DEFAULT_SETTINGS } from "./types";

const profile: Profile = {
  sex: "male", age: 33, heightCm: 178, bodyweightKg: 84, trainingHistory: "never", goal: "both",
  daysPerWeek: 4, minutesPerSession: 20, injuries: [], units: "lb",
};
const equipment: Equipment = {
  dumbbells: { kind: "fixed", weights: [10, 15, 20, 25, 30], unit: "lb", pairs: true },
  treadmill: true, mat: true, abRoller: true, pullupBar: false, bench: false, bands: [],
};

describe("RC-16: changing days per week keeps the user's week", () => {
  const atSession = (nextIndex: number, days: number): AppState => {
    const core = { ...newCore({ ...profile, daysPerWeek: days }, equipment, 0), nextIndex };
    return { ...INITIAL, ready: true, data: { core, active: null, history: [] } };
  };

  it("keeps week 2 when going from 4 to 6 days", () => {
    const s = reducer(atSession(5, 4), { type: "setup", profile: { ...profile, daysPerWeek: 6 }, equipment, now: 0 });
    const core = s.data.core!;
    expect(core.nextIndex).toBe(5);
    expect(planFor(core, core.nextIndex).week).toBe(2);
    expect(weekSlots(core, []).week).toBe(2);
  });

  it("keeps week 5 when going from 3 to 5 days", () => {
    const s = reducer(atSession(12, 3), { type: "setup", profile: { ...profile, daysPerWeek: 5 }, equipment, now: 0 });
    const core = s.data.core!;
    expect(planFor(core, core.nextIndex).week).toBe(5);
    expect(planFor(core, core.nextIndex + 1).week).toBe(5);
    expect(positionOf(core, core.nextIndex)).toBe(20);
  });

  it("never reuses a week-1 benchmark after the first week", () => {
    const s = reducer(atSession(6, 4), { type: "setup", profile: { ...profile, daysPerWeek: 2 }, equipment, now: 0 });
    const core = s.data.core!;
    expect(planFor(core, core.nextIndex).week).toBe(2);
    const plan = planFor(core, core.nextIndex);
    expect(plan.supersets.flatMap((ss) => ss.items).some((p) => p.benchmarkSet)).toBe(false);
  });

  it("changes nothing when only minutes change", () => {
    const s = reducer(atSession(6, 4), { type: "setup", profile: { ...profile, minutesPerSession: 30 }, equipment, now: 0 });
    expect(s.data.core!.positionOffset ?? 0).toBe(0);
  });
});

describe("RC-01: Plan tab volume follows the sessions the user gets", () => {
  it("reflects the longer one-sided variants a progressing lifter moves to", () => {
    const core = newCore(profile, equipment, 0);
    const total = (v: Record<string, number>) => Object.values(v).reduce((a, b) => a + b, 0);
    let state = core.state;
    for (const [from, to] of [["goblet_squat", "db_reverse_lunge"], ["db_rdl", "db_single_leg_rdl"], ["db_bent_over_row", "db_renegade_row"]] as const) {
      state = preferExercise(state, from, to);
    }
    const before = currentProgram(core).weeklyVolume;
    const after = currentProgram({ ...core, state }).weeklyVolume;
    expect(total(after)).not.toBe(total(before));
    expect(after.quads).toBeGreaterThan(0);
  });
});

describe("RC-11: onboarding preview uses the app's rest and switch times", () => {
  it("matches the first real session", () => {
    for (const minutes of [10, 25, 45]) {
      const p = { ...profile, minutesPerSession: minutes };
      const core = newCore(p, equipment, 0);
      const preview = previewProgram(p, equipment).sessions.find((s) => s.kind === "strength")!;
      const real = planFor(core, preview.index);
      expect(preview.supersets.map((ss) => ss.rounds)).toEqual(real.supersets.map((ss) => ss.rounds));
      expect(preview.supersets[0]!.restSec).toBe(DEFAULT_SETTINGS.restSec);
    }
  });
});
