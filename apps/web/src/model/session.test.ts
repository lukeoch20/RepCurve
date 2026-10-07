import { lbToKg } from "@repcurve/shared";
import type { Equipment, Profile } from "@repcurve/shared";
import { describe, expect, it } from "vitest";
import { newCore } from "./plan";
import {
  adjustTimer,
  cardioMinutesDone,
  cardioRemainingMs,
  editSet,
  elapsedMs,
  finishSession,
  logSet,
  nextUp,
  pending,
  pause,
  prefill,
  progressSummary,
  removeSet,
  resume,
  setOrder,
  setTimerLength,
  skipSegment,
  skipSession,
  startCardio,
  startSession,
  swapExercise,
  tickCardio,
} from "./session";
import type { ActiveSession, Core } from "./types";

const profile: Profile = {
  sex: "male", age: 33, heightCm: 178, bodyweightKg: 84, trainingHistory: "never", goal: "both",
  daysPerWeek: 4, minutesPerSession: 20, injuries: [], units: "lb",
};
const equipment: Equipment = {
  dumbbells: { kind: "fixed", weights: [10, 15, 20, 25, 30], unit: "lb", pairs: true },
  treadmill: true, mat: true, abRoller: true, pullupBar: false, bench: false, bands: [],
};
const T0 = Date.UTC(2026, 9, 5, 7, 0, 0);

function fresh(index = 0): { core: Core; active: ActiveSession } {
  const core = { ...newCore(profile, equipment, T0), nextIndex: index };
  return { core, active: startSession(core, [], T0, null) };
}

/** Log every remaining set on target, one minute apart. */
function logAll(active: ActiveSession, core: Core, rir: 0 | 1 | 2 | 3 | 4 = 2): ActiveSession {
  let a = active;
  let t = T0;
  for (let ref = nextUp(a); ref; ref = nextUp(a)) {
    t += 60_000;
    const v = prefill(a, ref.slot, ref.setIndex);
    a = logSet(a, ref, { loadKg: v.loadKg, reps: v.reps, rir }, core, t);
  }
  return a;
}

describe("set order", () => {
  it("goes round by round through each superset, then the finisher", () => {
    const { active } = fresh(4); // week 2, Full body A: 3 rounds
    const order = setOrder(active.plan).map((r) => `${r.label}#${r.setIndex}`);
    expect(order.slice(0, 6)).toEqual(["A1#0", "A2#0", "A1#1", "A2#1", "A1#2", "A2#2"]);
    expect(order[6]).toBe("B1#0");
    expect(order.at(-1)).toMatch(/^Core#/);
  });
});

describe("logging sets", () => {
  it("starts a short transition inside a round and a full rest after it", () => {
    const { core, active } = fresh(4);
    const first = nextUp(active)!;
    const a1 = logSet(active, first, { loadKg: lbToKg(30), reps: 10, rir: 2 }, core, T0 + 1000);
    expect(a1.timer?.kind).toBe("transition");
    expect(a1.timer?.durationSec).toBe(core.settings.transitionSec);
    expect(a1.timer?.next).toMatch(/^A2 /);
    const a2 = logSet(a1, nextUp(a1)!, { loadKg: null, reps: 12, rir: 2 }, core, T0 + 2000);
    expect(a2.timer?.kind).toBe("rest");
    expect(a2.timer?.durationSec).toBe(core.settings.restSec);
    expect(a2.timer?.endsAt).toBe(T0 + 2000 + core.settings.restSec * 1000);
    expect(progressSummary(a2).done).toBe(2);
  });

  it("stops the timer after the very last set", () => {
    const { core, active } = fresh(4);
    const done = logAll(active, core);
    expect(nextUp(done)).toBeNull();
    expect(done.timer).toBeNull();
  });

  it("re-targets the remaining sets after a benchmark set", () => {
    const { core, active } = fresh(0); // week 1: benchmark sets
    const ref = nextUp(active)!;
    const p = active.plan.supersets[0]!.items[0]!;
    expect(p.benchmarkSet).toBe(true);
    const a = logSet(active, ref, { loadKg: p.loadKg, reps: 20, rir: 4 }, core, T0 + 1000);
    expect(a.advice[ref.slot]?.message).toMatch(/^Benchmark logged/);
    expect(prefill(a, ref.slot, 1).reps).toBe(a.nextSet[ref.slot]!.reps);
  });

  it("skips the rest of an exercise after a pain flag", () => {
    const { core, active } = fresh(4);
    const ref = nextUp(active)!;
    const a = logSet(active, ref, { loadKg: lbToKg(30), reps: 6, rir: 2, painFlag: true }, core, T0 + 1000);
    expect(a.skippedSlots).toContain(ref.slot);
    expect(a.advice[ref.slot]?.tone).toBe("stop");
    // None of that exercise's remaining sets is still waiting to be done.
    const remaining = setOrder(a.plan).filter((r) => r.slot === ref.slot && r.setIndex > 0);
    expect(remaining.length).toBeGreaterThan(0);
    expect(pending(a).some((r) => r.slot === ref.slot)).toBe(false);
    expect(nextUp(a)?.slot).not.toBe(ref.slot);
  });

  it("edits and removes sets, keeping coaching in step", () => {
    const { core, active } = fresh(4);
    const ref = nextUp(active)!;
    let a = logSet(active, ref, { loadKg: lbToKg(30), reps: 10, rir: 2 }, core, T0 + 1000);
    a = editSet(a, ref.slot, 0, { loadKg: lbToKg(30), reps: 5, rir: 0 }, core);
    expect(a.sets[0]!.reps).toBe(5);
    expect(a.advice[ref.slot]?.tone).toBe("adjust");
    a = removeSet(a, ref.slot, 0, core);
    expect(a.sets).toHaveLength(0);
    expect(a.advice[ref.slot]).toBeUndefined();
  });
});

describe("swaps", () => {
  it("swaps before the first set, and can make it permanent", () => {
    const { core, active } = fresh(4);
    const slot = active.plan.supersets[0]!.items[0]!.slot;
    const once = swapExercise(active, core, slot, "bodyweight_squat", false);
    expect(once.active.plan.supersets[0]!.items[0]!.exerciseId).toBe("bodyweight_squat");
    expect(once.core).toBe(core);
    const forever = swapExercise(active, core, slot, "db_reverse_lunge", true);
    expect(forever.core.state.substitutions["goblet_squat"]).toBe("db_reverse_lunge");
  });

  it("refuses to swap once sets are logged", () => {
    const { core, active } = fresh(4);
    const ref = nextUp(active)!;
    const a = logSet(active, ref, { loadKg: lbToKg(30), reps: 10, rir: 2 }, core, T0 + 1000);
    expect(swapExercise(a, core, ref.slot, "bodyweight_squat", false).active).toBe(a);
  });
});

describe("timers and pausing", () => {
  it("adjusts and re-lengthens the rest timer", () => {
    const { active } = fresh(4);
    const a: typeof active = { ...active, timer: { kind: "rest", endsAt: T0 + 60_000, durationSec: 60, next: "x" } };
    expect(adjustTimer(a, 15, T0).timer!.endsAt).toBe(T0 + 75_000);
    expect(adjustTimer(a, -90, T0).timer!.endsAt).toBe(T0);
    expect(setTimerLength(a, 90).timer!.endsAt).toBe(T0 + 90_000);
  });

  it("starts a fresh 15 s countdown when +15 is tapped after the timer ran out (RC-19)", () => {
    const { active } = fresh(4);
    const a: typeof active = { ...active, timer: { kind: "rest", endsAt: T0 + 60_000, durationSec: 60, next: "x" } };
    const later = T0 + 4 * 60_000;
    expect(adjustTimer(a, 15, later).timer!.endsAt).toBe(later + 15_000);
    expect(adjustTimer(a, -15, later)).toBe(a);
  });

  it("freezes the clock and the timer while paused", () => {
    const { active } = fresh(4);
    let a: ActiveSession = { ...active, timer: { kind: "rest", endsAt: T0 + 60_000, durationSec: 60, next: "x" } };
    a = pause(a, T0 + 10_000);
    expect(elapsedMs(a, T0 + 70_000)).toBe(10_000);
    a = resume(a, T0 + 70_000);
    expect(a.timer!.endsAt).toBe(T0 + 120_000);
    expect(elapsedMs(a, T0 + 80_000)).toBe(20_000);
  });
});

describe("cardio", () => {
  it("counts down segments, crosses boundaries and finishes", () => {
    const { active } = fresh(2); // treadmill day
    expect(active.plan.kind).toBe("cardio");
    const segs = active.plan.cardio!.segments;
    let a = startCardio(active, T0);
    expect(cardioRemainingMs(a, T0)).toBe(segs[0]!.minutes * 60_000);
    const r = tickCardio(a, T0 + segs[0]!.minutes * 60_000 + 5_000);
    expect(r.crossed).toBe(1);
    a = r.active;
    expect(a.cardio!.segmentIndex).toBe(1);
    a = skipSegment(a, T0 + segs[0]!.minutes * 60_000 + 10_000);
    expect(a.cardio!.segmentIndex).toBe(2);
    const end = tickCardio(a, T0 + 10 * 3_600_000);
    expect(end.active.cardio!.finished).toBe(true);
    // The skipped second part counts only the 10 seconds actually spent in it (RC-17).
    const total = segs.reduce((n, s) => n + s.minutes, 0);
    expect(cardioMinutesDone(end.active, T0 + 10 * 3_600_000)).toBeCloseTo(total - segs[1]!.minutes + 10 / 60, 1);
  });

  it("logs only real minutes when every part is skipped", () => {
    const { active } = fresh(2);
    let a = startCardio(active, T0);
    for (let i = 0; i < active.plan.cardio!.segments.length; i++) a = skipSegment(a, T0 + (i + 1) * 3_000);
    expect(a.cardio!.finished).toBe(true);
    expect(cardioMinutesDone(a, T0 + 60_000)).toBeLessThan(1);
  });
});

describe("finishing", () => {
  it("progresses the training state and moves to the next session", () => {
    const { core, active } = fresh(4);
    const done = logAll(active, core);
    const { core: next, record } = finishSession(done, core, T0 + 20 * 60_000);
    expect(next.nextIndex).toBe(5);
    expect(record.changes.length).toBeGreaterThan(0);
    expect(record.sets.length).toBe(done.sets.length);
    expect(Object.keys(next.state.exercises).length).toBeGreaterThan(0);
    expect(record.activeMinutes).toBe(20);
  });

  it("records a skipped session and moves on", () => {
    const { core } = fresh(2);
    const { core: next, record } = skipSession(core, [], T0);
    expect(record.skipped).toBe(true);
    expect(next.nextIndex).toBe(3);
  });
});
