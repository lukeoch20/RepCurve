import { STARTING_LOAD_RATIO, getExercise } from "@repcurve/exercises";
import { e1RM, formatLoad, nextOwnedLoad, prevOwnedLoad, repsAtLoad, roundDownToOwned } from "@repcurve/shared";
import type { Exercise, Rir, SetLog } from "@repcurve/shared";
import type { EngineContext } from "./context.js";
import { isLoaded, repRangeFor, startingLoadKg } from "./loads.js";
import { MAX_HOLD_SEC, MAX_REPS, TARGET_RIR, clamp, defaultTargetReps } from "./prescribe.js";

/** Everything the engine remembers about one exercise between sessions. */
export interface ExerciseProgress {
  exerciseId: string;
  /** kg per dumbbell; null for bodyweight, band and time exercises. */
  loadKg: number | null;
  repRange: [number, number];
  targetRir: Rir;
  /** Reps (or seconds) each set is pre-filled with next time. */
  targetReps: number;
  /** Consecutive sessions that were too hard. */
  stalls: number;
  /** Estimated 1RM from the most recent session, kg per dumbbell. */
  e1rmKg: number | null;
  /** Best estimated 1RM ever seen, kg per dumbbell. */
  bestE1rmKg: number | null;
  /** True once a benchmark set has set this exercise's working weight. */
  calibrated: boolean;
  timesPerformed: number;
  /** Set once the user has outgrown every progression their equipment allows on this exercise. */
  maxedOut?: boolean;
}

export type ProgressionAction =
  | "hold"
  | "add_rep"
  | "load_up"
  | "ladder_up"
  | "widen_range"
  | "load_down"
  | "ladder_down"
  | "stall_noted"
  | "calibrated"
  | "pain"
  | "maxed_out";

export interface ProgressionResult {
  /** What to do next time. Its exerciseId differs from the input on ladder moves. */
  next: ExerciseProgress;
  /** Updated record for the exercise that was performed. Equal to `next` unless the exercise changed. */
  performed: ExerciseProgress;
  action: ProgressionAction;
  reason: string;
}

export function freshProgress(e: Exercise, ctx: EngineContext): ExerciseProgress {
  const repRange = repRangeFor(e, ctx.level);
  return {
    exerciseId: e.id,
    loadKg: startingLoadKg(e, ctx.profile, ctx.equipment, ctx.level, repRange, TARGET_RIR),
    repRange,
    targetRir: TARGET_RIR,
    targetReps: defaultTargetReps(repRange, e.loadType),
    stalls: 0,
    e1rmKg: null,
    bestE1rmKg: null,
    calibrated: false,
    timesPerformed: 0,
  };
}

/** Nearest exercise up (1) or down (-1) the same ladder that the user can do. Skips missing rungs. */
export function ladderNeighbour(e: Exercise, ctx: EngineContext, dir: 1 | -1): Exercise | null {
  const ladder = ctx.pool.byLadder.get(e.ladder) ?? [];
  const candidates = ladder.filter((x) => (dir === 1 ? x.ladderLevel > e.ladderLevel : x.ladderLevel < e.ladderLevel));
  if (candidates.length === 0) return null;
  return dir === 1 ? candidates[0]! : candidates[candidates.length - 1]!;
}

/** Easiest exercise of the same pattern on a different ladder, for when something hurts. */
export function alternativeOnOtherLadder(e: Exercise, ctx: EngineContext): Exercise | null {
  const others = ctx.pool.exercises
    .filter((x) => x.pattern === e.pattern && x.ladder !== e.ladder)
    .sort((a, b) => a.ladderLevel - b.ladderLevel);
  return others[0] ?? null;
}

/**
 * Load for `to` that matches the effort of `loadKg` on `from`, using the
 * exercises' relative starting-load ratios. Rounded down to an owned dumbbell.
 */
export function convertLoad(from: Exercise, to: Exercise, loadKg: number | null, ctx: EngineContext): number | null {
  if (!isLoaded(to)) return null;
  const rf = STARTING_LOAD_RATIO[from.id]?.[ctx.profile.sex];
  const rt = STARTING_LOAD_RATIO[to.id]?.[ctx.profile.sex];
  if (loadKg !== null && isLoaded(from) && rf && rt) return roundDownToOwned((loadKg * rt) / rf, ctx.ownedLoadsKg);
  return startingLoadKg(to, ctx.profile, ctx.equipment, ctx.level, repRangeFor(to, ctx.level), TARGET_RIR);
}

function maxFor(e: Exercise): number {
  return e.loadType === "time" ? MAX_HOLD_SEC : MAX_REPS;
}

function sessionE1rm(sets: SetLog[]): number | null {
  let best: number | null = null;
  for (const s of sets) {
    if (s.loadKg === null || s.reps <= 0) continue;
    const v = e1RM(s.loadKg, s.reps, s.rir);
    if (best === null || v > best) best = v;
  }
  return best;
}

const maxOrNull = (a: number | null, b: number | null): number | null =>
  a === null ? b : b === null ? a : Math.max(a, b);

function setsFor(progress: ExerciseProgress, logs: SetLog[]): SetLog[] {
  return logs.filter((l) => l.exerciseId === progress.exerciseId).sort((a, b) => a.setIndex - b.setIndex);
}

/** Progress for a different exercise after a ladder move or a swap. */
function moveTo(to: Exercise, loadKg: number | null, ctx: EngineContext, targetAt: "bottom" | "comfortable"): ExerciseProgress {
  const repRange = repRangeFor(to, ctx.level);
  return {
    exerciseId: to.id,
    loadKg: isLoaded(to) ? loadKg : null,
    repRange,
    targetRir: TARGET_RIR,
    targetReps: targetAt === "bottom" ? repRange[0] : defaultTargetReps(repRange, to.loadType),
    stalls: 0,
    e1rmKg: null,
    bestE1rmKg: null,
    calibrated: false,
    timesPerformed: 0,
  };
}

function widen(e: Exercise, performed: ExerciseProgress, why: string): ProgressionResult {
  const [lo, hi] = performed.repRange;
  const step = e.loadType === "time" ? 15 : 3;
  const newHi = Math.min(maxFor(e), hi + step);
  if (newHi === hi) {
    const next = { ...performed, stalls: 0, targetReps: hi, maxedOut: true };
    if (performed.maxedOut) {
      return { next, performed: next, action: "hold", reason: "Same again: slow 3-second lowering, pause at the bottom." };
    }
    return {
      next,
      performed: next,
      action: "maxed_out",
      reason: `You've outgrown what your equipment allows on ${e.name}. Slow the lowering to 3 seconds and pause at the bottom, or consider heavier dumbbells.`,
    };
  }
  const next = { ...performed, repRange: [lo, newHi] as [number, number], stalls: 0, targetReps: Math.min(newHi, hi + 1) };
  return { next, performed: next, action: "widen_range", reason: why };
}

/**
 * Between-session progression for one exercise (double progression with
 * dumbbell-aware steps). Loads follow what the user actually lifted: the last
 * set's load is the working load, so mid-session changes carry forward.
 */
export function progressExercise(progress: ExerciseProgress, logs: SetLog[], ctx: EngineContext): ProgressionResult {
  const all = setsFor(progress, logs);
  if (all.length === 0) return { next: progress, performed: progress, action: "hold", reason: "No sets logged." };

  const e = getExercise(progress.exerciseId);
  const units = ctx.profile.units;
  const workingLoad = isLoaded(e) ? (all[all.length - 1]!.loadKg ?? progress.loadKg) : null;
  const atWorking = isLoaded(e) ? all.filter((s) => s.loadKg === workingLoad) : all;
  // Imported or hand-edited logs may have no set at the working load; judge them all then.
  const sets = atWorking.length > 0 ? atWorking : all;
  // After a mid-session weight change the old rep target belonged to the old weight.
  const loadChanged = isLoaded(e) && workingLoad !== null && progress.loadKg !== null && Math.abs(workingLoad - progress.loadKg) > 1e-6;
  const [lo, hi] = progress.repRange;
  const rirT = progress.targetRir;
  const avgRir = sets.reduce((s, x) => s + x.rir, 0) / sets.length;
  const minReps = Math.min(...sets.map((s) => s.reps));
  const allTop = sets.every((s) => s.reps >= hi);
  // Reps fall off across superset rounds, so one tired last set is normal. Too hard means
  // the freshest set missed the range, most sets did, or effort ran to failure.
  const below = sets.filter((s) => s.reps < lo).length;
  const tooHard = sets[0]!.reps < lo || below > sets.length / 2 || avgRir < rirT - 1;
  const e1 = sessionE1rm(sets);

  const performed: ExerciseProgress = {
    ...progress,
    loadKg: workingLoad,
    e1rmKg: e1 ?? progress.e1rmKg,
    bestE1rmKg: maxOrNull(progress.bestE1rmKg, e1),
    timesPerformed: progress.timesPerformed + 1,
  };
  const same = (patch: Partial<ExerciseProgress>, action: ProgressionAction, reason: string): ProgressionResult => {
    const next = { ...performed, ...patch };
    return { next, performed: next, action, reason };
  };
  const move = (to: Exercise, loadKg: number | null, action: ProgressionAction, reason: string, targetAt: "bottom" | "comfortable"): ProgressionResult => ({
    next: moveTo(to, loadKg, ctx, targetAt),
    performed: { ...performed, stalls: 0 },
    action,
    reason,
  });

  if (all.some((s) => s.painFlag)) {
    const alt = ladderNeighbour(e, ctx, -1) ?? alternativeOnOtherLadder(e, ctx);
    if (alt) {
      return move(alt, convertLoad(e, alt, workingLoad, ctx), "pain",
        `You flagged pain on ${e.name}, so next time it's ${alt.name}. If the pain keeps coming back, stop and get it checked.`, "comfortable");
    }
    const lighter = workingLoad !== null ? prevOwnedLoad(workingLoad, ctx.ownedLoadsKg) ?? workingLoad : null;
    return same({ loadKg: lighter, stalls: 0, targetReps: lo }, "pain",
      "You flagged pain: lighter and fewer reps next time. If it keeps hurting, skip it and get it checked.");
  }

  if (tooHard) {
    const stalls = progress.stalls + 1;
    if (stalls < 2) {
      return same({ stalls }, "stall_noted", "That one was tough. Same plan next time; if it's tough again we'll ease off.");
    }
    if (isLoaded(e) && workingLoad !== null) {
      const prev = prevOwnedLoad(workingLoad, ctx.ownedLoadsKg);
      if (prev !== null) {
        const target = e1 !== null ? clamp(repsAtLoad(e1, prev) - rirT, lo, hi) : clamp(lo + 2, lo, hi);
        return same({ loadKg: prev, stalls: 0, targetReps: target }, "load_down",
          `Two tough sessions in a row: dropping to ${formatLoad(prev, e.loadType, units)} and rebuilding reps.`);
      }
    }
    const down = ladderNeighbour(e, ctx, -1);
    if (down) {
      return move(down, convertLoad(e, down, workingLoad, ctx), "ladder_down",
        `Two tough sessions in a row: switching to ${down.name} to rebuild.`, "comfortable");
    }
    return same({ stalls: 0, targetReps: lo }, "hold", "Tough twice, but there's nothing easier here: same setup, aim for the bottom of the range.");
  }

  if (allTop && avgRir >= rirT) {
    if (isLoaded(e) && workingLoad !== null) {
      const next = nextOwnedLoad(workingLoad, ctx.ownedLoadsKg);
      if (next !== null && e1 !== null) {
        const reachable = repsAtLoad(e1, next) - rirT;
        if (reachable >= lo) {
          return same({ loadKg: next, stalls: 0, targetReps: clamp(reachable, lo, hi) }, "load_up",
            `Top of the range with reps to spare: up to ${formatLoad(next, e.loadType, units)}.`);
        }
      }
      const up = ladderNeighbour(e, ctx, 1);
      if (up) {
        const why = next === null ? "you've maxed out your dumbbells here" : "the next dumbbell is too big a jump";
        return move(up, convertLoad(e, up, workingLoad, ctx), "ladder_up", `You own this rep range and ${why}: moving up to ${up.name}.`, "bottom");
      }
      return widen(e, performed, next === null
        ? "Heaviest dumbbell and the hardest version you can do here: building more reps."
        : "The next dumbbell is too big a jump for now: building more reps first.");
    }
    const up = ladderNeighbour(e, ctx, 1);
    if (up) return move(up, convertLoad(e, up, null, ctx), "ladder_up", `You own this rep range: moving up to ${up.name}.`, "bottom");
    return widen(e, performed, e.loadType === "time" ? "Holding longer next time." : "Hardest version available here: building more reps.");
  }

  // One more rep, plus any reps the user said they had left beyond the target.
  const reserve = Math.max(0, Math.floor(avgRir - rirT));
  const target = clamp(Math.max(loadChanged ? 0 : progress.targetReps, minReps + 1 + reserve), lo, hi);
  return same({ stalls: 0, targetReps: target }, "add_rep",
    e.loadType === "time" ? "Same hold next time; add a few seconds if you can." : "Same weight next time; aim for one more rep.");
}

/**
 * Set the working weight (or rung) from a benchmark set: the first set of an
 * exercise in week 1, done for as many good reps as possible stopping about
 * two short of failure.
 */
export function calibrate(progress: ExerciseProgress, logs: SetLog[], ctx: EngineContext): ProgressionResult {
  const all = setsFor(progress, logs);
  const first = all[0];
  if (!first) return { next: progress, performed: progress, action: "hold", reason: "No sets logged." };
  if (all.some((s) => s.painFlag)) return progressExercise(progress, logs, ctx);

  const e = getExercise(progress.exerciseId);
  const units = ctx.profile.units;
  const [lo, hi] = progress.repRange;
  const rirT = progress.targetRir;
  const e1 = sessionE1rm(all);
  const base: ExerciseProgress = {
    ...progress,
    e1rmKg: e1 ?? progress.e1rmKg,
    bestE1rmKg: maxOrNull(progress.bestE1rmKg, e1),
    calibrated: true,
    stalls: 0,
    timesPerformed: progress.timesPerformed + 1,
  };
  const same = (patch: Partial<ExerciseProgress>, reason: string): ProgressionResult => {
    const next = { ...base, ...patch };
    return { next, performed: next, action: "calibrated", reason };
  };
  const move = (to: Exercise, loadKg: number | null, reason: string): ProgressionResult => ({
    next: moveTo(to, loadKg, ctx, "comfortable"),
    performed: base,
    action: "calibrated",
    reason,
  });

  if (isLoaded(e) && e1 !== null) {
    const owned = ctx.ownedLoadsKg;
    let chosen: number | null = null;
    for (const w of owned) if (repsAtLoad(e1, w) - rirT >= lo) chosen = w;
    if (chosen === null) {
      const down = ladderNeighbour(e, ctx, -1);
      if (down) return move(down, convertLoad(e, down, owned[0] ?? null, ctx), `Benchmark: ${e.name} is heavy for now, so you'll start with ${down.name}.`);
      const lightest = owned[0] ?? first.loadKg;
      return same({ loadKg: lightest, targetReps: lo }, `Benchmark: working weight ${formatLoad(lightest, e.loadType, units)}, aim for ${lo} reps.`);
    }
    const capacity = repsAtLoad(e1, chosen) - rirT;
    if (capacity > hi && chosen === owned[owned.length - 1]) {
      const up = ladderNeighbour(e, ctx, 1);
      if (up) return move(up, convertLoad(e, up, chosen, ctx), `Benchmark: your heaviest dumbbell is light for ${e.name}, so you'll move up to ${up.name}.`);
      const newHi = Math.min(MAX_REPS, capacity);
      return same({ loadKg: chosen, repRange: [lo, newHi], targetReps: newHi },
        `Benchmark: your heaviest dumbbell is light here, so sets run longer (up to ${newHi} reps).`);
    }
    const target = clamp(capacity, lo, hi);
    return same({ loadKg: chosen, targetReps: target },
      `Benchmark: working weight ${formatLoad(chosen, e.loadType, units)}, aim for ${target} reps.`);
  }

  // Bodyweight and band exercises: the benchmark sets the rung and the rep target.
  const capacity = first.reps + first.rir - rirT;
  if (capacity > hi) {
    const up = ladderNeighbour(e, ctx, 1);
    if (up) return move(up, convertLoad(e, up, null, ctx), `Benchmark: ${e.name} is easy for you, so you'll start on ${up.name}.`);
    const newHi = Math.min(maxFor(e), capacity);
    return same({ repRange: [lo, newHi], targetReps: newHi }, `Benchmark: aim for ${newHi} reps.`);
  }
  if (capacity < lo) {
    const down = ladderNeighbour(e, ctx, -1);
    if (down) return move(down, convertLoad(e, down, null, ctx), `Benchmark: ${e.name} is hard for now, so you'll build up with ${down.name}.`);
    return same({ targetReps: lo }, `Benchmark: aim for ${lo} reps, fewer is fine while you build up.`);
  }
  return same({ targetReps: capacity }, `Benchmark: aim for ${capacity} reps.`);
}
