import { getExercise } from "@repcurve/exercises";
import { prevOwnedLoad, roundDownToOwned } from "@repcurve/shared";
import type { Exercise, SetLog } from "@repcurve/shared";
import type { EngineContext } from "./context.js";
import { isLoaded, repRangeFor, startingLoadKg } from "./loads.js";
import {
  calibrate,
  freshProgress,
  progressExercise,
  type ExerciseProgress,
  type ProgressionAction,
  type ProgressionResult,
} from "./progression.js";
import { TARGET_RIR, buildPrescription, clamp, defaultTargetReps } from "./prescribe.js";
import { finisherMinutes, supersetSeconds } from "./timing.js";
import type { Prescription, SessionPlan, Superset } from "./types.js";

/** Everything that carries over from one session to the next. Plain JSON, safe to persist. */
export interface TrainingState {
  version: 1;
  /**
   * Programmed exercise → exercise the user does instead, after ladder moves,
   * pain swaps or a "always use this instead" choice. Never chained.
   */
  substitutions: Record<string, string>;
  exercises: Record<string, ExerciseProgress>;
  /** Strength sessions left in the current deload. */
  deloadRemaining: number;
  /** Share of "grinder" sets (0 left in the tank, or below the rep range) in recent strength sessions. */
  strain: number[];
  strengthSessionsLogged: number;
}

export function initialTrainingState(): TrainingState {
  return { version: 1, substitutions: {}, exercises: {}, deloadRemaining: 0, strain: [], strengthSessionsLogged: 0 };
}

/** Days off after which the next strength session eases you back in. */
export const COMEBACK_DAYS = 14;

export function resolveExercise(state: TrainingState, programmedId: string): string {
  return state.substitutions[programmedId] ?? programmedId;
}

function cloneState(s: TrainingState): TrainingState {
  return JSON.parse(JSON.stringify(s)) as TrainingState;
}

/** Every programmed exercise currently resolving to `fromId` resolves to `toId` from now on. */
function redirect(state: TrainingState, fromId: string, toId: string): void {
  const programmed = new Set<string>([fromId, ...Object.keys(state.substitutions)]);
  const moving = [...programmed].filter((x) => resolveExercise(state, x) === fromId);
  for (const x of moving) {
    if (x === toId) delete state.substitutions[x];
    else state.substitutions[x] = toId;
  }
}

/** "Always do this instead": a permanent swap from the current exercise to another. */
export function preferExercise(state: TrainingState, currentId: string, newId: string): TrainingState {
  const next = cloneState(state);
  redirect(next, currentId, newId);
  return next;
}

export function prescriptionsOf(session: SessionPlan): Prescription[] {
  return [...session.supersets.flatMap((ss) => ss.items), ...(session.finisher ? [session.finisher] : [])];
}

function ownedOrRounded(loadKg: number, ctx: EngineContext): number {
  if (ctx.ownedLoadsKg.some((w) => Math.abs(w - loadKg) < 1e-6)) return loadKg;
  return roundDownToOwned(loadKg, ctx.ownedLoadsKg) ?? loadKg;
}

/** A prescription for `exercise` in `slot`, using what the state remembers about it. */
export function prescriptionFor(
  exercise: Exercise,
  slot: string,
  sets: number,
  state: TrainingState,
  ctx: EngineContext,
  fallback?: Prescription,
): Prescription {
  const progress = state.exercises[exercise.id];
  const repRange = progress?.repRange ?? fallback?.repRange ?? repRangeFor(exercise, ctx.level);
  let loadKg: number | null = null;
  if (isLoaded(exercise) && ctx.ownedLoadsKg.length > 0) {
    const remembered = progress?.loadKg ?? fallback?.loadKg ?? null;
    loadKg = remembered !== null
      ? ownedOrRounded(remembered, ctx)
      : startingLoadKg(exercise, ctx.profile, ctx.equipment, ctx.level, repRange, TARGET_RIR);
  }
  const targetReps = clamp(
    progress?.targetReps ?? fallback?.targetReps ?? defaultTargetReps(repRange, exercise.loadType),
    repRange[0],
    repRange[1],
  );
  return buildPrescription({
    exercise,
    slot,
    sets,
    repRange,
    targetReps,
    loadKg,
    targetRir: progress?.targetRir ?? TARGET_RIR,
    benchmarkSet: false,
    units: ctx.profile.units,
  });
}

function lighter(p: Prescription, ctx: EngineContext): Prescription {
  if (p.loadKg === null) return { ...p, benchmarkSet: false };
  const prev = prevOwnedLoad(p.loadKg, ctx.ownedLoadsKg);
  const e = getExercise(p.exerciseId);
  if (prev === null) return { ...p, benchmarkSet: false };
  return buildPrescription({
    exercise: e,
    slot: p.slot,
    sets: p.sets,
    repRange: p.repRange,
    targetReps: p.targetReps,
    loadKg: prev,
    targetRir: p.targetRir,
    benchmarkSet: false,
    units: ctx.profile.units,
  });
}

/**
 * Shrink a strength session until it fits its time budget: drop rounds from
 * the last superset first (not below two), then the finisher, then whole
 * supersets. Needed when swaps or ladder moves bring in slower exercises.
 */
export function fitToBudget(session: SessionPlan): SessionPlan {
  if (session.kind !== "strength") return session;
  const supersets: Superset[] = session.supersets.map((ss) => ({ ...ss, items: ss.items.map((p) => ({ ...p })) }));
  let finisher = session.finisher;
  const finisherMin = finisherMinutes(session.budgetMinutes);
  const secsFor = (ss: Superset) =>
    supersetSeconds(ss.items.map((p) => ({ exercise: getExercise(p.exerciseId), repRange: p.repRange })), ss.rounds, ss.transitionSec, ss.restSec);
  const total = () => session.warmupMinutes + supersets.reduce((s, ss) => s + secsFor(ss), 0) / 60 + (finisher ? finisherMin : 0);
  const setRounds = (ss: Superset, rounds: number) => {
    ss.rounds = rounds;
    for (const p of ss.items) p.sets = rounds;
  };
  while (total() > session.budgetMinutes + 1e-9) {
    const reducible = [...supersets].reverse().find((ss) => ss.rounds > 2);
    if (reducible) setRounds(reducible, reducible.rounds - 1);
    else if (finisher) finisher = null;
    else if (supersets.length > 1) supersets.pop();
    else if (supersets[0] && supersets[0].rounds > 1) setRounds(supersets[0], supersets[0].rounds - 1);
    else break;
  }
  for (const ss of supersets) ss.estimatedSec = secsFor(ss);
  return { ...session, supersets, finisher, estimatedMinutes: Math.round(total() * 10) / 10 };
}

export interface ApplyOptions {
  /** Days since the last logged strength session; a long break eases you back in. */
  daysSinceLastStrength?: number;
}

/**
 * Personalise a planned session with what the training state remembers:
 * substituted exercises, working weights, rep targets, deloads and comebacks.
 */
export function applyState(session: SessionPlan, state: TrainingState, ctx: EngineContext, opts: ApplyOptions = {}): SessionPlan {
  if (session.kind !== "strength") return session;
  const deload = state.deloadRemaining > 0;
  const comeback = !deload && state.strengthSessionsLogged > 0 && (opts.daysSinceLastStrength ?? 0) >= COMEBACK_DAYS;
  const easier = deload || comeback;
  const inPool = new Set(ctx.pool.exercises.map((e) => e.id));
  const used = new Set<string>();

  const remap = (p: Prescription, sets: number): Prescription => {
    let id = resolveExercise(state, p.exerciseId);
    if (!inPool.has(id) || used.has(id)) id = p.exerciseId;
    used.add(id);
    const exercise = getExercise(id);
    let np = prescriptionFor(exercise, p.slot, sets, state, ctx, id === p.exerciseId ? p : undefined);
    np.benchmarkSet = p.benchmarkSet && !easier && !(state.exercises[id]?.calibrated ?? false);
    if (easier) np = lighter(np, ctx);
    return np;
  };

  const supersets = session.supersets.map((ss) => {
    const rounds = easier ? Math.max(1, ss.rounds - 1) : ss.rounds;
    return { ...ss, rounds, items: ss.items.map((p) => remap(p, rounds)) };
  });
  const finisher = session.finisher ? remap(session.finisher, session.finisher.sets) : null;
  return fitToBudget({ ...session, supersets, finisher, deload, comeback });
}

/** Other exercises that train the same movement and that the user can do with their equipment. */
export function alternativesFor(p: Prescription, ctx: EngineContext, excludeIds: string[] = []): Exercise[] {
  const exclude = new Set([p.exerciseId, ...excludeIds]);
  return ctx.pool.exercises
    .filter((e) => e.pattern === p.pattern && !exclude.has(e.id))
    .sort((a, b) => (a.ladder === b.ladder ? a.ladderLevel - b.ladderLevel : a.ladder.localeCompare(b.ladder)));
}

/** Swap an exercise for this session only, keeping the slot and the number of sets. */
export function swapPrescription(p: Prescription, newExerciseId: string, state: TrainingState, ctx: EngineContext): Prescription {
  return prescriptionFor(getExercise(newExerciseId), p.slot, p.sets, state, ctx);
}

export interface ExerciseChange {
  slot: string;
  exerciseId: string;
  nextExerciseId: string;
  action: ProgressionAction | "skipped" | "deload" | "comeback";
  reason: string;
  next: { loadKg: number | null; targetReps: number; repRange: [number, number] };
}

export interface RecordResult {
  state: TrainingState;
  changes: ExerciseChange[];
  deloadStarted: boolean;
  deloadFinished: boolean;
}

function progressFromPrescription(p: Prescription, ctx: EngineContext): ExerciseProgress {
  return {
    ...freshProgress(getExercise(p.exerciseId), ctx),
    loadKg: p.loadKg,
    repRange: p.repRange,
    targetRir: p.targetRir,
    targetReps: p.targetReps,
  };
}

/** Grinder share above which a session counts as strained, and how many in a row trigger a deload. */
export const STRAIN_THRESHOLD = 0.5;
export const STRAINED_SESSIONS_FOR_DELOAD = 3;

/**
 * Fold a finished strength session into the training state: progress each
 * exercise, apply ladder moves everywhere that exercise is programmed, and
 * start a reactive deload when recent sessions have been grinds.
 */
export function recordSession(state: TrainingState, session: SessionPlan, logs: SetLog[], ctx: EngineContext): RecordResult {
  if (session.kind !== "strength") return { state, changes: [], deloadStarted: false, deloadFinished: false };
  const next = cloneState(state);
  const changes: ExerciseChange[] = [];
  const prescriptions = prescriptionsOf(session);

  for (const p of prescriptions) {
    const sets = logs.filter((l) => l.exerciseId === p.exerciseId);
    const progress = next.exercises[p.exerciseId] ?? progressFromPrescription(p, ctx);
    const snapshot = (x: ExerciseProgress) => ({ loadKg: x.loadKg, targetReps: x.targetReps, repRange: x.repRange });
    if (sets.length === 0) {
      changes.push({ slot: p.slot, exerciseId: p.exerciseId, nextExerciseId: p.exerciseId, action: "skipped", reason: "Not logged this time.", next: snapshot(progress) });
      continue;
    }

    let result: ProgressionResult;
    let action: ExerciseChange["action"];
    if (session.deload || session.comeback) {
      // Easier sessions don't move anything; they only refresh the strength estimate.
      const fromThis = progressExercise(progress, sets, ctx).performed;
      const performed = { ...progress, e1rmKg: fromThis.e1rmKg, bestE1rmKg: fromThis.bestE1rmKg, timesPerformed: progress.timesPerformed + 1 };
      if (session.comeback) {
        // Restart from what you actually lifted today, then progress from there.
        performed.loadKg = fromThis.loadKg;
      }
      result = { next: performed, performed, action: "hold", reason: "" };
      action = session.deload ? "deload" : "comeback";
      result.reason = session.deload ? "Deload: holding steady while you recover." : "Welcome back: picking up from what you lifted today.";
    } else if (p.benchmarkSet && !progress.calibrated) {
      result = calibrate(progress, sets, ctx);
      action = result.action;
    } else {
      result = progressExercise(progress, sets, ctx);
      action = result.action;
    }

    next.exercises[p.exerciseId] = result.performed;
    if (result.next.exerciseId !== p.exerciseId) {
      // Keep what we already know about the new exercise; otherwise start from the converted load.
      if (!next.exercises[result.next.exerciseId]) next.exercises[result.next.exerciseId] = result.next;
      redirect(next, p.exerciseId, result.next.exerciseId);
    } else {
      next.exercises[p.exerciseId] = result.next;
    }
    changes.push({
      slot: p.slot,
      exerciseId: p.exerciseId,
      nextExerciseId: result.next.exerciseId,
      action,
      reason: result.reason,
      next: snapshot(next.exercises[result.next.exerciseId]!),
    });
  }

  let deloadStarted = false;
  let deloadFinished = false;
  if (session.deload) {
    next.deloadRemaining = Math.max(0, next.deloadRemaining - 1);
    deloadFinished = next.deloadRemaining === 0;
  } else if (!session.comeback) {
    const byId = new Map(prescriptions.map((p) => [p.exerciseId, p]));
    const counted = logs.filter((l) => {
      const p = byId.get(l.exerciseId);
      return p !== undefined && p.loadType !== "time";
    });
    if (counted.length > 0) {
      const grinders = counted.filter((l) => l.rir === 0 || l.reps < byId.get(l.exerciseId)!.repRange[0]).length;
      next.strain = [...next.strain, grinders / counted.length].slice(-6);
    }
    const recent = next.strain.slice(-STRAINED_SESSIONS_FOR_DELOAD);
    if (recent.length === STRAINED_SESSIONS_FOR_DELOAD && recent.every((s) => s >= STRAIN_THRESHOLD)) {
      next.deloadRemaining = Math.max(1, ctx.strengthPerWeek);
      next.strain = [];
      deloadStarted = true;
    }
  }
  next.strengthSessionsLogged += 1;
  return { state: next, changes, deloadStarted, deloadFinished };
}
