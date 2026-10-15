import {
  CAUTION_CLEAR_SESSIONS,
  CAUTION_MAX_DAYS,
  MUSCLES,
  PROMOTION_SESSIONS,
  SORE_GROUP_NAME,
  volumeTarget,
  type ExerciseChange,
} from "@repcurve/engine";
import { findExercise } from "@repcurve/exercises";
import { loadUnitsFor, type Muscle, type TrainingLevel } from "@repcurve/shared";
import { loadText, plural } from "./format";
import { contextFor, currentProgram } from "./plan";
import { profileFor } from "./profile";
import type { Core, SessionRecord } from "./types";

/** Everything the "What RepCurve knows" screen shows, in plain words, with what each line can undo. */
export interface Knows {
  level: {
    /** The level you started at (exercise choice and starting weights). */
    started: string;
    /** The level the weekly volume is set for now. */
    volume: string;
    target: [number, number];
    /** The next step up in volume and how many more strength sessions it takes, if there is one. */
    next: { level: string; sessions: number } | null;
  };
  /** Hard sets per muscle in a week of the current plan (a secondary muscle counts half). */
  weeklySets: { muscle: Muscle; name: string; sets: number }[];
  cautions: { area: string; title: string; detail: string; changes: string; lifts: string | null }[];
  swaps: { exerciseId: string; name: string; what: string; action: "Bring it back" | "Forget this" }[];
  soreness: { group: Muscle; name: string; text: string }[];
  weights: { exerciseId: string; name: string; now: string; trend: string; retesting: boolean; canRetest: boolean }[];
}

const LEVEL_NAME: Record<TrainingLevel, string> = { novice: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };
const shortDate = (t: number) => new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });
const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);
const nameOf = (id: string) => findExercise(id)?.name ?? id;

const TREND: Partial<Record<ExerciseChange["action"], string>> = {
  add_rep: "Going up",
  load_up: "Going up",
  ladder_up: "Going up",
  widen_range: "Going up",
  maxed_out: "Topped out",
  hold: "Holding steady",
  stall_noted: "Holding steady",
  deload: "Holding steady",
  comeback: "Holding steady",
  load_down: "Eased off",
  ladder_down: "Eased off",
  pain: "Eased off after pain",
  calibrated: "Set by a benchmark",
};

export function whatRepCurveKnows(core: Core, history: SessionRecord[], now: number): Knows {
  const profile = profileFor(core, history, now);
  const ctx = contextFor(core);
  const logged = core.state.strengthSessionsLogged;
  const units = loadUnitsFor(core.profile, core.equipment);

  // The next volume step, as progressedLevel takes it.
  let next: Knows["level"]["next"] = null;
  if (ctx.level === "novice" && ctx.volumeLevel === "novice") {
    const needed = core.profile.trainingHistory === "lapsed" ? PROMOTION_SESSIONS.fromLapsed : PROMOTION_SESSIONS.fromNever;
    next = { level: LEVEL_NAME.intermediate, sessions: Math.max(1, needed - logged) };
  } else if (ctx.level === "intermediate" && ctx.volumeLevel === "intermediate") {
    next = { level: LEVEL_NAME.advanced, sessions: Math.max(1, PROMOTION_SESSIONS.toAdvanced - logged) };
  }

  const volume = currentProgram(core).weeklyVolume;
  const weeklySets = MUSCLES.filter((m) => volume[m] > 0).map((m) => ({ muscle: m, name: SORE_GROUP_NAME[m], sets: Math.round(volume[m] * 2) / 2 }));

  const cautions = profile.cautions
    .filter((c) => c.active)
    .map((c) => {
      const area = c.area.toLowerCase();
      return {
        area: c.area,
        title: c.area,
        detail: `Pain flagged ${times(c.reports)}, ${c.reports === 1 ? `on ${shortDate(c.lastReportAt)}` : `since ${shortDate(c.firstReportAt)}, last on ${shortDate(c.lastReportAt)}`}.`,
        changes: c.injury
          ? `Exercises that work your ${area} get a check-in first, skip test sets and don't get heavier.`
          : `Noted for your record. No exercise is marked as hard on the ${area}, so the plan doesn't change.`,
        lifts: c.injury
          ? `Lifts after ${CAUTION_CLEAR_SESSIONS} pain-free sessions or ${CAUTION_MAX_DAYS / 7} weeks. Pain-free so far: ${c.painFreeSessions} of ${CAUTION_CLEAR_SESSIONS}.`
          : null,
      };
    });

  const { disliked, tooHard, unstable, swappedFor } = profile.preferences;
  const swapIds = [...new Set([...disliked, ...Object.keys(tooHard), ...Object.keys(unstable)])];
  const swaps = swapIds.map((id) => {
    const reasons: string[] = [];
    if (disliked.includes(id)) reasons.push("You don't like it");
    if (tooHard[id]) reasons.push(`Too hard (${times(tooHard[id]!)})`);
    if (unstable[id]) reasons.push(`Couldn't balance (${times(unstable[id]!)})`);
    const to = swappedFor[id];
    const what = `${reasons.join(". ")}.${to ? ` Swapped for ${nameOf(to)} from now on.` : ""}`;
    return { exerciseId: id, name: nameOf(id), what, action: to ? ("Bring it back" as const) : ("Forget this" as const) };
  });

  const soreness = profile.soreness
    .filter((r) => r.sore > 0)
    .map((r) => {
      const name = SORE_GROUP_NAME[r.group];
      const last = r.lastLevel === "none" ? "not sore" : r.lastLevel === "bit" ? "a bit sore" : "very sore";
      return { group: r.group, name, text: `Still sore at ${r.sore} of ${plural(r.asked, "check-in")}. Last time: ${last}${r.streak > 1 ? `, ${r.streak} in a row` : ""}.` };
    });

  // Working weights, most recently done first.
  const lastDone = new Map<string, number>();
  const lastChange = new Map<string, ExerciseChange>();
  for (const r of history) {
    if (r.skipped) continue;
    for (const s of r.sets) lastDone.set(s.exerciseId, r.finishedAt);
    for (const c of r.changes) if (c.action !== "skipped") lastChange.set(c.exerciseId, c);
  }
  const retesting = new Set(profile.rebenchmark);
  const weights = Object.values(core.state.exercises)
    .filter((p) => findExercise(p.exerciseId) && p.timesPerformed > 0)
    .sort((a, b) => (lastDone.get(b.exerciseId) ?? 0) - (lastDone.get(a.exerciseId) ?? 0))
    .map((p) => {
      const e = findExercise(p.exerciseId)!;
      const reps = e.loadType === "time" ? `${p.targetReps} s` : `${p.targetReps} reps`;
      const load = p.loadKg !== null ? `${loadText(p.loadKg, e.loadType, units)} × ` : "";
      const isRetesting = retesting.has(p.exerciseId);
      return {
        exerciseId: p.exerciseId,
        name: e.name,
        now: `${load}${reps}${e.unilateral ? " per side" : ""} · range ${p.repRange[0]}–${p.repRange[1]}`,
        trend: isRetesting ? "Re-testing on your next full session" : (TREND[lastChange.get(p.exerciseId)?.action ?? "hold"] ?? "Holding steady"),
        retesting: isRetesting,
        canRetest: e.loadType !== "time" && !isRetesting,
      };
    });

  return {
    level: { started: LEVEL_NAME[ctx.level], volume: LEVEL_NAME[ctx.volumeLevel], target: volumeTarget(ctx.volumeLevel), next },
    weeklySets,
    cautions,
    swaps,
    soreness,
    weights,
  };
}
