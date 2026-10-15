import { prescriptionsOf, primeMovers } from "@repcurve/engine";
import type { Equipment, Profile } from "@repcurve/shared";
import { describe, expect, it } from "vitest";
import { migrateData } from "./migrate";
import { newCore, todayPlan } from "./plan";
import { profileFor } from "./profile";
import { finishSession, logSet, setOrder, startSession } from "./session";
import { answerSoreness, currentSoreness, soreFrom, soreQuestionFor, SORE_CHECK_HOURS } from "./soreness";
import type { ActiveSession, Core, SessionRecord } from "./types";

const profile: Profile = {
  sex: "male", age: 33, heightCm: 178, bodyweightKg: 84, trainingHistory: "never", goal: "both",
  daysPerWeek: 4, minutesPerSession: 30, injuries: [], units: "lb", split: "full_body",
};
const equipment: Equipment = {
  dumbbells: { kind: "fixed", weights: [10, 15, 20, 25, 30], unit: "lb", pairs: true },
  treadmill: true, mat: true, abRoller: true, pullupBar: false, bench: true, bands: [],
};
const T0 = Date.UTC(2026, 9, 5, 7);
const HOUR = 3_600_000;

/** Start the next session at `now`, do every set as planned (reps from `reps`), finish an hour later. */
function train(core: Core, history: SessionRecord[], now: number, reps: (target: number, hi: number) => number = (t) => t) {
  let active: ActiveSession = startSession(core, history, now, null);
  for (const ref of setOrder(active.plan)) {
    const p = prescriptionsOf(active.plan).find((x) => x.slot === ref.slot)!;
    active = logSet(active, ref, { loadKg: p.loadKg, reps: reps(p.targetReps, p.repRange[1]), rir: 2 }, core, now);
  }
  return { active, ...finishSession(active, core, now + HOUR) };
}

describe("the still-sore check-in", () => {
  // A first session, then (the next day) one that repeats its squat.
  const first = train(newCore(profile, equipment, T0), [], T0);
  const core = { ...first.core, nextIndex: 3 };
  const history = [first.record];
  const now = T0 + 25 * HOUR;
  const plan = todayPlan(core, history, now);

  it("asks about the muscles today shares with yesterday's session", () => {
    const q = soreQuestionFor(plan, history, now)!;
    expect(q.since).toBe(T0 + HOUR);
    expect(q.groups).toContain("quads");
    expect(soreQuestionFor(plan, history, T0 + 80 * HOUR)).toBeNull();
    expect(soreFrom(q.since, now)).toBe("yesterday's session");
    expect(soreFrom(T0, T0 + HOUR)).toBe("your earlier session today");
  });

  it("very sore quads: a set fewer of the quad exercises, the rest as planned, and saved with the session", () => {
    const q = soreQuestionFor(plan, history, now)!;
    const answered = answerSoreness(core, q.groups, "very", ["quads"], now);
    expect(currentSoreness(answered, now)).toEqual(q.groups.map((group) => ({ group, level: group === "quads" ? "very" : "none" })));
    const sore = todayPlan(answered, history, now);
    const before = prescriptionsOf(plan);
    prescriptionsOf(sore).forEach((p, i) => {
      const quads = primeMovers(p.exerciseId).includes("quads");
      expect(p.sets).toBe(quads ? before[i]!.sets - 1 : before[i]!.sets);
      expect(!!p.sore).toBe(quads);
    });

    // Doing the session very well doesn't move the quad exercises on.
    const second = train(answered, history, now, (_t, hi) => hi);
    expect(second.active.soreness).toEqual(currentSoreness(answered, now));
    expect(second.record.soreness).toEqual(currentSoreness(answered, now));
    let held = 0;
    for (const p of prescriptionsOf(second.active.plan)) {
      const was = answered.state.exercises[p.exerciseId];
      if (!p.sore || !was) continue;
      expect(second.core.state.exercises[p.exerciseId]!.loadKg).toBe(was.loadKg);
      expect(second.core.state.exercises[p.exerciseId]!.targetReps).toBe(was.targetReps);
      expect(second.record.changes.find((c) => c.exerciseId === p.exerciseId)!.action).toBe("hold");
      held++;
    }
    expect(held).toBeGreaterThan(0);
    // And the profile remembers the answer.
    expect(profileFor(second.core, [...history, second.record], now + 2 * HOUR).soreness.find((r) => r.group === "quads")).toMatchObject({ lastLevel: "very", sore: 1 });
  });

  it("a bit sore or not sore keeps the plan", () => {
    const q = soreQuestionFor(plan, history, now)!;
    for (const level of ["none", "bit"] as const) {
      expect(prescriptionsOf(todayPlan(answerSoreness(core, q.groups, level, q.groups, now), history, now)).map((p) => p.sets)).toEqual(prescriptionsOf(plan).map((p) => p.sets));
    }
  });

  it("an answer counts only for the session it was given for, and not for long", () => {
    const answered = answerSoreness(core, ["quads"], "very", ["quads"], now);
    expect(currentSoreness(answered, now + (SORE_CHECK_HOURS - 1) * HOUR)).toBeDefined();
    expect(currentSoreness(answered, now + SORE_CHECK_HOURS * HOUR)).toBeUndefined();
    expect(currentSoreness({ ...answered, nextIndex: answered.nextIndex + 1 }, now)).toBeUndefined();
  });

  it("survives saving and loading, and drops answers it can't read", () => {
    const answered = answerSoreness(core, ["quads", "chest"], "very", ["quads"], now);
    const record = { ...first.record, soreness: [{ group: "quads", level: "very" }, { group: "elbows", level: "very" }, { group: "chest", level: "loads" }] };
    const raw = JSON.parse(JSON.stringify({ core: answered, active: null, history: [record] }));
    const loaded = migrateData(raw);
    expect(loaded.core!.soreCheck).toEqual(answered.soreCheck);
    expect(loaded.history[0]!.soreness).toEqual([{ group: "quads", level: "very" }]);
    const broken = migrateData(JSON.parse(JSON.stringify({ core: { ...answered, soreCheck: { index: "x" } }, active: null, history: [{ ...first.record, soreness: "sore" }] })));
    expect(broken.core!.soreCheck).toBeUndefined();
    expect("soreness" in broken.history[0]!).toBe(false);
  });
});
