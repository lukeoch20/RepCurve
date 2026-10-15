import { alternativesFor, prescriptionsOf, primeMovers } from "@repcurve/engine";
import type { Equipment, Profile } from "@repcurve/shared";
import { describe, expect, it } from "vitest";
import { contextFor, newCore, todayPlan } from "./plan";
import { retest } from "./profile";
import { activeMinutes, finishSession, logSet, pause, prefill, resume, setOrder, startSession, swapExercise } from "./session";
import { answerSoreness, soreQuestionFor } from "./soreness";
import type { ActiveSession, Core, SessionRecord } from "./types";

const profile: Profile = {
  sex: "male", age: 33, heightCm: 178, bodyweightKg: 84, trainingHistory: "never", goal: "both",
  daysPerWeek: 4, minutesPerSession: 30, injuries: [], units: "lb", split: "full_body",
};
const equipment: Equipment = {
  dumbbells: { kind: "fixed", weights: [10, 15, 20, 25, 30, 35, 40, 45, 50], unit: "lb", pairs: true },
  treadmill: true, mat: true, abRoller: true, pullupBar: false, bench: true, bands: [],
};
const T0 = Date.UTC(2026, 9, 5, 7);
const HOUR = 3_600_000;
const MIN = 60_000;

function train(core: Core, history: SessionRecord[], now: number) {
  let active: ActiveSession = startSession(core, history, now, null);
  for (const ref of setOrder(active.plan)) {
    const p = prescriptionsOf(active.plan).find((x) => x.slot === ref.slot)!;
    active = logSet(active, ref, { loadKg: p.loadKg, reps: p.targetReps, rir: 2 }, core, now);
  }
  return { active, ...finishSession(active, core, now + HOUR) };
}

describe("new features working together", () => {
  it("F1: a workout closed as of its last set doesn't count a pause taken before that set", () => {
    const core = newCore(profile, equipment, T0);
    let active = startSession(core, [], T0, null);
    const refs = setOrder(active.plan);
    let t = T0;
    const log = (ref: (typeof refs)[number]) => {
      t += 3 * MIN;
      active = logSet(active, ref, prefill(active, ref.slot, ref.setIndex), core, t);
    };
    refs.slice(0, 3).forEach(log); // 9 min
    active = pause(active, t);
    t += 30 * MIN; // phone call
    active = resume(active, t);
    refs.slice(3, 6).forEach(log); // 9 more min
    const last = t;
    // Left open, then "Yes, finish it as of <last set>" four hours later.
    expect(activeMinutes(active, last, last + 4 * HOUR)).toBe(18);
  });

  it("F2: isn't asked 'still sore?' minutes after the session it's asking about", () => {
    const first = train(newCore(profile, equipment, T0), [], T0);
    const now = first.record.finishedAt + 2 * MIN;
    expect(soreQuestionFor(todayPlan(first.core, [first.record], now), [first.record], now)).toBeNull();
  });

  it("F3: an exercise swapped in for a very-sore one stays held", () => {
    const first = train(newCore(profile, equipment, T0), [], T0);
    const history = [first.record];
    const now = T0 + 25 * HOUR;
    let core: Core = { ...first.core, nextIndex: 3 };
    const q = soreQuestionFor(todayPlan(core, history, now), history, now)!;
    core = answerSoreness(core, q.groups, "very", ["quads"], now);
    const active = startSession(core, history, now, null);
    const sore = prescriptionsOf(active.plan).find((p) => p.sore)!;
    const alt = alternativesFor(sore, contextFor(core), []).find((e) => e.primary.includes("quads"))!;
    const swapped = swapExercise(active, core, sore.slot, alt.id, false, "busy").active;
    expect(prescriptionsOf(swapped.plan).find((p) => p.slot === sore.slot)!.sore).toBeDefined();
  });

  it("F4: a re-test isn't benchmarked on a day the muscle is very sore", () => {
    let r = train(newCore(profile, equipment, T0), [], T0);
    let history = [r.record];
    let t = T0 + 48 * HOUR;
    for (let i = 0; i < 4; i++) {
      r = train(r.core, history, t);
      history = [...history, r.record];
      t += 48 * HOUR;
    }
    const now = history.at(-1)!.finishedAt + 20 * HOUR;
    const quad = prescriptionsOf(todayPlan(r.core, history, now)).find((p) => primeMovers(p.exerciseId).includes("quads") && p.loadKg !== null)!;
    let core = retest(r.core, quad.exerciseId);
    const q = soreQuestionFor(todayPlan(core, history, now), history, now)!;
    core = answerSoreness(core, q.groups, "very", ["quads"], now);
    const p = prescriptionsOf(todayPlan(core, history, now)).find((x) => x.exerciseId === quad.exerciseId)!;
    expect(p.sore).toBeDefined();
    expect(p.benchmarkSet).toBe(false);
  });
});
