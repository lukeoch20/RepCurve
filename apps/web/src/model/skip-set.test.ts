import { prescriptionsOf, type Prescription } from "@repcurve/engine";
import type { Equipment, Profile } from "@repcurve/shared";
import { describe, expect, it } from "vitest";
import { exerciseDone } from "./cheer";
import { migrateActive } from "./migrate";
import { newCore } from "./plan";
import {
  finishSession,
  isSkippedSet,
  logSet,
  nextUp,
  progressSummary,
  setOrder,
  skipSet,
  startSession,
  unskipSet,
  type SetRef,
} from "./session";
import type { ActiveSession, Core, SessionRecord } from "./types";

const profile: Profile = {
  sex: "male", age: 35, heightCm: 180, bodyweightKg: 82, trainingHistory: "regular", goal: "both",
  daysPerWeek: 3, minutesPerSession: 30, injuries: [], units: "lb", split: "full_body",
};
const equipment: Equipment = {
  dumbbells: { kind: "fixed", weights: [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60], unit: "lb", pairs: true },
  treadmill: true, mat: true, abRoller: true, pullupBar: false, bench: true, bands: [],
};
const T0 = Date.UTC(2026, 9, 5, 7);
const DAY = 86_400_000;

const pOf = (a: ActiveSession, slot: string): Prescription => prescriptionsOf(a.plan).find((p) => p.slot === slot)!;
const log = (a: ActiveSession, ref: SetRef, core: Core, t: number, reps?: number) => {
  const p = pOf(a, ref.slot);
  return logSet(a, ref, { loadKg: p.loadKg, reps: reps ?? p.targetReps, rir: 2 }, core, t);
};

/** A trained state (benchmarks done), and the next strength session started. */
function second(): { core: Core; history: SessionRecord[]; active: ActiveSession; t: number } {
  let core = newCore(profile, equipment, T0);
  const history: SessionRecord[] = [];
  for (let day = 0; day < 10; day += 2) {
    const t = T0 + day * DAY;
    let active = startSession(core, history, t, null);
    if (active.plan.kind === "strength" && history.some((r) => r.kind === "strength")) return { core, history, active, t };
    for (const ref of setOrder(active.plan)) active = log(active, ref, core, t);
    const r = finishSession(active, core, t + 3_600_000);
    history.push(r.record);
    core = r.core;
  }
  throw new Error("no second strength session");
}

describe("skipping one set", () => {
  it("takes it out of what's to do and the set count, and can be taken back", () => {
    const core = newCore(profile, equipment, T0);
    let active = startSession(core, [], T0, null);
    const first = nextUp(active)!;
    const before = progressSummary(active);
    active = skipSet(active, first.slot, first.setIndex);
    expect(isSkippedSet(active, first.slot, first.setIndex)).toBe(true);
    expect(nextUp(active)).not.toEqual(first);
    expect(progressSummary(active)).toEqual({ done: 0, total: before.total - 1 });
    active = unskipSet(active, first.slot, first.setIndex);
    expect(nextUp(active)).toEqual(first);
    expect(progressSummary(active)).toEqual(before);
    expect(active.skippedSets).toBeUndefined();
  });

  it("won't skip a set that's already logged, and moves a running rest timer on to the next set", () => {
    const core = newCore(profile, equipment, T0);
    let active = startSession(core, [], T0, null);
    const [a, b, c] = setOrder(active.plan);
    active = log(active, a!, core, T0);
    expect(skipSet(active, a!.slot, a!.setIndex)).toBe(active);
    // The timer after the first set counts down to the second; skipping that one points it at the third.
    expect(active.timer).not.toBeNull();
    active = skipSet(active, b!.slot, b!.setIndex);
    expect(active.timer!.next).toContain(pOf(active, c!.slot).name);
  });

  it("counts toward finishing an exercise, as long as one of its sets was done", () => {
    const core = newCore(profile, equipment, T0);
    let active = startSession(core, [], T0, null);
    const p = prescriptionsOf(active.plan)[0]!;
    const refs = setOrder(active.plan).filter((r) => r.slot === p.slot);
    // Every set skipped: not done.
    for (const r of refs) active = skipSet(active, r.slot, r.setIndex);
    expect(exerciseDone(active, p)).toBe(false);
    active = unskipSet(active, refs[0]!.slot, 0);
    active = log(active, refs[0]!, core, T0);
    expect(exerciseDone(active, p)).toBe(true);
  });

  it("holds the exercise at its weight next time instead of judging it on fewer sets", () => {
    const { core, history, active: start, t } = second();
    const p = prescriptionsOf(start.plan).find((x) => x.loadKg !== null && x.sets >= 2 && core.state.exercises[x.exerciseId]?.calibrated)!;
    const refs = setOrder(start.plan).filter((r) => r.slot === p.slot);
    // Every logged set at the top of the range: without a skip, that would earn more.
    const strong = (a: ActiveSession) => refs.reduce((acc, r) => log(acc, r, core, t, p.repRange[1] + 2), a);
    const full = finishSession(strong(start), core, t + 3_600_000);
    const fullChange = full.record.changes.find((c) => c.exerciseId === p.exerciseId)!;
    const before = core.state.exercises[p.exerciseId]!;
    // Done in full, it moves on (more reps, or more weight, or a step toward it)...
    const after = full.core.state.exercises[p.exerciseId]!;
    expect(fullChange.reason).not.toMatch(/skipped/);
    expect([after.loadKg !== before.loadKg, after.targetReps !== before.targetReps, (after.topStreak ?? 0) > (before.topStreak ?? 0)]).toContain(true);

    const skipped = skipSet(start, refs.at(-1)!.slot, refs.at(-1)!.setIndex);
    const partial = refs.slice(0, -1).reduce((acc, r) => log(acc, r, core, t, p.repRange[1] + 2), skipped);
    const r = finishSession(partial, core, t + 3_600_000);
    const change = r.record.changes.find((c) => c.exerciseId === p.exerciseId)!;
    // ...with a set skipped, it stays exactly where it was.
    expect(change.action).toBe("hold");
    expect(change.reason).toMatch(/You skipped a set, so it stays where it was/);
    expect(r.core.state.exercises[p.exerciseId]!.loadKg).toBe(core.state.exercises[p.exerciseId]!.loadKg);
    expect(r.core.state.exercises[p.exerciseId]!.targetReps).toBe(core.state.exercises[p.exerciseId]!.targetReps);
    // The record shows the skip.
    expect(prescriptionsOf(r.record.plan).find((x) => x.slot === p.slot)!.skippedSets).toBe(1);
    expect(history.length).toBeGreaterThan(0);
  });

  it("is kept through saving, and broken values are dropped", () => {
    const core = newCore(profile, equipment, T0);
    let active = startSession(core, [], T0, null);
    const first = nextUp(active)!;
    active = skipSet(active, first.slot, first.setIndex);
    const kept = migrateActive(JSON.parse(JSON.stringify(active)))!;
    expect(isSkippedSet(kept, first.slot, first.setIndex)).toBe(true);
    const broken = migrateActive({ ...JSON.parse(JSON.stringify(active)), skippedSets: ["nonsense", 4, null] })!;
    expect(broken.skippedSets).toBeUndefined();
  });
});
