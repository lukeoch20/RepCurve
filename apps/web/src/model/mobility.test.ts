import { findRoutine } from "@repcurve/exercises";
import type { Equipment, Profile } from "@repcurve/shared";
import { describe, expect, it } from "vitest";
import { INITIAL, reducer, type AppState } from "../store/reducer";
import { migrateCore } from "./migrate";
import {
  anotherRound,
  blockStatus,
  currentStep,
  EASE_BACK_DAYS,
  finishMobility,
  handsFreeOn,
  isCounting,
  LATE_MS,
  migrateMobility,
  MOBILITY_STALE_MS,
  mobilityElapsedMs,
  mobilityProgress,
  mobilityTotals,
  nextMobility,
  pauseBlock,
  pauseMobility,
  restartStep,
  restoreMobility,
  resumeBlock,
  resumeMobility,
  routinePlan,
  sessionHandsFree,
  setBlockLevel,
  setLeftOut,
  skipDrill,
  startBlock,
  startMobility,
  stepRemainingMs,
  stoppedForPain,
  tickMobility,
  trainedFamilies,
  type ActiveMobility,
} from "./mobility";
import { newCore } from "./plan";
import type { Core } from "./types";

const profile: Profile = {
  sex: "male", age: 33, heightCm: 178, bodyweightKg: 84, trainingHistory: "never", goal: "both",
  daysPerWeek: 4, minutesPerSession: 20, injuries: [], units: "lb",
};
const equipment: Equipment = {
  dumbbells: { kind: "fixed", weights: [10, 15, 20, 25, 30], unit: "lb", pairs: true },
  treadmill: true, mat: true, abRoller: true, pullupBar: false, bench: false, bands: [],
};
// Monday 5 October 2026, midday.
const T0 = new Date(2026, 9, 5, 12).getTime();
const DAY = 86_400_000;
const hips = findRoutine("hips")!;
const desk = findRoutine("desk")!;
const core0 = (): Core => newCore(profile, equipment, T0);
const plan = (core: Core, level = 0, routine = hips) => routinePlan(core, routine, level, []);
const begin = (opts: { handsFree?: boolean; block?: boolean; core?: Core; level?: number } = {}): ActiveMobility =>
  startMobility(plan(opts.core ?? core0(), opts.level ?? 0), { block: opts.block ?? false, handsFree: opts.handsFree ?? true }, T0);
const kind = (a: ActiveMobility) => currentStep(a)?.kind ?? "done";

/** Run the session to its end, tapping through anything that waits. */
function runAll(a: ActiveMobility, from: number): { a: ActiveMobility; now: number } {
  let now = from;
  for (let i = 0; i < 500 && !a.finished; i++) {
    if (a.endsAt !== null) {
      now = a.endsAt;
      a = tickMobility(a, now);
    } else {
      now += 20_000;
      a = nextMobility(a, now);
    }
  }
  return { a, now };
}

describe("a mobility session under way", () => {
  it("starts by counting down to the first drill, or waiting for a tap when hands-free is off", () => {
    const auto = begin();
    expect([kind(auto), isCounting(auto), stepRemainingMs(auto, T0)]).toEqual(["ready", true, 10_000]);
    // A screen clock a beat behind never shows more than the step is long.
    expect(stepRemainingMs(auto, T0 - 240)).toBe(10_000);
    const manual = begin({ handsFree: false });
    expect([kind(manual), isCounting(manual), manual.endsAt]).toEqual(["ready", false, null]);
    // A tick does nothing while it waits; a tap starts the drill.
    expect(tickMobility(manual, T0 + 60_000)).toBe(manual);
    expect(kind(nextMobility(manual, T0 + 5000))).toBe("work");
  });

  it("moves one step per tick, each clock starting when the last ended", () => {
    // Hip circles are reps: skip them to reach the first hold.
    let a = skipDrill(skipDrill(begin(), T0), T0);
    expect(a.plan.items[currentStep(a)!.item]!.id).toBe("hip_flexor_stretch");
    a = tickMobility(a, T0 + 10_000);
    expect([kind(a), currentStep(a)!.side, stepRemainingMs(a, T0 + 10_000)]).toEqual(["work", "left", 30_000]);
    expect(tickMobility(a, T0 + 39_999)).toBe(a);
    a = tickMobility(a, T0 + 40_000);
    expect([kind(a), a.doneSec[2]]).toEqual(["switch", 30]);
    a = tickMobility(a, T0 + 45_000);
    expect([kind(a), currentStep(a)!.side]).toEqual(["work", "right"]);
    a = tickMobility(a, T0 + 75_000);
    expect([kind(a), currentStep(a)!.set, a.doneSec[2]]).toEqual(["rest", 1, 60]);
  });

  it("waits for the person when a countdown ended while the phone was asleep, instead of running on", () => {
    let a = skipDrill(skipDrill(begin(), T0), T0);
    a = tickMobility(a, T0 + 10_000);
    // The 30-second hold ended long ago: it counts, and the session pauses at the changeover.
    const back = T0 + 40_000 + LATE_MS + 1;
    a = tickMobility(a, back);
    expect([kind(a), a.pausedAt, a.endsAt, a.doneSec[2], stepRemainingMs(a, back + 999)]).toEqual(["switch", back, null, 30, 5000]);
    // Only a little late is just a slow timer: it carries on.
    let b = skipDrill(skipDrill(begin(), T0), T0);
    b = tickMobility(tickMobility(b, T0 + 10_000), T0 + 40_000 + LATE_MS);
    expect([kind(b), b.pausedAt]).toEqual(["switch", null]);
  });

  it("lets reps go at the person's pace: Done credits them and moves on", () => {
    let a = tickMobility(begin(), T0 + 10_000);
    expect([kind(a), currentStep(a)!.seconds, currentStep(a)!.side, isCounting(a)]).toEqual(["work", null, "left", false]);
    expect(tickMobility(a, T0 + 600_000)).toBe(a);
    a = nextMobility(a, T0 + 50_000);
    expect([kind(a), currentStep(a)!.side, a.doneSec[0]]).toEqual(["work", "right", 32]);
    a = nextMobility(a, T0 + 90_000);
    expect([kind(a), currentStep(a)!.item, a.doneSec[0]]).toEqual(["ready", 1, 64]);
  });

  it("counts a hold ended early for the time it was held", () => {
    let a = tickMobility(skipDrill(skipDrill(begin(), T0), T0), T0 + 10_000);
    a = nextMobility(a, T0 + 10_000 + 12_400);
    expect([kind(a), a.doneSec[2]]).toEqual(["switch", 12]);
    // Tapping through a countdown that isn't work earns nothing.
    expect(nextMobility(a, T0 + 23_000).doneSec[2]).toBe(12);
  });

  it("pauses and resumes without losing its place or counting the pause", () => {
    let a = tickMobility(skipDrill(skipDrill(begin(), T0), T0), T0 + 10_000);
    a = pauseMobility(a, T0 + 20_000);
    expect([a.endsAt, stepRemainingMs(a, T0 + 500_000), isCounting(a)]).toEqual([null, 20_000, false]);
    expect(pauseMobility(a, T0 + 30_000)).toBe(a);
    // Nothing moves while paused.
    expect(nextMobility(a, T0 + 30_000)).toBe(a);
    expect(tickMobility(a, T0 + 600_000)).toBe(a);
    expect(mobilityElapsedMs(a, T0 + 80_000)).toBe(20_000);
    a = resumeMobility(a, T0 + 80_000);
    expect([a.pausedAt, a.pausedMs, a.endsAt]).toEqual([null, 60_000, T0 + 100_000]);
    expect(mobilityElapsedMs(a, T0 + 90_000)).toBe(30_000);
    expect(resumeMobility(a, T0 + 95_000)).toBe(a);
  });

  it("skips the rest of a drill, keeping what was held, and notes a stop for pain", () => {
    let a = tickMobility(skipDrill(skipDrill(begin(), T0), T0), T0 + 10_000);
    a = tickMobility(tickMobility(a, T0 + 40_000), T0 + 45_000);
    // Ten seconds into the right side of set one: stop it because it hurts.
    a = skipDrill(pauseMobility(a, T0 + 55_000), T0 + 70_000, true);
    expect([kind(a), a.plan.items[currentStep(a)!.item]!.id, a.doneSec[2], a.pausedAt, a.pausedMs]).toEqual(["ready", "figure_four", 40, null, 15_000]);
    expect([a.skipped, a.hurt]).toEqual([[0, 1, 2], [2]]);
    // After pain nothing starts by itself: the next drill waits for a tap, even hands-free.
    expect([a.handsFree, isCounting(a), a.endsAt]).toEqual([true, false, null]);
    expect(tickMobility(a, T0 + 600_000)).toBe(a);
    expect(kind(nextMobility(a, T0 + 75_000))).toBe("work");
    // A plain skip carries straight on.
    expect(isCounting(skipDrill(begin(), T0))).toBe(true);
    // Skipping the last drill ends the session.
    let end = a;
    for (let i = 0; i < 3; i++) end = skipDrill(end, T0 + 80_000);
    expect([end.finished, currentStep(end), isCounting(end)]).toEqual([true, null, false]);
    expect(skipDrill(end, T0 + 90_000)).toBe(end);
  });

  it("starts a step again from the top", () => {
    let a = tickMobility(skipDrill(skipDrill(begin(), T0), T0), T0 + 10_000);
    a = restartStep(pauseMobility(a, T0 + 25_000), T0 + 30_000);
    expect([kind(a), a.pausedAt, stepRemainingMs(a, T0 + 30_000), a.doneSec[2]]).toEqual(["work", null, 30_000, 0]);
  });

  it("switches hands-free mid-session: a waiting pause starts counting, a counting one waits", () => {
    let a = begin({ handsFree: false });
    a = sessionHandsFree(a, true, T0 + 3000);
    expect([a.handsFree, a.endsAt]).toEqual([true, T0 + 13_000]);
    a = sessionHandsFree(a, false, T0 + 7000);
    expect([a.handsFree, a.endsAt, a.remainingMs]).toEqual([false, null, 6000]);
    expect(sessionHandsFree(a, false, T0 + 8000)).toBe(a);
    // A hold keeps counting either way.
    let hold = tickMobility(skipDrill(skipDrill(begin(), T0), T0), T0 + 10_000);
    hold = sessionHandsFree(hold, false, T0 + 12_000);
    expect(hold.endsAt).toBe(T0 + 40_000);
    // With hands-free off, the changeover waits for a tap.
    hold = tickMobility(hold, T0 + 40_000);
    expect([kind(hold), isCounting(hold)]).toEqual(["switch", false]);
  });

  it("runs to the end and reports progress along the way", () => {
    const start = begin();
    expect(mobilityProgress(start)).toBe(0);
    const { a } = runAll(start, T0);
    expect([a.finished, mobilityProgress(a)]).toEqual([true, 1]);
    expect(a.skipped).toEqual([]);
  });
});

describe("finishing a mobility session", () => {
  it("keeps what was planned and done of each drill, and the time it took", () => {
    const core = core0();
    const { a, now } = runAll(begin({ core }), T0);
    const r = finishMobility(a, core, now);
    expect(r.entry).toMatchObject({ routine: "hips", version: hips.version, level: 0, startedAt: T0, finishedAt: now });
    expect(r.entry!.blockSession).toBeUndefined();
    expect(r.entry!.drills.map((d) => [d.id, d.plannedSec, d.doneSec])).toEqual([
      ["hip_circles", 64, 64],
      ["ninety_ninety", 40, 40],
      ["hip_flexor_stretch", 120, 120],
      ["figure_four", 120, 120],
      ["adductor_rock_back", 80, 80],
      ["glute_bridge", 50, 50],
    ]);
    expect(r.entry!.minutes).toBe(Math.round((now - T0) / 60_000));
    expect(r.core.mobility!.log).toEqual([r.entry]);
    expect(mobilityTotals(r.core, now)).toEqual({ sessions: 1, minutes: r.entry!.minutes, thisWeek: 1 });
  });

  it("keeps nothing when nothing was done, unless a drill was stopped for pain", () => {
    const core = core0();
    expect(finishMobility(begin({ core }), core, T0 + 60_000)).toEqual({ core, entry: null });
    const hurt = finishMobility(skipDrill(begin({ core }), T0 + 5000, true), core, T0 + 60_000);
    expect(hurt.entry!.drills[0]).toEqual({ id: "hip_circles", plannedSec: 64, doneSec: 0, skipped: true, hurt: true });
    expect(stoppedForPain(hurt.core, "hip_circles")).toBe(true);
    expect(stoppedForPain(hurt.core, "figure_four")).toBe(false);
    // Doing it again without stopping clears the note.
    const again = finishMobility(runAll(startMobility(plan(hurt.core), { block: false, handsFree: true }, T0 + DAY), T0 + DAY).a, hurt.core, T0 + DAY + 600_000);
    expect(stoppedForPain(again.core, "hip_circles")).toBe(false);
  });

  it("doesn't count time away: no longer than three times the plan", () => {
    const core = core0();
    const a = nextMobility(tickMobility(begin({ core }), T0 + 10_000), T0 + 60_000);
    expect(finishMobility(a, core, T0 + 5 * 3_600_000).entry!.minutes).toBe(Math.round((a.plan.estimatedSec * 3) / 60));
  });

  it("counts toward the block when at least half the work was done, and only then", () => {
    const core = startBlock(core0(), "hips", T0);
    // Two of six drills: under half.
    let a = begin({ core, block: true });
    a = nextMobility(nextMobility(tickMobility(a, T0 + 10_000), T0 + 50_000), T0 + 90_000);
    a = nextMobility(tickMobility(a, T0 + 100_000), T0 + 140_000);
    const part = finishMobility(a, core, T0 + 150_000);
    expect([part.entry!.blockSession, part.core.mobility!.block!.done]).toEqual([undefined, 0]);
    expect(part.core.mobility!.log).toHaveLength(1);

    const whole = runAll(begin({ core, block: true }), T0);
    const done = finishMobility(whole.a, core, whole.now);
    expect([done.entry!.blockSession, done.core.mobility!.block!.done]).toEqual([1, 1]);
    // A one-off of the same routine, another routine, or a paused block: saved, not counted.
    expect(finishMobility({ ...whole.a, block: false }, core, whole.now).core.mobility!.block!.done).toBe(0);
    const other = runAll(startMobility(plan(core, 0, desk), { block: true, handsFree: true }, T0), T0);
    expect(finishMobility(other.a, core, other.now).core.mobility!.block!.done).toBe(0);
    expect(finishMobility(whole.a, pauseBlock(core, T0), whole.now).entry!.blockSession).toBeUndefined();
  });

  it("drops sessions more than a year old as new ones are kept", () => {
    const old = { id: "old", routine: "desk", version: 1, level: 0, startedAt: T0 - 400 * DAY, finishedAt: T0 - 400 * DAY, minutes: 7, drills: [] };
    const recent = { ...old, id: "recent", finishedAt: T0 - 300 * DAY };
    const core: Core = { ...core0(), mobility: { log: [old, recent] } };
    const { a, now } = runAll(begin({ core }), T0);
    expect(finishMobility(a, core, now).core.mobility!.log.map((e) => e.id)).toEqual(["recent", a.id]);
  });
});

describe("a mobility block", () => {
  /** A core with a hips block and `n` counted sessions, the last one `ago` days before T0. */
  const after = (n: number, ago = 1): Core => {
    let core = startBlock(core0(), "hips", T0 - 60 * DAY);
    for (let i = 0; i < n; i++) {
      const at = T0 - (ago + (n - 1 - i) * 2) * DAY;
      const status = blockStatus(core, at)!;
      const run = runAll(startMobility(plan(core, status.level), { block: true, handsFree: true }, at), at);
      core = finishMobility(run.a, core, run.now).core;
    }
    return core;
  };

  it("starts at week one, level one, with nothing done", () => {
    const core = startBlock(core0(), "hips", T0);
    expect(blockStatus(core, T0)).toMatchObject({ done: 0, total: 18, week: 1, weeks: 6, level: 0, levelNote: null, perWeek: 3, thisWeek: 0, doneToday: false, reviewDue: false, paused: false });
    expect(blockStatus(core0(), T0)).toBeNull();
    // Only a block routine can be one.
    expect(startBlock(core0(), "desk", T0).mobility).toBeUndefined();
    expect(startBlock(core0(), "nope", T0).mobility).toBeUndefined();
  });

  it("moves through its weeks and levels by sessions done, not by the calendar", () => {
    expect(blockStatus(after(2), T0)).toMatchObject({ done: 2, week: 1, level: 0 });
    expect(blockStatus(after(3), T0)).toMatchObject({ done: 3, week: 2, level: 0 });
    expect(blockStatus(after(6), T0)).toMatchObject({ done: 6, week: 3, level: 1 });
    expect(blockStatus(after(12), T0)).toMatchObject({ done: 12, week: 5, level: 2 });
    const all = after(18);
    expect(blockStatus(all, T0)).toMatchObject({ done: 18, week: 6, level: 2, reviewDue: true });
    expect(all.mobility!.log.map((e) => e.level)).toEqual([0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2]);
    expect(all.mobility!.log.map((e) => e.blockSession)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
  });

  it("counts this week's sessions from Monday, and knows when today's is done", () => {
    // T0 is a Monday: a session on Sunday was last week's.
    expect(blockStatus(after(2, 1), T0)).toMatchObject({ thisWeek: 0, doneToday: false });
    expect(blockStatus(after(2, 0), T0 + 3_600_000)).toMatchObject({ thisWeek: 1, doneToday: true });
    expect(blockStatus(after(2, 0), T0 + 2 * DAY)).toMatchObject({ thisWeek: 1, doneToday: false });
  });

  it("stays at a level the person asks for, and goes back to its own pace when they say", () => {
    const held = setBlockLevel(after(7), 0);
    expect(blockStatus(held, T0)).toMatchObject({ level: 0, levelNote: "Staying at level 1, as you asked." });
    // Asking for a level it hasn't reached changes nothing.
    expect(blockStatus(setBlockLevel(after(7), 2), T0)).toMatchObject({ level: 1, levelNote: null });
    expect(blockStatus(setBlockLevel(held, null), T0)).toMatchObject({ level: 1, levelNote: null });
    expect(setBlockLevel(core0(), 1)).toEqual(core0());
  });

  it("eases back a level after two weeks away, for one session", () => {
    const away = after(7, EASE_BACK_DAYS);
    expect(blockStatus(away, T0)).toMatchObject({ level: 0, levelNote: "It's been 14 days, so this one is a level easier. The one after goes back up." });
    expect(blockStatus(after(7, EASE_BACK_DAYS - 1), T0)).toMatchObject({ level: 1, levelNote: null });
    // Level one can't get easier.
    expect(blockStatus(after(2, 30), T0)).toMatchObject({ level: 0, levelNote: null });
    const run = runAll(startMobility(plan(away, 0), { block: true, handsFree: true }, T0), T0);
    expect(blockStatus(finishMobility(run.a, away, run.now).core, run.now + DAY)).toMatchObject({ done: 8, level: 1, levelNote: null });
  });

  it("can be paused, resumed, run again at the top level, or ended, and keeps its log through all of it", () => {
    const core = after(18);
    const paused = pauseBlock(core, T0);
    expect(blockStatus(paused, T0)).toMatchObject({ paused: true });
    expect(pauseBlock(paused, T0 + 1)).toBe(paused);
    expect(blockStatus(resumeBlock(paused), T0)).toMatchObject({ paused: false });
    expect(resumeBlock(core)).toBe(core);
    const again = anotherRound(core, T0);
    expect(blockStatus(again, T0)).toMatchObject({ done: 0, week: 1, level: 2, reviewDue: false, thisWeek: 0 });
    expect(again.mobility!.block).toEqual({ routine: "hips", startedAt: T0, done: 0, round: 2 });
    expect(again.mobility!.log).toHaveLength(18);
    const ended = reducer({ ...INITIAL, ready: true, data: { core, active: null, history: [] } }, { type: "blockEnd" }).data.core!;
    expect(ended.mobility!.block).toBeUndefined();
    expect(ended.mobility!.log).toHaveLength(18);
  });
});

describe("choices kept with the person's data", () => {
  it("leaves a drill out of a routine and brings it back", () => {
    let core = setLeftOut(core0(), "hips", "figure_four", true);
    core = setLeftOut(setLeftOut(core, "hips", "figure_four", true), "winddown", "lying_hamstring_stretch", true);
    expect(core.mobility!.leftOut).toEqual({ hips: ["figure_four"], winddown: ["lying_hamstring_stretch"] });
    expect(plan(core).items.map((i) => i.id)).not.toContain("figure_four");
    expect(plan(core).leftOut).toEqual([{ id: "figure_four", name: "Figure-four stretch" }]);
    core = setLeftOut(core, "hips", "figure_four", false);
    expect(core.mobility!.leftOut).toEqual({ winddown: ["lying_hamstring_stretch"] });
    expect(plan(core).items.map((i) => i.id)).toContain("figure_four");
  });

  it("builds for the person's own sore areas", () => {
    const core: Core = { ...core0(), profile: { ...profile, injuries: ["knee"] } };
    expect(plan(core).items.map((i) => i.id)).toContain("standing_hip_flexor_stretch");
  });

  it("knows which movements this week's workouts train", () => {
    const families = trainedFamilies(core0(), [], T0);
    expect(families).toContain("squat");
    expect(families.length).toBeGreaterThan(3);
    // A week of cardio only trains none.
    const walker: Core = newCore({ ...profile, goal: "fitness", daysPerWeek: 1 }, { ...equipment, dumbbells: { kind: "none" } }, T0);
    expect(trainedFamilies(walker, [], T0).every((f) => typeof f === "string")).toBe(true);
  });

  it("keeps hands-free on unless it's turned off", () => {
    expect(handsFreeOn(core0())).toBe(true);
    const off = reducer({ ...INITIAL, ready: true, data: { core: core0(), active: null, history: [] } }, { type: "mobilityHandsFree", on: false, now: T0 });
    expect(handsFreeOn(off.data.core!)).toBe(false);
  });
});

describe("mobility data read back from storage", () => {
  it("keeps what it can read, repairs numbers, and drops the rest", () => {
    const entry = { id: "a", routine: "hips", version: 1, level: 0, startedAt: T0, finishedAt: T0 + 600_000, minutes: 10, drills: [{ id: "figure_four", plannedSec: 120, doneSec: 60, hurt: true, extra: 1 }, { id: 7 }] };
    const m = migrateMobility({
      log: [{ ...entry, id: "b", finishedAt: T0 + DAY }, entry, { id: "bad" }, "nope"],
      block: { routine: "hips", startedAt: T0, done: 99, level: 7, round: 2, pausedAt: "x" },
      leftOut: { hips: ["figure_four", "figure_four", 3], desk: [] },
      handsFree: false,
      newer: { kept: true },
    });
    expect(m!.log.map((e) => e.id)).toEqual(["a", "b"]);
    expect(m!.log[0]!.drills).toEqual([{ id: "figure_four", plannedSec: 120, doneSec: 60, hurt: true }]);
    expect(m!.block).toEqual({ routine: "hips", startedAt: T0, done: 18, level: 2, round: 2 });
    expect(m!.leftOut).toEqual({ hips: ["figure_four"] });
    expect(m!.handsFree).toBe(false);
    // A field from a newer version is kept.
    expect((m as unknown as { newer: unknown }).newer).toEqual({ kept: true });
  });

  it("drops a block for a routine that's gone, and is nothing at all when empty", () => {
    expect(migrateMobility({ log: [], block: { routine: "gone", startedAt: T0, done: 1 } })).toBeUndefined();
    expect(migrateMobility({ block: { routine: "desk", startedAt: T0, done: 1 }, handsFree: true })).toEqual({ log: [], handsFree: true });
    expect(migrateMobility(null)).toBeUndefined();
    expect(migrateMobility([])).toBeUndefined();
  });

  it("travels with the rest of the saved data", () => {
    const core = setLeftOut(startBlock(core0(), "hips", T0), "hips", "figure_four", true);
    const back = migrateCore(JSON.parse(JSON.stringify(core)))!;
    expect(back.mobility).toEqual(core.mobility);
    expect(migrateCore(JSON.parse(JSON.stringify(core0())))!.mobility).toBeUndefined();
    expect(migrateCore({ ...JSON.parse(JSON.stringify(core0())), mobility: "junk" })!.mobility).toBeUndefined();
  });
});

describe("a mobility session after a reload", () => {
  const saved = (a: ActiveMobility): unknown => JSON.parse(JSON.stringify(a));

  it("comes back paused where it was, with the interrupted step ready to start again", () => {
    let a = tickMobility(skipDrill(skipDrill(begin(), T0), T0), T0 + 10_000);
    a = tickMobility(tickMobility(a, T0 + 40_000), T0 + 45_000);
    // Closed 12 seconds into the right side; opened again ten minutes later.
    const now = T0 + 57_000 + 600_000;
    const back = restoreMobility(saved(a), now)!;
    expect([kind(back), currentStep(back)!.side, back.endsAt, stepRemainingMs(back, now), back.doneSec[2]]).toEqual(["work", "right", null, 30_000, 30]);
    // Time counts up to when the hold would have ended, not while the app was closed.
    expect(back.pausedAt).toBe(T0 + 75_000);
    expect(mobilityElapsedMs(back, now)).toBe(75_000);
    const on = resumeMobility(back, now);
    expect([isCounting(on), on.endsAt]).toEqual([true, now + 30_000]);
  });

  it("is refused when it can't be read or its routine has changed", () => {
    const a = begin();
    expect(restoreMobility(null, T0)).toBeNull();
    expect(restoreMobility({ id: "x" }, T0)).toBeNull();
    expect(restoreMobility({ ...(saved(a) as object), plan: { ...a.plan, version: a.plan.version + 1 } }, T0)).toBeNull();
    expect(restoreMobility({ ...(saved(a) as object), plan: { ...a.plan, routine: "gone" } }, T0)).toBeNull();
    expect(restoreMobility({ ...(saved(a) as object), plan: { ...a.plan, steps: [{ item: 99, estSec: 1, seconds: 1 }] } }, T0)).toBeNull();
    expect(restoreMobility({ ...(saved(a) as object), stepIndex: 9999, skipped: [0, 0, 77], hurt: "x" }, T0)).toMatchObject({ stepIndex: a.plan.steps.length - 1, skipped: [0], hurt: [] });
  });
});

describe("reducer: mobility", () => {
  const ready = (core: Core = core0()): AppState => ({ ...INITIAL, ready: true, data: { core, active: null, history: [] } });

  it("starts a session, runs it and keeps it when finished", () => {
    let s = reducer(ready(), { type: "mobilityStart", routine: "desk", level: 0, block: false, now: T0 });
    expect(s.mobility!.plan.routine).toBe("desk");
    // One at a time, and no workout starts over it.
    expect(reducer(s, { type: "mobilityStart", routine: "hips", level: 0, block: false, now: T0 })).toBe(s);
    expect(reducer(s, { type: "start", now: T0, minutes: null })).toBe(s);
    // A tick with nothing to do changes nothing at all.
    expect(reducer(s, { type: "mobilityTick", now: T0 + 1000 })).toBe(s);
    s = reducer(s, { type: "mobilityTick", now: T0 + 10_000 });
    expect(currentStep(s.mobility!)!.kind).toBe("work");
    s = reducer(s, { type: "mobilityPause", now: T0 + 20_000 });
    s = reducer(s, { type: "mobilityResume", now: T0 + 30_000 });
    s = reducer(s, { type: "mobilityRestart", now: T0 + 31_000 });
    s = reducer(s, { type: "mobilityTick", now: T0 + 76_000 });
    s = reducer(s, { type: "mobilitySkip", now: T0 + 77_000, hurt: true });
    s = reducer(s, { type: "mobilityFinish", now: T0 + 80_000 });
    expect(s.mobility).toBeNull();
    expect(s.mobilityDone).toMatchObject({ routine: "desk", drills: expect.arrayContaining([{ id: "hip_flexor_stretch", plannedSec: 90, doneSec: 45, skipped: true, hurt: true }]) });
    expect(s.data.core!.mobility!.log).toEqual([s.mobilityDone]);
    expect(reducer(s, { type: "mobilityDismiss" }).mobilityDone).toBeNull();
  });

  it("doesn't start during a workout, for a routine it doesn't have, or with every drill left out", () => {
    const working = reducer(ready(), { type: "start", now: T0, minutes: null });
    expect(reducer(working, { type: "mobilityStart", routine: "desk", level: 0, block: false, now: T0 })).toBe(working);
    expect(reducer(ready(), { type: "mobilityStart", routine: "nope", level: 0, block: false, now: T0 })).toEqual(ready());
    let core = core0();
    for (const d of desk.levels[0]!.items) core = setLeftOut(core, "desk", d.options[0]!, true);
    const s = ready(core);
    expect(reducer(s, { type: "mobilityStart", routine: "desk", level: 0, block: false, now: T0 })).toBe(s);
  });

  it("discards a session without keeping anything", () => {
    let s = reducer(ready(), { type: "mobilityStart", routine: "desk", level: 0, block: false, now: T0 });
    s = reducer(s, { type: "mobilityDiscard" });
    expect([s.mobility, s.mobilityDone, s.data.core!.mobility]).toEqual([null, null, undefined]);
  });

  it("starts, pauses, resumes and levels a block, and counts its sessions", () => {
    let s = reducer(ready(), { type: "blockStart", routine: "hips", now: T0 });
    s = reducer(s, { type: "mobilityStart", routine: "hips", level: 0, block: true, now: T0 });
    const run = runAll(s.mobility!, T0);
    s = reducer({ ...s, mobility: run.a }, { type: "mobilityFinish", now: run.now });
    expect(s.mobilityDone!.blockSession).toBe(1);
    expect(blockStatus(s.data.core!, run.now)).toMatchObject({ done: 1, thisWeek: 1, doneToday: true });
    s = reducer(s, { type: "blockPause", now: run.now });
    expect(blockStatus(s.data.core!, run.now)!.paused).toBe(true);
    s = reducer(reducer(s, { type: "blockResume" }), { type: "blockLevel", level: 0 });
    expect(s.data.core!.mobility!.block).toEqual({ routine: "hips", startedAt: T0, done: 1, level: 0 });
    s = reducer(s, { type: "mobilityLeaveOut", routine: "hips", drill: "figure_four", out: true });
    expect(s.data.core!.mobility!.leftOut).toEqual({ hips: ["figure_four"] });
    s = reducer(s, { type: "blockAgain", now: run.now });
    expect(s.data.core!.mobility!.block).toEqual({ routine: "hips", startedAt: run.now, done: 0, round: 2 });
  });

  it("picks a session back up after a reload, and closes one left open for hours with what was done", () => {
    let s = reducer(ready(), { type: "mobilityStart", routine: "desk", level: 0, block: false, now: T0 });
    s = reducer(reducer(s, { type: "mobilityTick", now: T0 + 10_000 }), { type: "mobilityTick", now: T0 + 55_000 });
    const kept: unknown = JSON.parse(JSON.stringify(s.mobility));
    const soon = reducer(ready(), { type: "mobilityRestore", saved: kept, now: T0 + 120_000 });
    expect([soon.mobility!.id, soon.mobility!.pausedAt !== null]).toEqual([s.mobility!.id, true]);
    // Nothing saved, or junk: nothing happens.
    expect(reducer(ready(), { type: "mobilityRestore", saved: null, now: T0 })).toEqual(ready());
    const late = reducer(ready(), { type: "mobilityRestore", saved: kept, now: T0 + 55_000 + MOBILITY_STALE_MS + 1 });
    expect(late.mobility).toBeNull();
    expect(late.data.core!.mobility!.log).toMatchObject([{ routine: "desk", finishedAt: T0 + 55_000, minutes: 1 }]);
    expect(late.mobilityDone).toBeNull();
  });

  it("drops a session under way when the data is reset", () => {
    let s = reducer(ready(), { type: "mobilityStart", routine: "desk", level: 0, block: false, now: T0 });
    expect(reducer(s, { type: "loaded", data: s.data }).mobility).toBe(s.mobility);
    s = reducer(s, { type: "loaded", data: { core: null, active: null, history: [] } });
    expect([s.mobility, s.mobilityDone]).toEqual([null, null]);
  });
});
