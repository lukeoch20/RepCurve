/**
 * Adversarial, black-box tests for the plan generator: invariants that must hold for every
 * profile, plus the behaviour promised by the generator-fixes spec (fill by shortfall, uneven
 * sets, ramp sets, split gating, level progression, fast start, rotation).
 *
 * New API is reached through namespace imports so that a missing export fails only the tests
 * that need it, not the whole file.
 */
import { EXERCISES, getExercise } from "@repcurve/exercises";
import { MACHINES, lbToKg } from "@repcurve/shared";
import type { Equipment, Exercise, Goal, Injury, Muscle, Profile, Rir, Split, TrainingHistory, TrainingLevel } from "@repcurve/shared";
import { describe, expect, it } from "vitest";
import * as contextMod from "./context.js";
import type { EngineContext } from "./context.js";
import { generateProgram, planSessionWith, type PlanOptions } from "./generate.js";
import * as levelMod from "./level.js";
import { volumeCeiling, volumeTarget } from "./level.js";
import { classOf } from "./pool.js";
import { freshProgress, progressExercise, type ExerciseProgress } from "./progression.js";
import * as sessionMod from "./session.js";
import { applyState, initialTrainingState, prescriptionsOf, type ApplyOptions, type TrainingState } from "./state.js";
import * as templateMod from "./template.js";
import { weeklyTemplate } from "./template.js";
import { adjustableEquipment, referenceEquipment, referenceProfile, sets as logSets } from "./testkit.js";
import * as timingMod from "./timing.js";
import { setSeconds, setupSeconds } from "./timing.js";
import type { Prescription, SessionPlan, Superset } from "./types.js";
import { MUSCLES, hardSets, weeklyVolume } from "./volume.js";

// ---------------------------------------------------------------------------------------------
// New API, looked up loosely.
// ---------------------------------------------------------------------------------------------

type MakeContext3 = (p: Profile, e: Equipment, o?: { strengthSessionsLogged?: number }) => EngineContext;
const makeContext3 = contextMod.makeContext as unknown as MakeContext3;
const progressedLevel = (levelMod as unknown as { progressedLevel?: (p: Profile, n: number) => TrainingLevel }).progressedLevel;
const needsRampSet = (sessionMod as unknown as { needsRampSet?: (e: Exercise, supersetIndex: number) => boolean }).needsRampSet;
const RAMP_SET_SEC = (timingMod as unknown as { RAMP_SET_SEC?: number }).RAMP_SET_SEC;
const strengthDaysPerWeek = (templateMod as unknown as { strengthDaysPerWeek?: (d: number, g: Goal, e: Equipment) => number }).strengthDaysPerWeek;
const effectiveSplit = (templateMod as unknown as { effectiveSplit?: (p: Profile, strengthDays: number) => Split }).effectiveSplit;

/** The level volume is planned at (ceiling, targets, rounds). Falls back to ctx.level before the change. */
const volumeLevelOf = (ctx: EngineContext): TrainingLevel => (ctx as EngineContext & { volumeLevel?: TrainingLevel }).volumeLevel ?? ctx.level;

// ---------------------------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------------------------

/** The app's full-gym preset (apps/web/src/model/equipment.ts fullGym("lb")). */
const fullGym: Equipment = {
  dumbbells: { kind: "adjustable", min: 5, max: 100, step: 5, unit: "lb", pairs: true },
  treadmill: true,
  mat: true,
  abRoller: true,
  pullupBar: true,
  bench: true,
  flatBench: true,
  adjustableBench: true,
  bands: ["light", "medium", "heavy"],
  bandAnchor: true,
  jumpRope: true,
  barbell: true,
  rack: true,
  trapBar: true,
  ezBar: true,
  cables: true,
  machines: [...MACHINES],
  bike: true,
  elliptical: true,
  rower: true,
  stairClimber: true,
} as Equipment;

const bodyweightOnly: Equipment = {
  dumbbells: { kind: "none" },
  mat: true,
  bands: [],
  treadmill: false,
  abRoller: false,
  pullupBar: false,
  bench: false,
} as Equipment;

const EQUIPMENT: Record<string, Equipment> = { gym: fullGym, home: referenceEquipment, adjustable: adjustableEquipment, bodyweight: bodyweightOnly };

const SPLITS: (Split | undefined)[] = [undefined, "full_body", "push_pull", "upper_lower", "ppl"];
const HISTORIES: TrainingHistory[] = ["never", "a_little", "lapsed", "regular"];
const GOALS: Goal[] = ["both", "strength_muscle", "fitness"];
const INJURIES: Injury[][] = [[], ["knee"], ["shoulder"], ["low_back"], ["wrist"], ["knee", "shoulder", "low_back", "wrist"]];
const WORKED = MUSCLES.filter((m) => m !== "core");

interface Scenario {
  label: string;
  profile: Profile;
  equipment: Equipment;
  logged?: number;
  opts: PlanOptions;
  weeks: number[];
}

const ctxCache = new Map<string, EngineContext>();
function ctxFor(profile: Partial<Profile>, equipment: Equipment = fullGym, logged?: number): EngineContext {
  const p = { ...referenceProfile, ...profile } as Profile;
  if (p.split === undefined) delete p.split;
  const key = JSON.stringify([p, equipment, logged]);
  let ctx = ctxCache.get(key);
  if (!ctx) {
    ctx = logged === undefined ? contextMod.makeContext(p, equipment) : makeContext3(p, equipment, { strengthSessionsLogged: logged });
    ctxCache.set(key, ctx);
  }
  return ctx;
}

/** A fresh context, never shared (for order-dependence tests). */
function freshCtx(profile: Partial<Profile>, equipment: Equipment = fullGym, logged?: number): EngineContext {
  const p = { ...referenceProfile, ...profile } as Profile;
  return logged === undefined ? contextMod.makeContext(p, equipment) : makeContext3(p, equipment, { strengthSessionsLogged: logged });
}

function planWeek(ctx: EngineContext, week: number, opts: PlanOptions = {}): SessionPlan[] {
  const n = ctx.template.length;
  return Array.from({ length: n }, (_, d) => planSessionWith(ctx, (week - 1) * n + d, opts));
}

const strengthOf = (week: SessionPlan[]) => week.filter((s) => s.kind === "strength");
const items = (s: SessionPlan): Prescription[] => s.supersets.flatMap((ss) => ss.items);
const allPrescriptions = (s: SessionPlan): Prescription[] => [...items(s), ...(s.finisher ? [s.finisher] : [])];
const idsOf = (s: SessionPlan) => allPrescriptions(s).map((p) => p.exerciseId);
const sortedIds = (s: SessionPlan) => [...idsOf(s)].sort();
const familyOf = (id: string) => `${getExercise(id).pattern}:${getExercise(id).family}`;
const needsRack = (e: Exercise) => e.requires.some((option) => option.includes("rack"));
const describeProfile = (p: Partial<Profile>) =>
  `${p.trainingHistory}/${p.goal}/${p.split ?? "default"}/${p.daysPerWeek}d/${p.minutesPerSession}min${p.injuries?.length ? `/inj:${p.injuries.join("+")}` : ""}`;

/** Average weekly volume over a range of weeks. */
function averageVolume(ctx: EngineContext, from: number, to: number): Record<Muscle, number> {
  const total = weeklyVolume(Array.from({ length: to - from + 1 }, (_, i) => planWeek(ctx, from + i)).flat());
  const out = {} as Record<Muscle, number>;
  for (const m of MUSCLES) out[m] = total[m] / (to - from + 1);
  return out;
}

// Deterministic sampler.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
const pick = <T,>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;

function mkScenario(
  p: Partial<Profile>,
  equipmentName: string,
  extra: { logged?: number; opts?: PlanOptions; weeks?: number[]; tag?: string } = {},
): Scenario {
  const profile = { ...referenceProfile, ...p } as Profile;
  if (profile.split === undefined) delete profile.split;
  const opts = extra.opts ?? {};
  const optLabel = Object.keys(opts).length ? ` opts=${JSON.stringify(opts)}` : "";
  return {
    label: `${extra.tag ?? ""}${equipmentName} ${describeProfile(profile)}${extra.logged !== undefined ? ` logged=${extra.logged}` : ""}${optLabel}`,
    profile,
    equipment: EQUIPMENT[equipmentName]!,
    ...(extra.logged !== undefined ? { logged: extra.logged } : {}),
    opts,
    weeks: extra.weeks ?? [2, 3],
  };
}

/** Hand-picked profiles from the spec plus nasty corners, then a seeded random sample. */
function buildScenarios(): Scenario[] {
  const out: Scenario[] = [
    mkScenario({ trainingHistory: "regular", split: "full_body", daysPerWeek: 3, minutesPerSession: 30, goal: "both" }, "gym", { weeks: [2, 3, 8] }),
    mkScenario({ trainingHistory: "regular", split: "upper_lower", daysPerWeek: 4, minutesPerSession: 45, goal: "both" }, "gym", { weeks: [2, 3, 8] }),
    mkScenario({ trainingHistory: "regular", split: "push_pull", daysPerWeek: 4, minutesPerSession: 30, goal: "both" }, "gym", { weeks: [2, 3, 8] }),
    mkScenario({ trainingHistory: "never", split: "full_body", daysPerWeek: 4, minutesPerSession: 45, goal: "both" }, "gym", { weeks: [1, 2, 3, 8] }),
    mkScenario({ trainingHistory: "regular", split: "full_body", daysPerWeek: 4, minutesPerSession: 45, goal: "both" }, "gym", { weeks: [2, 7, 8, 14] }),
    mkScenario({ trainingHistory: "never", split: "ppl", daysPerWeek: 3, minutesPerSession: 30, goal: "both" }, "gym"),
    mkScenario({ trainingHistory: "regular", split: "ppl", daysPerWeek: 3, minutesPerSession: 20, goal: "both" }, "gym"),
    mkScenario({ trainingHistory: "regular", split: "full_body", daysPerWeek: 3, minutesPerSession: 60, goal: "strength_muscle" }, "gym", { weeks: [2, 8] }),
    mkScenario({ trainingHistory: "lapsed", split: "upper_lower", daysPerWeek: 4, minutesPerSession: 45, goal: "strength_muscle" }, "gym", { weeks: [2, 8] }),
    mkScenario({ trainingHistory: "regular", split: "ppl", daysPerWeek: 6, minutesPerSession: 60, goal: "strength_muscle" }, "gym", { weeks: [2, 8] }),
    mkScenario({ trainingHistory: "regular", split: "full_body", daysPerWeek: 1, minutesPerSession: 90, goal: "strength_muscle" }, "gym", { weeks: [1, 2, 8] }),
    mkScenario({ trainingHistory: "regular", split: "push_pull", daysPerWeek: 1, minutesPerSession: 90, goal: "both" }, "gym"),
    mkScenario({ trainingHistory: "never", split: "push_pull", daysPerWeek: 4, minutesPerSession: 20, goal: "both" }, "home", { weeks: [1, 2, 3] }),
    mkScenario({ trainingHistory: "a_little", split: "full_body", daysPerWeek: 3, minutesPerSession: 30, injuries: ["knee", "shoulder", "low_back", "wrist"] }, "bodyweight"),
    mkScenario({ trainingHistory: "never", split: "ppl", daysPerWeek: 6, minutesPerSession: 45, goal: "strength_muscle" }, "bodyweight", { weeks: [1, 2] }),
    mkScenario({ trainingHistory: "regular", split: "upper_lower", daysPerWeek: 6, minutesPerSession: 90, goal: "strength_muscle", injuries: ["knee"] }, "gym", { weeks: [2, 8] }),
    mkScenario({ trainingHistory: "regular", split: "push_pull", daysPerWeek: 5, minutesPerSession: 45, injuries: ["shoulder"] }, "gym", { weeks: [2, 8] }),
    mkScenario({ trainingHistory: "lapsed", split: "full_body", daysPerWeek: 2, minutesPerSession: 60, injuries: ["low_back"] }, "gym", { weeks: [2, 8] }),
    mkScenario({ trainingHistory: "never", split: "full_body", daysPerWeek: 3, minutesPerSession: 45 }, "gym", { logged: 60, weeks: [2, 8] }),
    mkScenario({ trainingHistory: "regular", split: "full_body", daysPerWeek: 4, minutesPerSession: 60 }, "gym", { logged: 150, weeks: [2, 3, 8] }),
    mkScenario({ trainingHistory: "lapsed", split: "push_pull", daysPerWeek: 4, minutesPerSession: 45 }, "gym", { logged: 16, weeks: [2, 8] }),
    mkScenario({ trainingHistory: "never", split: "full_body", daysPerWeek: 3, minutesPerSession: 10, goal: "fitness" }, "home", { opts: { restSec: 180, transitionSec: 60 } }),
    mkScenario({ trainingHistory: "regular", split: "full_body", daysPerWeek: 3, minutesPerSession: 30 }, "gym", { opts: { restSec: 180, transitionSec: 60 } }),
    mkScenario({ trainingHistory: "regular", split: "ppl", daysPerWeek: 4, minutesPerSession: 15 }, "gym", { opts: { restSec: 180, transitionSec: 60 } }),
    mkScenario({ trainingHistory: "a_little", split: "upper_lower", daysPerWeek: 4, minutesPerSession: 60, goal: "fitness" }, "bodyweight", { opts: { restSec: 30, transitionSec: 5 } }),
  ];
  const r = rng(20261014);
  const minutes = [10, 15, 20, 25, 30, 45, 60, 90];
  const loggedOpts = [undefined, undefined, 0, 20, 60, 150];
  const optsChoices: PlanOptions[] = [{}, {}, {}, { restSec: 180, transitionSec: 60 }, { restSec: 30, transitionSec: 5 }];
  for (let i = 0; i < 110; i++) {
    const eq = pick(r, Object.keys(EQUIPMENT));
    const p: Partial<Profile> = {
      trainingHistory: pick(r, HISTORIES),
      goal: pick(r, GOALS),
      daysPerWeek: 1 + Math.floor(r() * 6),
      minutesPerSession: pick(r, minutes),
      injuries: r() < 0.6 ? [] : pick(r, INJURIES),
    };
    const split = pick(r, SPLITS);
    if (split) p.split = split;
    const logged = pick(r, loggedOpts);
    const weeks = r() < 0.35 ? [2, 8] : r() < 0.2 ? [1, 2] : [2, 3];
    out.push(mkScenario(p, eq, { ...(logged !== undefined ? { logged } : {}), opts: pick(r, optsChoices), weeks, tag: `#${i} ` }));
  }
  return out;
}

interface PlannedWeek {
  scenario: Scenario;
  ctx: EngineContext;
  week: number;
  sessions: SessionPlan[];
}

let sweepMemo: PlannedWeek[] | null = null;
/** Every scenario's weeks, planned once and shared by the invariant tests below. */
function sweep(): PlannedWeek[] {
  if (sweepMemo) return sweepMemo;
  const out: PlannedWeek[] = [];
  for (const scenario of buildScenarios()) {
    const ctx = ctxFor(scenario.profile, scenario.equipment, scenario.logged);
    for (const week of scenario.weeks) out.push({ scenario, ctx, week, sessions: planWeek(ctx, week, scenario.opts) });
  }
  sweepMemo = out;
  return out;
}

function* strengthSessions(): Generator<{ s: SessionPlan; pw: PlannedWeek; where: string }> {
  for (const pw of sweep()) {
    for (const s of strengthOf(pw.sessions)) yield { s, pw, where: `${pw.scenario.label} week ${pw.week} day ${s.dayIndex + 1} (${s.variant})` };
  }
}

/** Seconds of a superset as the planner times it: per round, the items still doing sets, then rest. */
function unevenSupersetSec(ss: Superset): number {
  const timed = ss.items.map((p) => ({ e: getExercise(p.exerciseId), p }));
  let sec = 0;
  for (let r = 1; r <= ss.rounds; r++) {
    const inRound = timed.filter((x) => x.p.sets >= r);
    if (inRound.length === 0) continue;
    sec += inRound.reduce((n, x) => n + setSeconds(x.e, x.p.repRange, x.p.targetReps), 0) + ss.transitionSec * (inRound.length - 1) + ss.restSec;
  }
  return sec + setupSeconds(timed.map((x) => x.e));
}
/** The same, if every item were timed for every round. */
function uniformSupersetSec(ss: Superset): number {
  const timed = ss.items.map((p) => ({ e: getExercise(p.exerciseId), p }));
  const perRound = timed.reduce((n, x) => n + setSeconds(x.e, x.p.repRange, x.p.targetReps), 0) + ss.transitionSec * (timed.length - 1) + ss.restSec;
  return perRound * ss.rounds + setupSeconds(timed.map((x) => x.e));
}
/** Ramp sets by the spec rule, independent of the implementation's helper. */
const specRamp = (e: Exercise, index: number) => index > 0 && e.loadType === "barbell" && e.pattern !== "isolation" && e.pattern !== "core";

function expectUnevenSets(s: SessionPlan, where: string): void {
  for (const ss of s.supersets) {
    expect(ss.items.length, `${where} superset ${ss.label} is empty`).toBeGreaterThan(0);
    const maxSets = Math.max(...ss.items.map((p) => p.sets));
    expect(ss.rounds, `${where} superset ${ss.label}: rounds must equal the most sets of any item`).toBe(maxSets);
    for (const p of ss.items) {
      expect(p.sets, `${where} ${p.exerciseId} sets >= 1`).toBeGreaterThanOrEqual(1);
      expect([ss.rounds, ss.rounds - 1], `${where} ${p.exerciseId} sets ${p.sets} vs rounds ${ss.rounds}`).toContain(p.sets);
    }
  }
  const sum = items(s).reduce((n, p) => n + p.sets, 0) + (s.finisher?.sets ?? 0);
  expect(hardSets(s), `${where} hardSets must be the sum of item sets`).toBe(sum);
}

const deloadState = (): TrainingState => ({ ...initialTrainingState(), deloadRemaining: 2, strengthSessionsLogged: 10 });
const comebackState = (): TrainingState => ({ ...initialTrainingState(), strengthSessionsLogged: 10 });
const COMEBACK: ApplyOptions = { daysSinceLastStrength: 20 };

/** A state in which every exercise of the plan is done at the top of its rep range: slower sets, so fitToBudget has to cut. */
function slowState(plan: SessionPlan, ctx: EngineContext): TrainingState {
  const st = initialTrainingState();
  st.strengthSessionsLogged = 5;
  for (const p of allPrescriptions(plan)) {
    const e = getExercise(p.exerciseId);
    const fresh = freshProgress(e, ctx);
    const hi = Math.max(p.repRange[1], fresh.repRange[1]);
    st.exercises[e.id] = { ...fresh, repRange: [p.repRange[0], hi], targetReps: hi, calibrated: true, timesPerformed: 4 };
  }
  return st;
}

// =============================================================================================
// 1. Weekly ceiling
// =============================================================================================

describe("1. weekly ceiling", () => {
  it("ceiling values: novice 15, intermediate 24, advanced 30", () => {
    expect(volumeCeiling("novice")).toBe(15);
    expect(volumeCeiling("intermediate")).toBe(24);
    expect(volumeCeiling("advanced")).toBe(30);
  });

  it("no non-core muscle goes over the ceiling in any sampled week (all splits, 1-6 days, goals, injuries, rest extremes, rotation weeks)", () => {
    const failures: string[] = [];
    for (const pw of sweep()) {
      const ceiling = volumeCeiling(volumeLevelOf(pw.ctx));
      const v = weeklyVolume(pw.sessions);
      for (const m of WORKED) if (v[m] > ceiling + 1e-9) failures.push(`${pw.scenario.label} week ${pw.week}: ${m} ${v[m]} > ${ceiling}`);
    }
    expect(failures).toEqual([]);
  });

  it("a promoted novice is held to the intermediate ceiling (24), an unpromoted one to 15", () => {
    for (const logged of [0, 60]) {
      const ctx = ctxFor({ trainingHistory: "never", split: "full_body", daysPerWeek: 4, minutesPerSession: 60, goal: "strength_muscle" }, fullGym, logged);
      const ceiling = logged >= 60 ? 24 : 15;
      for (const week of [2, 3]) {
        const v = weeklyVolume(planWeek(ctx, week));
        for (const m of WORKED) expect(v[m], `logged ${logged} week ${week} ${m}`).toBeLessThanOrEqual(ceiling + 1e-9);
      }
    }
  });

  it("generateProgram's weekly volume stays under the ceiling, and a 12-week program builds", () => {
    for (const split of ["full_body", "push_pull", "upper_lower", "ppl"] as Split[]) {
      const profile = { ...referenceProfile, trainingHistory: "regular" as TrainingHistory, split, daysPerWeek: 5, minutesPerSession: 60 };
      const program = generateProgram({ profile, equipment: fullGym }, { weeks: 12, createdAt: "test" });
      expect(program.sessions.length).toBe(12 * program.template.length);
      for (const m of WORKED) expect(program.weeklyVolume[m], `${split} ${m}`).toBeLessThanOrEqual(volumeCeiling("intermediate") + 1e-9);
    }
  });
});

// =============================================================================================
// 2. Fill by shortfall and session hygiene
// =============================================================================================

describe("2. fill by shortfall", () => {
  const regular = { trainingHistory: "regular" as TrainingHistory, goal: "both" as Goal };

  it("full body, 3 days (2 lifting), 30 min: chest gets at least 0.6x back (weeks 2-7)", () => {
    const v = averageVolume(ctxFor({ ...regular, split: "full_body", daysPerWeek: 3, minutesPerSession: 30 }), 2, 7);
    expect(v.chest, `chest ${v.chest} back ${v.back}`).toBeGreaterThanOrEqual(0.6 * v.back);
  });

  it("upper/lower, 4 days (3 lifting), 45 min: chest gets at least 0.6x back (weeks 2-7)", () => {
    const v = averageVolume(ctxFor({ ...regular, split: "upper_lower", daysPerWeek: 4, minutesPerSession: 45 }), 2, 7);
    expect(v.chest, `chest ${v.chest} back ${v.back}`).toBeGreaterThanOrEqual(0.6 * v.back);
  });

  it("push/pull, 4 days, 30 min: quads get at least 7 sets a week (weeks 2-7)", () => {
    const v = averageVolume(ctxFor({ ...regular, split: "push_pull", daysPerWeek: 4, minutesPerSession: 30 }), 2, 7);
    expect(v.quads).toBeGreaterThanOrEqual(7);
  });

  it("full body day B puts a horizontal push before the vertical push", () => {
    const cases: [Partial<Profile>, Equipment][] = [
      [{ ...regular, split: "full_body", daysPerWeek: 3, minutesPerSession: 30 }, fullGym],
      [{ ...regular, split: "full_body", daysPerWeek: 4, minutesPerSession: 45 }, fullGym],
      [{ trainingHistory: "never", split: "full_body", daysPerWeek: 4, minutesPerSession: 20 }, referenceEquipment],
      [{ trainingHistory: "never", split: "full_body", daysPerWeek: 4, minutesPerSession: 45 }, fullGym],
      [{ trainingHistory: "a_little", split: "full_body", daysPerWeek: 3, minutesPerSession: 30 }, bodyweightOnly],
    ];
    let checked = 0;
    for (const [p, eq] of cases) {
      const ctx = ctxFor(p, eq);
      for (const week of [2, 3]) {
        for (const s of strengthOf(planWeek(ctx, week)).filter((x) => x.variant === "B")) {
          const order = items(s).map((x) => x.pattern);
          const h = order.indexOf("horizontal_push");
          const v = order.indexOf("vertical_push");
          if (v === -1) continue;
          checked++;
          expect(h, `${describeProfile(p)} week ${week} B: ${order.join(",")}`).toBeGreaterThanOrEqual(0);
          expect(h, `${describeProfile(p)} week ${week} B: ${order.join(",")}`).toBeLessThan(v);
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("a novice in a full gym (full body, 4 days, 45 min) uses at least 75% of the time in weeks 2-4", () => {
    const ctx = ctxFor({ trainingHistory: "never", split: "full_body", daysPerWeek: 4, minutesPerSession: 45, goal: "both" });
    const sessions = [2, 3, 4].flatMap((w) => strengthOf(planWeek(ctx, w)));
    const use = sessions.reduce((n, s) => n + s.estimatedMinutes / s.budgetMinutes, 0) / sessions.length;
    expect(use).toBeGreaterThanOrEqual(0.75);
  });

  it("never plans more than 5% over the time budget", () => {
    const failures: string[] = [];
    for (const { s, where } of strengthSessions()) if (s.estimatedMinutes > s.budgetMinutes * 1.05 + 1e-9) failures.push(`${where}: ${s.estimatedMinutes} > ${s.budgetMinutes}`);
    expect(failures).toEqual([]);
  });

  it("never plans more than 5 supersets, even on a 90 or 120 minute day", () => {
    const failures: string[] = [];
    for (const { s, where } of strengthSessions()) if (s.supersets.length > 5) failures.push(`${where}: ${s.supersets.length}`);
    for (const history of ["never", "regular"] as TrainingHistory[]) {
      for (const split of ["full_body", "push_pull", "upper_lower", "ppl"] as Split[]) {
        const ctx = ctxFor({ trainingHistory: history, split, daysPerWeek: 3, minutesPerSession: 45, goal: "strength_muscle" });
        for (const minutes of [90, 120]) {
          for (const s of strengthOf([0, 1, 2].map((d) => planSessionWith(ctx, ctx.template.length + d, { minutes })))) {
            if (s.supersets.length > 5) failures.push(`${history} ${split} ${minutes}min: ${s.supersets.length}`);
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("never repeats an exercise in a session (supersets and finisher)", () => {
    const failures: string[] = [];
    for (const { s, where } of strengthSessions()) {
      const ids = idsOf(s);
      if (new Set(ids).size !== ids.length) failures.push(`${where}: ${ids.join(",")}`);
    }
    expect(failures).toEqual([]);
  });

  // Spec amended during implementation: a split day built around a few muscles may have three of a
  // main movement (flat, incline and machine presses on push day); full-body days, and isolation
  // exercises on any day, stay at two.
  it("never uses one exercise family more than twice in a full-body session, or three times (main movements) on a split day", () => {
    const failures: string[] = [];
    const fullBody = new Set(["A", "B", "C"]);
    for (const { s, where } of strengthSessions()) {
      const counts = new Map<string, number>();
      for (const id of idsOf(s)) counts.set(familyOf(id), (counts.get(familyOf(id)) ?? 0) + 1);
      for (const [f, n] of counts) {
        const limit = fullBody.has(s.variant) || f.startsWith("isolation:") ? 2 : 3;
        if (n > limit) failures.push(`${where}: ${f} x${n}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("keeps slot names unique within a session", () => {
    const failures: string[] = [];
    for (const { s, where } of strengthSessions()) {
      const slots = allPrescriptions(s).map((p) => p.slot);
      if (new Set(slots).size !== slots.length) failures.push(`${where}: ${slots.join(",")}`);
    }
    expect(failures).toEqual([]);
  });

  it("every strength session has at least one superset", () => {
    const empty: string[] = [];
    for (const { s, where } of strengthSessions()) if (s.supersets.length === 0) empty.push(where);
    expect(empty).toEqual([]);
  });

  it("uses only exercises the equipment and injuries allow", () => {
    for (const { s, pw, where } of strengthSessions()) {
      const pool = new Set(pw.ctx.pool.exercises.map((e) => e.id));
      for (const p of allPrescriptions(s)) {
        expect(pool.has(p.exerciseId), `${where}: ${p.exerciseId} not in pool`).toBe(true);
        const bad = getExercise(p.exerciseId).avoidWith.filter((i) => pw.scenario.profile.injuries.includes(i));
        expect(bad, `${where}: ${p.exerciseId}`).toEqual([]);
      }
    }
  });
});

// =============================================================================================
// 3. Truthful notes
// =============================================================================================

describe("3. truthful notes", () => {
  it("only says the muscles 'already' get plenty when one of them is at 90% of the ceiling or more", () => {
    const failures: string[] = [];
    for (const pw of sweep()) {
      const ceiling = volumeCeiling(volumeLevelOf(pw.ctx));
      const v = weeklyVolume(pw.sessions);
      for (const s of strengthOf(pw.sessions)) {
        const text = (s.notes ?? []).join(" ");
        if (!/already/.test(text)) continue;
        const trained = new Set(items(s).flatMap((p) => [...getExercise(p.exerciseId).primary, ...getExercise(p.exerciseId).secondary]).filter((m) => m !== "core"));
        if (![...trained].some((m) => v[m] >= 0.9 * ceiling - 1e-9)) {
          failures.push(`${pw.scenario.label} week ${pw.week} day ${s.dayIndex + 1}: ${[...trained].map((m) => `${m}=${v[m]}`).join(" ")} (ceiling ${ceiling})`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("never claims a muscle gets plenty while it is below the bottom of the weekly target", () => {
    const failures: string[] = [];
    for (const pw of sweep()) {
      const floor = volumeTarget(volumeLevelOf(pw.ctx))[0];
      const v = weeklyVolume(pw.sessions);
      for (const s of strengthOf(pw.sessions)) {
        for (const note of s.notes ?? []) {
          if (!/plenty/.test(note)) continue;
          const named = WORKED.filter((m) => new RegExp(`\\b${m}\\b`, "i").test(note));
          // A note that names no muscle speaks for every muscle the session trains as a prime mover.
          const claimed = named.length > 0 ? named : [...new Set(items(s).flatMap((p) => getExercise(p.exerciseId).primary))].filter((m) => m !== "core");
          const short = claimed.filter((m) => v[m] < floor - 1e-9);
          if (short.length > 0) failures.push(`${pw.scenario.label} week ${pw.week} day ${s.dayIndex + 1}: ${short.map((m) => `${m}=${v[m]}`).join(" ")} < ${floor}: "${note}"`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("only says 'on purpose' when the session really ends 3+ minutes early", () => {
    const failures: string[] = [];
    for (const { s, where } of strengthSessions()) {
      const text = (s.notes ?? []).join(" ");
      if (/on purpose/.test(text) && s.estimatedMinutes > s.budgetMinutes - 3 + 1e-9) failures.push(`${where}: ${s.estimatedMinutes}/${s.budgetMinutes}`);
    }
    expect(failures).toEqual([]);
  });
});

// =============================================================================================
// 4. Uneven sets within a superset
// =============================================================================================

describe("4. uneven sets", () => {
  it("planned: each item has rounds or rounds-1 sets, rounds is the most, hardSets is the sum", () => {
    for (const { s, where } of strengthSessions()) expectUnevenSets(s, where);
  });

  it("after applyState with a fresh state, a deload, a comeback and a slow state that forces cuts", () => {
    let n = 0;
    for (const pw of sweep()) {
      if (pw.week !== 2) continue;
      for (const s of strengthOf(pw.sessions)) {
        const where = `${pw.scenario.label} day ${s.dayIndex + 1}`;
        expectUnevenSets(applyState(s, initialTrainingState(), pw.ctx), `${where} fresh`);
        expectUnevenSets(applyState(s, deloadState(), pw.ctx), `${where} deload`);
        expectUnevenSets(applyState(s, comebackState(), pw.ctx, COMEBACK), `${where} comeback`);
        expectUnevenSets(applyState(s, slowState(s, pw.ctx), pw.ctx), `${where} slow`);
        n++;
      }
    }
    expect(n).toBeGreaterThan(20);
  });

  it("the deload and comeback flags are set when they should be", () => {
    const ctx = ctxFor({ trainingHistory: "regular", split: "full_body", daysPerWeek: 3, minutesPerSession: 45 });
    const s = planSessionWith(ctx, 3);
    expect(applyState(s, deloadState(), ctx).deload).toBe(true);
    expect(applyState(s, comebackState(), ctx, COMEBACK).comeback).toBe(true);
    // A first session ever is not a comeback, however long since "the last one".
    expect(applyState(s, initialTrainingState(), ctx, COMEBACK).comeback).toBe(false);
  });
});

// =============================================================================================
// 5. Gym practicality: racks and ramp sets
// =============================================================================================

describe("5. gym practicality", () => {
  it("never pairs two rack exercises in one superset (e.g. back squat with bench press)", () => {
    const failures: string[] = [];
    for (const { s, where } of strengthSessions()) {
      for (const ss of s.supersets) {
        const rack = ss.items.filter((p) => needsRack(getExercise(p.exerciseId)));
        if (rack.length > 1) failures.push(`${where} ${ss.label}: ${rack.map((p) => p.exerciseId).join(" + ")}`);
      }
    }
    // Barbell-first lifters, explicitly.
    for (const split of ["full_body", "push_pull", "upper_lower", "ppl"] as Split[]) {
      for (const minutes of [30, 45, 60, 90]) {
        for (const history of ["regular", "lapsed"] as TrainingHistory[]) {
          const ctx = ctxFor({ trainingHistory: history, split, daysPerWeek: 4, minutesPerSession: minutes, goal: "strength_muscle" });
          for (const s of strengthOf(planWeek(ctx, 2))) {
            for (const ss of s.supersets) {
              const rack = ss.items.filter((p) => needsRack(getExercise(p.exerciseId)));
              if (rack.length > 1) failures.push(`${history} ${split} ${minutes}min day ${s.dayIndex + 1} ${ss.label}: ${rack.map((p) => p.exerciseId).join(" + ")}`);
            }
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("needsRampSet follows the rule for every exercise and superset position", () => {
    expect(typeof needsRampSet, "needsRampSet exported from ./session.js").toBe("function");
    for (const e of EXERCISES) for (const i of [0, 1, 2, 4]) expect(needsRampSet!(e, i), `${e.id} @${i}`).toBe(specRamp(e, i));
    expect(needsRampSet!(getExercise("barbell_back_squat"), 0)).toBe(false);
    expect(needsRampSet!(getExercise("barbell_back_squat"), 1)).toBe(true);
    expect(needsRampSet!(getExercise("ez_bar_curl"), 3)).toBe(false);
  });

  it("RAMP_SET_SEC is 60", () => {
    expect(RAMP_SET_SEC).toBe(60);
  });

  it("each superset's estimatedSec is its sets, setup, and 60 s per ramp set (planned and after applyState)", () => {
    const failures: string[] = [];
    let ramps = 0;
    const check = (s: SessionPlan, where: string) => {
      s.supersets.forEach((ss, i) => {
        const r = ss.items.filter((p) => specRamp(getExercise(p.exerciseId), i)).length;
        ramps += r;
        const extra = 60 * r;
        const a = unevenSupersetSec(ss) + extra;
        const b = uniformSupersetSec(ss) + extra;
        if (Math.abs(ss.estimatedSec - a) > 1 && Math.abs(ss.estimatedSec - b) > 1) failures.push(`${where} ${ss.label}: ${ss.estimatedSec} vs ${a}/${b} (ramps ${r})`);
      });
    };
    for (const { s, pw, where } of strengthSessions()) {
      check(s, where);
      if (pw.week === 2) check(applyState(s, initialTrainingState(), pw.ctx), `${where} applied`);
    }
    expect(ramps, "the sweep should include barbell compounds after the first superset").toBeGreaterThan(0);
    expect(failures).toEqual([]);
  });

  it("estimatedMinutes adds up: warm-up + supersets + finisher", () => {
    for (const { s, where } of strengthSessions()) {
      const f = s.finisher;
      const finisherSec = f ? timingMod.finisherSeconds(getExercise(f.exerciseId), f.repRange, f.sets, f.targetReps) : 0;
      const total = s.warmupMinutes + (s.supersets.reduce((n, ss) => n + ss.estimatedSec, 0) + finisherSec) / 60;
      expect(Math.abs(total - s.estimatedMinutes), where).toBeLessThanOrEqual(0.11);
    }
  });
});

// =============================================================================================
// 6. Deloads and comebacks take a round off every superset
// =============================================================================================

describe("6. deload fix", () => {
  const withRounds = (s: SessionPlan, rounds: number[]): SessionPlan => ({
    ...s,
    supersets: s.supersets.map((ss, i) => {
      const n = rounds[i] ?? rounds[rounds.length - 1]!;
      return { ...ss, rounds: n, items: ss.items.map((p) => ({ ...p, sets: n })) };
    }),
  });
  const expectRoundOff = (planned: SessionPlan, applied: SessionPlan, where: string) => {
    for (const ss of applied.supersets) {
      const before = planned.supersets.find((x) => x.label === ss.label)!;
      expect(before, `${where} ${ss.label}`).toBeDefined();
      const cap = Math.max(1, before.rounds - 1);
      expect(ss.rounds, `${where} ${ss.label}: planned ${before.rounds}`).toBeLessThanOrEqual(cap);
      for (const p of ss.items) expect(p.sets, `${where} ${ss.label} ${p.exerciseId}`).toBeLessThanOrEqual(cap);
    }
  };

  it("mixed planned rounds [4,3,3] become at most [3,2,2], for a deload and a comeback", () => {
    for (const minutes of [30, 45, 60]) {
      for (const split of ["full_body", "upper_lower"] as Split[]) {
        const ctx = ctxFor({ trainingHistory: "regular", split, daysPerWeek: 3, minutesPerSession: minutes });
        for (const s of strengthOf(planWeek(ctx, 2))) {
          if (s.supersets.length < 2) continue;
          for (const pattern of [[4, 3, 3], [3, 2, 2], [4, 4, 2], [2, 1, 1]]) {
            const planned = withRounds(s, pattern);
            const where = `${split} ${minutes}min day ${s.dayIndex + 1} ${pattern.join("/")}`;
            expectRoundOff(planned, applyState(planned, deloadState(), ctx), `${where} deload`);
            expectRoundOff(planned, applyState(planned, comebackState(), ctx, COMEBACK), `${where} comeback`);
          }
        }
      }
    }
  });

  it("every planned session in the sweep loses a round per superset in a deload and a comeback", () => {
    for (const pw of sweep()) {
      if (pw.week !== 2) continue;
      for (const s of strengthOf(pw.sessions)) {
        const where = `${pw.scenario.label} day ${s.dayIndex + 1}`;
        expectRoundOff(s, applyState(s, deloadState(), pw.ctx), `${where} deload`);
        expectRoundOff(s, applyState(s, comebackState(), pw.ctx, COMEBACK), `${where} comeback`);
      }
    }
  });

  it("a deload never adds sets to any exercise", () => {
    for (const pw of sweep()) {
      if (pw.week !== 2) continue;
      for (const s of strengthOf(pw.sessions)) {
        const planned = new Map(allPrescriptions(s).map((p) => [p.exerciseId, p.sets]));
        for (const p of allPrescriptions(applyState(s, deloadState(), pw.ctx))) {
          const before = planned.get(p.exerciseId);
          if (before !== undefined) expect(p.sets, `${pw.scenario.label} ${p.exerciseId}`).toBeLessThanOrEqual(before);
        }
      }
    }
  });
});

// =============================================================================================
// 7. Split gating
// =============================================================================================

describe("7. split gating", () => {
  it("strengthDaysPerWeek counts the template's strength days", () => {
    expect(typeof strengthDaysPerWeek, "strengthDaysPerWeek exported from ./template.js").toBe("function");
    for (const goal of GOALS)
      for (const eq of [fullGym, bodyweightOnly, referenceEquipment, { ...fullGym, treadmill: false } as Equipment])
        for (const days of [0, 1, 2, 3, 4, 5, 6, 7, 2.4, 3.6])
          expect(strengthDaysPerWeek!(days, goal, eq), `${goal} ${days}d treadmill=${eq.treadmill}`).toBe(weeklyTemplate(days, goal, eq).filter((k) => k === "strength").length);
  });

  // Spec amended after code review: a split with fewer lifting days than day types leaves muscles
  // untrained in alternate weeks, so push/pull and upper/lower also need two lifting days.
  it("effectiveSplit drops push/pull/legs below 3 lifting days and push/pull, upper/lower below 2", () => {
    expect(typeof effectiveSplit, "effectiveSplit exported from ./template.js").toBe("function");
    const p = (split?: Split): Profile => {
      const x = { ...referenceProfile } as Profile;
      if (split) x.split = split;
      return x;
    };
    for (const n of [0, 1, 2]) expect(effectiveSplit!(p("ppl"), n)).toBe("full_body");
    for (const n of [3, 4, 5]) expect(effectiveSplit!(p("ppl"), n)).toBe("ppl");
    for (const split of ["push_pull", "upper_lower", "full_body"] as Split[]) for (const n of [2, 3]) expect(effectiveSplit!(p(split), n)).toBe(split);
    for (const split of ["push_pull", "upper_lower"] as Split[]) expect(effectiveSplit!(p(split), 1)).toBe("full_body");
    expect(effectiveSplit!(p("full_body"), 1)).toBe("full_body");
    for (const n of [1, 4]) expect(effectiveSplit!(p(undefined), n)).toBe("full_body");
  });

  it("push/pull/legs with 2 lifting days plans full body A/B", () => {
    for (const goal of ["both", "fitness"] as Goal[]) {
      const ctx = ctxFor({ trainingHistory: "regular", split: "ppl", daysPerWeek: 3, minutesPerSession: 30, goal });
      expect(ctx.strengthPerWeek).toBe(2);
      for (const week of [1, 2, 3]) expect(strengthOf(planWeek(ctx, week)).map((s) => s.variant), `${goal} week ${week}`).toEqual(["A", "B"]);
    }
    const one = ctxFor({ trainingHistory: "never", split: "ppl", daysPerWeek: 1, minutesPerSession: 45 });
    expect(strengthOf(planWeek(one, 2)).map((s) => s.variant)).toEqual(["A"]);
    // Three lifting days keep the split.
    const three = ctxFor({ trainingHistory: "regular", split: "ppl", daysPerWeek: 3, minutesPerSession: 30, goal: "strength_muscle" }, { ...fullGym, treadmill: true } as Equipment);
    expect(strengthOf(planWeek(three, 2)).map((s) => s.variant).sort()).toEqual(["legs", "ppl-pull", "ppl-push"].sort());
  });

  // Spec amended: calves count least when filling a short week (walking already loads them), so two
  // 30-minute full-body sessions may still leave them out.
  it("push/pull/legs with 2 lifting days leaves no muscle untrained in weeks 2-5 (calves may be 0 at 30 min or less)", () => {
    const failures: string[] = [];
    for (const history of ["never", "regular"] as TrainingHistory[]) {
      for (const minutes of [20, 30]) {
        const ctx = ctxFor({ trainingHistory: history, split: "ppl", daysPerWeek: 3, minutesPerSession: minutes, goal: "both" });
        for (const week of [2, 3, 4, 5]) {
          const v = weeklyVolume(planWeek(ctx, week));
          for (const m of WORKED) {
            if (minutes <= 30 && m === "calves") continue;
            if (v[m] <= 0) failures.push(`${history} ${minutes}min week ${week}: ${m}`);
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });
});

// =============================================================================================
// 8. Level progression
// =============================================================================================

describe("8. level progression", () => {
  const prof = (h: TrainingHistory): Profile => ({ ...referenceProfile, trainingHistory: h });

  it("progressedLevel: novices at 60 sessions, lapsed at 16, regulars to advanced at 150", () => {
    expect(typeof progressedLevel, "progressedLevel exported from ./level.js").toBe("function");
    const table: [TrainingHistory, number, TrainingLevel][] = [
      ["never", 0, "novice"], ["never", 59, "novice"], ["never", 60, "intermediate"], ["never", 5000, "intermediate"],
      ["a_little", 59, "novice"], ["a_little", 60, "intermediate"],
      ["lapsed", 0, "novice"], ["lapsed", 15, "novice"], ["lapsed", 16, "intermediate"], ["lapsed", 5000, "intermediate"],
      ["regular", 0, "intermediate"], ["regular", 149, "intermediate"], ["regular", 150, "advanced"],
    ];
    for (const [h, n, level] of table) expect(progressedLevel!(prof(h), n), `${h} ${n}`).toBe(level);
  });

  it("makeContext keeps level from onboarding and sets volumeLevel from sessions logged", () => {
    for (const h of HISTORIES) {
      const base = contextMod.makeContext(prof(h), fullGym);
      expect((base as EngineContext & { volumeLevel?: TrainingLevel }).volumeLevel, `${h} volumeLevel with no third arg`).toBe(base.level);
      for (const n of [0, 15, 16, 59, 60, 149, 150]) {
        const ctx = makeContext3(prof(h), fullGym, { strengthSessionsLogged: n });
        expect(ctx.level, `${h} ${n} level`).toBe(base.level);
        expect((ctx as EngineContext & { volumeLevel?: TrainingLevel }).volumeLevel, `${h} ${n} volumeLevel`).toBe(progressedLevel?.(prof(h), n));
      }
    }
  });

  // Spec amended: sessions fill toward what the week is short on, so a promoted plan (more sets
  // allowed) may add different extra pairs. What must not change: the day's main exercises (its
  // opening pairs) and the rep range of every exercise both plans share.
  it("promotion changes volume only: same main exercises and rep ranges in week 2 (never, full gym, 30 min)", () => {
    for (const split of ["full_body", "push_pull", "upper_lower"] as Split[]) {
      const p = { trainingHistory: "never" as TrainingHistory, split, daysPerWeek: 4, minutesPerSession: 30 };
      const a = strengthOf(planWeek(ctxFor(p, fullGym, 0), 2));
      const b = strengthOf(planWeek(ctxFor(p, fullGym, 60), 2));
      expect(b.length).toBe(a.length);
      const opening = (x: SessionPlan) => x.supersets.slice(0, 2).flatMap((ss) => ss.items.map((q) => q.exerciseId)).sort();
      a.forEach((s, i) => {
        expect(opening(b[i]!), `${split} day ${s.dayIndex + 1}`).toEqual(opening(s));
        const ranges = new Map(allPrescriptions(s).map((x) => [x.exerciseId, x.repRange]));
        for (const x of allPrescriptions(b[i]!)) if (ranges.has(x.exerciseId)) expect(x.repRange, `${split} ${x.exerciseId}`).toEqual(ranges.get(x.exerciseId));
      });
    }
  });

  it("a novice at novice volume never gets more than 3 sets of anything", () => {
    const failures: string[] = [];
    for (const { s, pw, where } of strengthSessions()) {
      if (volumeLevelOf(pw.ctx) !== "novice") continue;
      for (const ss of s.supersets) if (ss.rounds > 3 || ss.items.some((p) => p.sets > 3)) failures.push(`${where} ${ss.label}: ${ss.rounds}`);
    }
    for (const minutes of [45, 60, 90]) {
      const ctx = ctxFor({ trainingHistory: "never", split: "full_body", daysPerWeek: 3, minutesPerSession: minutes }, fullGym, 0);
      for (const s of strengthOf(planWeek(ctx, 2))) for (const ss of s.supersets) if (ss.rounds > 3) failures.push(`never ${minutes}min ${ss.label}: ${ss.rounds}`);
    }
    expect(failures).toEqual([]);
  });

  it("a promoted novice plans at intermediate volume (up to 4 rounds, never more)", () => {
    const promoted = ctxFor({ trainingHistory: "never", split: "full_body", daysPerWeek: 3, minutesPerSession: 60 }, fullGym, 60);
    expect(volumeLevelOf(promoted)).toBe("intermediate");
    const maxRounds = Math.max(...strengthOf(planWeek(promoted, 2)).flatMap((s) => s.supersets.map((ss) => ss.rounds)));
    expect(maxRounds).toBeLessThanOrEqual(4);
  });
});

// =============================================================================================
// 9. Fast start
// =============================================================================================

describe("9. fast start", () => {
  const novice = contextMod.makeContext({ ...referenceProfile, trainingHistory: "never" }, adjustableEquipment);
  const intermediate = contextMod.makeContext({ ...referenceProfile, trainingHistory: "regular" }, adjustableEquipment);
  const MOVES = ["load_up", "ladder_up", "widen_range"];
  const goblet = (ctx: EngineContext, timesPerformed: number): ExerciseProgress => ({
    ...freshProgress(getExercise("goblet_squat"), ctx),
    loadKg: lbToKg(20),
    repRange: [8, 15],
    targetReps: 15,
    timesPerformed,
    calibrated: true,
  });
  const topSets = (id: string, loadKg: number | null, hi: number, rir: Rir) => logSets(id, loadKg, [hi, hi, hi], rir);

  it("a novice's first sessions move on after one session at the top of the range", () => {
    for (const t of [0, 1, 5]) {
      for (const rir of [2, 3] as Rir[]) {
        const r = progressExercise(goblet(novice, t), topSets("goblet_squat", lbToKg(20), 15, rir), novice);
        expect(MOVES, `timesPerformed ${t} rir ${rir}: ${r.action}`).toContain(r.action);
      }
    }
    // Bodyweight ladders too.
    const pu = { ...freshProgress(getExercise("incline_push_up"), novice), timesPerformed: 2, calibrated: true };
    const r = progressExercise(pu, topSets("incline_push_up", null, pu.repRange[1], 2), novice);
    expect(MOVES, r.action).toContain(r.action);
  });

  // Spec amended after code review: the fast start is for the novice stage; once promoted, new
  // exercises (a block's alternates included) follow the two-in-a-row rule.
  it("a promoted novice (60 sessions logged) no longer gets the fast start", () => {
    const promoted = makeContext3({ ...referenceProfile, trainingHistory: "never" }, adjustableEquipment, { strengthSessionsLogged: 60 });
    const r = progressExercise(goblet(promoted, 0), topSets("goblet_squat", lbToKg(20), 15, 2), promoted);
    expect(r.action).toBe("hold");
  });

  it("from the 6th time, or for an intermediate, one top session is a hold (two in a row rule)", () => {
    for (const t of [6, 7, 20]) expect(progressExercise(goblet(novice, t), topSets("goblet_squat", lbToKg(20), 15, 2), novice).action, `t=${t}`).toBe("hold");
    for (const t of [0, 3]) expect(progressExercise(goblet(intermediate, t), topSets("goblet_squat", lbToKg(20), 15, 2), intermediate).action, `intermediate t=${t}`).toBe("hold");
  });

  it("no fast start without reps to spare, short of the top, or on a pain check", () => {
    expect(progressExercise(goblet(novice, 0), topSets("goblet_squat", lbToKg(20), 15, 1), novice).action).not.toMatch(/load_up|ladder_up|widen_range/);
    expect(progressExercise(goblet(novice, 0), logSets("goblet_squat", lbToKg(20), [15, 14, 13], 2), novice).action).toBe("add_rep");
    const pain = { ...goblet(novice, 0), painCheck: true };
    expect(progressExercise(pain, topSets("goblet_squat", lbToKg(20), 15, 2), novice).action).toBe("hold");
  });
});

// =============================================================================================
// 10. Rotation
// =============================================================================================

describe("10. rotation", () => {
  const regularFB = { trainingHistory: "regular" as TrainingHistory, split: "full_body" as Split, daysPerWeek: 4, minutesPerSession: 45, goal: "both" as Goal };
  const PARTNERS: Record<string, string> = {
    one_arm_db_row: "db_bent_over_row",
    db_bent_over_row: "one_arm_db_row",
    pull_up: "chin_up",
    chin_up: "pull_up",
    goblet_squat: "db_front_squat",
    db_front_squat: "goblet_squat",
    cable_triceps_pressdown: "cable_overhead_triceps_extension",
    cable_overhead_triceps_extension: "cable_triceps_pressdown",
  };
  const bySlot = (s: SessionPlan) => new Map(allPrescriptions(s).map((p) => [p.slot, p.exerciseId]));

  it("a regular lifter's week 8 differs from week 2 in at least one exercise", () => {
    const ctx = ctxFor(regularFB);
    const w2 = strengthOf(planWeek(ctx, 2)).map(sortedIds);
    const w8 = strengthOf(planWeek(ctx, 8)).map(sortedIds);
    expect(w8).not.toEqual(w2);
  });

  it("weeks 13-18 repeat weeks 1-6, and weeks 19-24 repeat weeks 7-12 (every split)", () => {
    for (const split of ["full_body", "push_pull", "upper_lower", "ppl"] as Split[]) {
      const ctx = ctxFor({ ...regularFB, split, daysPerWeek: 5 });
      expect(strengthOf(planWeek(ctx, 14)).map(sortedIds), `${split} 14 vs 2`).toEqual(strengthOf(planWeek(ctx, 2)).map(sortedIds));
      expect(strengthOf(planWeek(ctx, 20)).map(sortedIds), `${split} 20 vs 8`).toEqual(strengthOf(planWeek(ctx, 8)).map(sortedIds));
    }
  });

  it("rotated exercises keep the slot's pattern, family and load class", () => {
    for (const split of ["full_body", "push_pull", "upper_lower", "ppl"] as Split[]) {
      for (const eq of [fullGym, referenceEquipment, adjustableEquipment]) {
        const ctx = ctxFor({ ...regularFB, split }, eq);
        const w2 = strengthOf(planWeek(ctx, 2));
        const w8 = strengthOf(planWeek(ctx, 8));
        w2.forEach((s, d) => {
          const before = bySlot(s);
          for (const [slot, id] of bySlot(w8[d]!)) {
            const was = before.get(slot);
            if (!was || was === id) continue;
            // An exercise taken by another slot in the other week moves this slot along too (a knock-on
            // of rotation elsewhere, not this slot's own alternate): only a slot's own swap is judged.
            if (idsOf(s).includes(id) || idsOf(w8[d]!).includes(was)) continue;
            const a = getExercise(was);
            const b = getExercise(id);
            const where = `${split} day ${d + 1} ${slot}: ${was} -> ${id}`;
            expect(b.pattern, where).toBe(a.pattern);
            expect(b.family, where).toBe(a.family);
            expect(classOf(b), where).toBe(classOf(a));
          }
        });
      }
    }
  });

  it("known pairs swap in the odd block when the partner is available", () => {
    let swapped = 0;
    for (const eq of [fullGym, adjustableEquipment]) {
      for (const split of ["full_body", "push_pull", "upper_lower"] as Split[]) {
        const ctx = ctxFor({ ...regularFB, split }, eq);
        const plannable = new Set([...ctx.pool.byLadder.values()].flat().map((e) => e.id));
        const w2 = strengthOf(planWeek(ctx, 2));
        const w8 = strengthOf(planWeek(ctx, 8));
        w2.forEach((s, d) => {
          const ids = new Set(idsOf(s));
          const after = bySlot(w8[d]!);
          for (const [slot, id] of bySlot(s)) {
            const partner = PARTNERS[id];
            if (!partner || !plannable.has(partner) || ids.has(partner) || !after.has(slot)) continue;
            expect(after.get(slot), `${split} day ${d + 1} ${slot}: ${id} should rotate`).not.toBe(id);
            swapped++;
          }
        });
      }
    }
    expect(swapped).toBeGreaterThan(0);
  });

  it("a novice keeps the same exercises in week 8 (no rotation at novice volume)", () => {
    for (const split of ["full_body", "push_pull"] as Split[]) {
      const ctx = ctxFor({ ...regularFB, trainingHistory: "never", split }, fullGym, 0);
      expect(strengthOf(planWeek(ctx, 8)).map(sortedIds), split).toEqual(strengthOf(planWeek(ctx, 2)).map(sortedIds));
    }
  });

  it("a promoted novice (60 sessions) does rotate", () => {
    const ctx = ctxFor({ ...regularFB, trainingHistory: "never" }, fullGym, 60);
    expect(strengthOf(planWeek(ctx, 8)).map(sortedIds)).not.toEqual(strengthOf(planWeek(ctx, 2)).map(sortedIds));
  });

  it("new exercises in week 7 carry a benchmark on their first appearance (full body), and week 9 has none", () => {
    const ctx = ctxFor(regularFB);
    const seen = new Set([1, 2, 3, 4, 5, 6].flatMap((w) => strengthOf(planWeek(ctx, w)).flatMap(idsOf)));
    const fresh = strengthOf(planWeek(ctx, 7)).flatMap(items).filter((p) => !seen.has(p.exerciseId) && p.loadType !== "time");
    expect(fresh.length, "week 7 should bring new exercises").toBeGreaterThan(0);
    for (const p of fresh) expect(p.benchmarkSet, p.exerciseId).toBe(true);
    for (const p of strengthOf(planWeek(ctx, 9)).flatMap(items)) expect(p.benchmarkSet, `week 9 ${p.exerciseId}`).toBe(false);
  });

  it("splits benchmark new exercises at their first appearance in weeks 7-8", () => {
    for (const split of ["push_pull", "upper_lower", "ppl"] as Split[]) {
      const ctx = ctxFor({ ...regularFB, split, daysPerWeek: 4 });
      const seen = new Set([1, 2, 3, 4, 5, 6].flatMap((w) => strengthOf(planWeek(ctx, w)).flatMap(idsOf)));
      const firsts = new Map<string, Prescription>();
      for (const s of strengthOf([...planWeek(ctx, 7), ...planWeek(ctx, 8)])) {
        for (const p of items(s)) if (!seen.has(p.exerciseId) && p.loadType !== "time" && !firsts.has(p.exerciseId)) firsts.set(p.exerciseId, p);
      }
      expect(firsts.size, `${split}: weeks 7-8 should bring new exercises`).toBeGreaterThan(0);
      for (const [id, p] of firsts) expect(p.benchmarkSet, `${split} ${id}`).toBe(true);
    }
  });

  it("an exercise with a known e1RM is never benchmarked, rotation or not", () => {
    const ctx = ctxFor(regularFB);
    const ids = [...new Set([2, 8].flatMap((w) => strengthOf(planWeek(ctx, w)).flatMap(idsOf)))];
    const e1rmByExercise = Object.fromEntries(ids.map((id) => [id, 60]));
    for (const w of [1, 7, 8]) {
      for (const p of strengthOf(planWeek(ctx, w, { e1rmByExercise })).flatMap(items)) {
        if (e1rmByExercise[p.exerciseId]) expect(p.benchmarkSet, `week ${w} ${p.exerciseId}`).toBe(false);
      }
    }
  });

  it("rotation weeks with e1RMs still respect every invariant", () => {
    const ctx = ctxFor(regularFB);
    const ids = [...new Set(strengthOf(planWeek(ctx, 2)).flatMap(idsOf))];
    const e1rmByExercise = Object.fromEntries(ids.map((id) => [id, 50]));
    for (const w of [2, 7, 8]) {
      const week = planWeek(ctx, w, { e1rmByExercise });
      const v = weeklyVolume(week);
      for (const m of WORKED) expect(v[m], `week ${w} ${m}`).toBeLessThanOrEqual(volumeCeiling(volumeLevelOf(ctx)) + 1e-9);
      for (const s of strengthOf(week)) {
        expectUnevenSets(s, `e1rm week ${w} day ${s.dayIndex + 1}`);
        expect(new Set(idsOf(s)).size).toBe(idsOf(s).length);
        expect(s.estimatedMinutes).toBeLessThanOrEqual(s.budgetMinutes * 1.05);
      }
    }
  });
});

// =============================================================================================
// 11. Determinism
// =============================================================================================

describe("11. determinism", () => {
  const profiles: [Partial<Profile>, Equipment][] = [
    [{ trainingHistory: "regular", split: "full_body", daysPerWeek: 4, minutesPerSession: 45 }, fullGym],
    [{ trainingHistory: "never", split: "push_pull", daysPerWeek: 5, minutesPerSession: 30 }, referenceEquipment],
    [{ trainingHistory: "lapsed", split: "ppl", daysPerWeek: 3, minutesPerSession: 30 }, fullGym],
  ];

  it("the same call twice gives the same plan", () => {
    for (const [p, eq] of profiles) {
      const ctx = freshCtx(p, eq);
      for (const i of [0, 3, 10, 30]) expect(planSessionWith(ctx, i), `${describeProfile(p)} #${i}`).toEqual(planSessionWith(ctx, i));
    }
  });

  it("plans do not depend on call order or on earlier 'today' overrides", () => {
    for (const [p, eq] of profiles) {
      const a = freshCtx(p, eq);
      const a10 = planSessionWith(a, 10);
      const a3 = planSessionWith(a, 3);
      const b = freshCtx(p, eq);
      const b3 = planSessionWith(b, 3);
      const b10 = planSessionWith(b, 10);
      expect(a3, describeProfile(p)).toEqual(b3);
      expect(a10, describeProfile(p)).toEqual(b10);
      // A long or short "today" on the same context must not leak into the normal plan.
      const c = freshCtx(p, eq);
      planSessionWith(c, 10, { minutes: 90 });
      planSessionWith(c, 10, { minutes: 10 });
      planSessionWith(c, 9, { restSec: 180, transitionSec: 60 });
      planSessionWith(c, 10, { e1rmByExercise: { goblet_squat: 40 } });
      expect(planSessionWith(c, 10), describeProfile(p)).toEqual(b10);
      expect(planSessionWith(c, 3), describeProfile(p)).toEqual(b3);
    }
  });

  it("a context with sessions logged is deterministic too", () => {
    const p = { trainingHistory: "never" as TrainingHistory, split: "full_body" as Split, daysPerWeek: 3, minutesPerSession: 45 };
    const a = freshCtx(p, fullGym, 60);
    const b = freshCtx(p, fullGym, 60);
    planSessionWith(b, 20);
    expect(planSessionWith(a, 4)).toEqual(planSessionWith(b, 4));
  });
});

// =============================================================================================
// 12. "Today" overrides
// =============================================================================================

describe("12. today's minutes", () => {
  const cases: [Partial<Profile>, Equipment, number | undefined][] = [
    [{ trainingHistory: "regular", split: "full_body", daysPerWeek: 3, minutesPerSession: 30 }, fullGym, undefined],
    [{ trainingHistory: "regular", split: "upper_lower", daysPerWeek: 4, minutesPerSession: 45 }, fullGym, undefined],
    [{ trainingHistory: "never", split: "push_pull", daysPerWeek: 4, minutesPerSession: 20 }, referenceEquipment, undefined],
    [{ trainingHistory: "never", split: "full_body", daysPerWeek: 6, minutesPerSession: 30, goal: "strength_muscle" }, fullGym, 60],
    [{ trainingHistory: "a_little", split: "ppl", daysPerWeek: 5, minutesPerSession: 30, goal: "strength_muscle" }, bodyweightOnly, undefined],
    [{ trainingHistory: "regular", split: "full_body", daysPerWeek: 2, minutesPerSession: 45 }, fullGym, 150],
  ];

  it("a shorter or longer day keeps the week under the ceiling, never shrinks a long day, and stays within the time", () => {
    const failures: string[] = [];
    for (const [p, eq, logged] of cases) {
      const ctx = ctxFor(p, eq, logged);
      const ceiling = volumeCeiling(volumeLevelOf(ctx));
      for (const week of [2, 8]) {
        const normal = planWeek(ctx, week);
        normal.forEach((s, d) => {
          if (s.kind !== "strength") return;
          for (const minutes of [10, 15, 60, 90]) {
            const today = planSessionWith(ctx, s.index, { minutes });
            const where = `${describeProfile(p)} week ${week} day ${d + 1} today=${minutes}`;
            const v = weeklyVolume(normal.map((x, i) => (i === d ? today : x)));
            for (const m of WORKED) if (v[m] > ceiling + 1e-9) failures.push(`${where}: ${m} ${v[m]} > ${ceiling}`);
            if (minutes > p.minutesPerSession! && hardSets(today) < hardSets(s)) failures.push(`${where}: ${hardSets(today)} < ${hardSets(s)} hard sets`);
            if (today.estimatedMinutes > minutes * 1.05 + 1e-9) failures.push(`${where}: ${today.estimatedMinutes} min`);
            if (today.supersets.length > 5) failures.push(`${where}: ${today.supersets.length} supersets`);
            if (today.supersets.length === 0) failures.push(`${where}: empty`);
            const ids = idsOf(today);
            if (new Set(ids).size !== ids.length) failures.push(`${where}: repeated exercise`);
            const slots = allPrescriptions(today).map((x) => x.slot);
            if (new Set(slots).size !== slots.length) failures.push(`${where}: repeated slot`);
          }
        });
      }
    }
    expect(failures).toEqual([]);
  });

  it("uneven-set rules hold for today's overrides too", () => {
    const ctx = ctxFor(cases[0]![0], cases[0]![1]);
    for (const minutes of [10, 15, 60, 90]) for (const i of [3, 5]) {
      const s = planSessionWith(ctx, i, { minutes });
      if (s.kind === "strength") expectUnevenSets(s, `today=${minutes} #${i}`);
    }
  });
});

// =============================================================================================
// Edge cases
// =============================================================================================

describe("edge cases", () => {
  it("week 1 ramp (never): same exercises as week 2's plan for that day, a round lighter, never more", () => {
    for (const eq of [fullGym, referenceEquipment, bodyweightOnly]) {
      for (const minutes of [15, 20, 30, 45, 60]) {
        const ctx = ctxFor({ trainingHistory: "never", split: "full_body", daysPerWeek: 4, minutesPerSession: minutes }, eq);
        const w1 = strengthOf(planWeek(ctx, 1));
        const w2 = strengthOf(planWeek(ctx, 2));
        w1.forEach((s, d) => {
          const where = `${minutes}min treadmill=${eq.treadmill} day ${d + 1}`;
          const steady = w2[d]!;
          expect(items(s).map((p) => p.exerciseId).sort(), where).toEqual(items(steady).map((p) => p.exerciseId).sort());
          const steadySets = new Map(items(steady).map((p) => [p.exerciseId, p.sets]));
          for (const p of items(s)) {
            const full = steadySets.get(p.exerciseId)!;
            // Never more than week 2; a round fewer wherever week 2 has three or more.
            expect(p.sets, `${where} ${p.exerciseId} vs week 2 ${full}`).toBeLessThanOrEqual(full >= 3 ? full - 1 : full);
          }
          if (items(steady).some((p) => p.sets >= 3)) expect(hardSets(s), where).toBeLessThan(hardSets(steady));
          else expect(hardSets(s), where).toBeLessThanOrEqual(hardSets(steady));
          expectUnevenSets(s, `${where} ramp`);
        });
      }
    }
  });

  it("week 1 for a never-trained lifter stays under the ceiling", () => {
    for (const split of ["full_body", "push_pull", "upper_lower", "ppl"] as Split[]) {
      const ctx = ctxFor({ trainingHistory: "never", split, daysPerWeek: 6, minutesPerSession: 60, goal: "strength_muscle" });
      const v = weeklyVolume(planWeek(ctx, 1));
      for (const m of WORKED) expect(v[m], `${split} ${m}`).toBeLessThanOrEqual(15 + 1e-9);
    }
  });

  it("all four injuries with bodyweight only still gives every lifting day work, across splits and day counts", () => {
    for (const split of ["full_body", "push_pull", "upper_lower", "ppl"] as Split[]) {
      for (const days of [1, 3, 6]) {
        for (const minutes of [10, 30, 60]) {
          const ctx = ctxFor({ trainingHistory: "never", split, daysPerWeek: days, minutesPerSession: minutes, goal: "strength_muscle", injuries: ["knee", "shoulder", "low_back", "wrist"] }, bodyweightOnly);
          for (const s of strengthOf(planWeek(ctx, 2))) {
            const where = `${split} ${days}d ${minutes}min day ${s.dayIndex + 1}`;
            expect(s.supersets.length, where).toBeGreaterThan(0);
            expect(new Set(idsOf(s)).size, where).toBe(idsOf(s).length);
            expect(s.estimatedMinutes, where).toBeLessThanOrEqual(minutes * 1.05);
            expectUnevenSets(s, where);
          }
        }
      }
    }
  });

  it("one lifting day a week (full body) in a full gym trains squat, horizontal push and row", () => {
    for (const history of ["never", "regular"] as TrainingHistory[]) {
      const ctx = ctxFor({ trainingHistory: history, split: "full_body", daysPerWeek: 1, minutesPerSession: 45 });
      const patterns = new Set(strengthOf(planWeek(ctx, 2)).flatMap(items).map((p) => p.pattern));
      for (const p of ["squat", "horizontal_push", "row"]) expect(patterns.has(p as never), `${history}: ${p}`).toBe(true);
    }
  });

  it("one lifting day a week with push/pull/legs chosen is full body too (squat, horizontal push and row)", () => {
    for (const history of ["never", "regular"] as TrainingHistory[]) {
      for (const split of ["ppl"] as Split[]) {
        const ctx = ctxFor({ trainingHistory: history, split, daysPerWeek: 1, minutesPerSession: 45 });
        const patterns = new Set(strengthOf(planWeek(ctx, 2)).flatMap(items).map((p) => p.pattern));
        for (const p of ["squat", "horizontal_push", "row"]) expect(patterns.has(p as never), `${history} ${split}: ${p}`).toBe(true);
      }
    }
  });

  it("cardio days are untouched by the strength changes", () => {
    const ctx = ctxFor({ trainingHistory: "regular", split: "full_body", daysPerWeek: 6, minutesPerSession: 30, goal: "fitness" });
    for (const s of planWeek(ctx, 2).filter((x) => x.kind === "cardio")) {
      expect(s.supersets).toEqual([]);
      expect(s.finisher).toBeNull();
      expect(s.cardio).not.toBeNull();
    }
  });
});
