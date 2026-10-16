import { prescriptionsOf, type Prescription } from "@repcurve/engine";
import type { Equipment, Profile } from "@repcurve/shared";
import { describe, expect, it } from "vitest";
import { cheerFor, exerciseDone } from "./cheer";
import { newCore } from "./plan";
import { finishSession, logSet, setOrder, startSession, type SetRef } from "./session";
import type { ActiveSession, Core, SessionRecord } from "./types";

const profile: Profile = {
  sex: "female", age: 41, heightCm: 165, bodyweightKg: 64, trainingHistory: "never", goal: "both",
  daysPerWeek: 3, minutesPerSession: 30, injuries: [], units: "lb", split: "full_body",
};
const equipment: Equipment = {
  dumbbells: { kind: "fixed", weights: [10, 15, 20, 25, 30], unit: "lb", pairs: true },
  treadmill: true, mat: true, abRoller: true, pullupBar: false, bench: true, bands: [],
};
const T0 = Date.UTC(2026, 9, 5, 7);
const DAY = 86_400_000;

const prescription = (a: ActiveSession, slot: string): Prescription => prescriptionsOf(a.plan).find((p) => p.slot === slot)!;
const onTarget = (a: ActiveSession, ref: SetRef, core: Core, t: number, extra: Partial<{ reps: number; painFlag: boolean }> = {}) => {
  const p = prescription(a, ref.slot);
  return logSet(a, ref, { loadKg: p.loadKg, reps: extra.reps ?? p.targetReps, rir: 2, ...(extra.painFlag ? { painFlag: true } : {}) }, core, t);
};

/** Log every set of a session on target, and finish it. */
function train(core: Core, history: SessionRecord[], now: number) {
  let active = startSession(core, history, now, null);
  for (const ref of setOrder(active.plan)) active = onTarget(active, ref, core, now);
  return finishSession(active, core, now + 3_600_000);
}

describe("a pat on the back after each exercise", () => {
  const core = newCore(profile, equipment, T0);

  it("comes once an exercise's last planned set is logged, not before", () => {
    let active = startSession(core, [], T0, null);
    const order = setOrder(active.plan);
    const slot = order[0]!.slot;
    const sets = order.filter((r) => r.slot === slot);
    for (const ref of sets.slice(0, -1)) {
      active = onTarget(active, ref, core, T0);
      expect(cheerFor(active, slot, [], "lb")).toBeNull();
    }
    active = onTarget(active, sets.at(-1)!, core, T0);
    const c = cheerFor(active, slot, [], "lb")!;
    expect(c).not.toBeNull();
    expect(c.headline.length).toBeGreaterThan(0);
    expect(c.line).toContain(prescription(active, slot).name);
    expect(c.lastOne).toBe(false);
  });

  it("says something to be proud of: weight moved and what it weighs as much as, or reps, or time held", () => {
    let active = startSession(core, [], T0, null);
    for (const ref of setOrder(active.plan)) active = onTarget(active, ref, core, T0);
    for (const p of prescriptionsOf(active.plan)) {
      const c = cheerFor(active, p.slot, [], "lb")!;
      if (p.loadType === "time") expect(c.stat).toMatch(/holding strong/);
      else if (p.loadKg !== null && p.loadKg > 0) expect(c.stat).toMatch(/^That's [\d,]+ lb lifted/);
      else expect(c.stat).toMatch(/reps in the bank/);
    }
    // In kilograms for someone who uses them.
    const kg = prescriptionsOf(active.plan).find((p) => p.loadKg !== null && p.loadKg > 0)!;
    expect(cheerFor(active, kg.slot, [], "kg")!.stat).toMatch(/kg lifted/);
  });

  it("offers to finish when every exercise is done", () => {
    let active = startSession(core, [], T0, null);
    const order = setOrder(active.plan);
    for (const ref of order) active = onTarget(active, ref, core, T0);
    const last = order.at(-1)!.slot;
    const c = cheerFor(active, last, [], "lb")!;
    expect(c.lastOne).toBe(true);
    expect(c.kind).toBe("last");
    expect(c.headline).toBe("Every exercise done!");
  });

  it("calls out a new personal best, beating every earlier session on that exercise", () => {
    let history: SessionRecord[] = [];
    let c = core;
    for (let day = 0; day < 20; day += 2) {
      const t = T0 + day * DAY;
      let active = startSession(c, history, t, null);
      const before = new Set(history.flatMap((r) => r.sets.filter((s) => s.loadKg !== null).map((s) => s.exerciseId)));
      const again = active.plan.kind === "strength" ? prescriptionsOf(active.plan).find((p) => p.loadKg !== null && before.has(p.exerciseId)) : undefined;
      if (again) {
        for (const ref of setOrder(active.plan).filter((r) => r.slot === again.slot)) active = onTarget(active, ref, c, t, { reps: again.repRange[1] + 4 });
        const cheer = cheerFor(active, again.slot, history, "lb")!;
        expect(cheer.kind).toBe("best");
        expect(cheer.headline).toBe("New personal best!");
        expect(cheer.line).toContain(again.name);
        return;
      }
      const r = train(c, history, t);
      history = [...history, r.record];
      c = r.core;
    }
    throw new Error("no loaded exercise came round again");
  });

  it("marks an exercise done for the first time, once there's history to compare with", () => {
    const first = train(core, [], T0);
    const done = new Set(first.record.sets.map((s) => s.exerciseId));
    // Later sessions bring in exercises the first one didn't have.
    let history = [first.record];
    let c = first.core;
    for (let day = 2; day < 12; day += 2) {
      let active = startSession(c, history, T0 + day * DAY, null);
      const fresh = active.plan.kind === "strength" ? prescriptionsOf(active.plan).find((p) => !done.has(p.exerciseId)) : undefined;
      if (fresh) {
        for (const ref of setOrder(active.plan).filter((r) => r.slot === fresh.slot)) active = onTarget(active, ref, c, T0 + day * DAY);
        const cheer = cheerFor(active, fresh.slot, history, "lb")!;
        expect(cheer.kind).toBe("first");
        expect(cheer.headline).toBe(`First ${fresh.name} done!`);
        return;
      }
      const r = train(c, history, T0 + day * DAY);
      history = [...history, r.record];
      c = r.core;
    }
    throw new Error("no new exercise came up");
  });

  it("stays quiet for an exercise that hurt", () => {
    let active = startSession(core, [], T0, null);
    const order = setOrder(active.plan);
    const slot = order[0]!.slot;
    const sets = order.filter((r) => r.slot === slot);
    sets.forEach((ref, i) => (active = onTarget(active, ref, core, T0, i === 0 ? { painFlag: true } : {})));
    expect(cheerFor(active, slot, [], "lb")).toBeNull();
  });

  it("says the same thing for the same exercise in the same session, and isn't the same for every exercise", () => {
    let active = startSession(core, [], T0, null);
    for (const ref of setOrder(active.plan)) active = onTarget(active, ref, core, T0);
    const slots = prescriptionsOf(active.plan).map((p) => p.slot);
    expect(cheerFor(active, slots[0]!, [], "lb")).toEqual(cheerFor(active, slots[0]!, [], "lb"));
    const lines = new Set(slots.slice(0, -1).map((s) => cheerFor(active, s, [], "lb")!.line));
    expect(lines.size).toBeGreaterThan(1);
  });

  it("counts an exercise as done on its planned sets; added sets don't make it done", () => {
    const active = startSession(core, [], T0, null);
    expect(prescriptionsOf(active.plan).some((p) => exerciseDone(active, p))).toBe(false);
  });
});
