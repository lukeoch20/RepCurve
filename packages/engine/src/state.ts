import { getExercise } from "@repcurve/exercises";
import { prevOwnedLoad, roundDownToOwned } from "@repcurve/shared";
import type { Exercise, SetLog, TrainingLevel } from "@repcurve/shared";
import type { EngineContext } from "./context.js";
import { cautionAreasFor, markCaution, type TrainingProfile } from "./profile.js";
import { isLoaded, repRangeFor, startingLoadKg } from "./loads.js";
import {
  calibrate,
  freshProgress,
  ladderNeighbour,
  progressExercise,
  type ExerciseProgress,
  type ProgressionAction,
  type ProgressionResult,
} from "./progression.js";
import { TARGET_RIR, buildPrescription, clamp, defaultTargetReps, maxRepsFor } from "./prescribe.js";
import { rampSeconds } from "./session.js";
import { finisherSeconds, setupSeconds, supersetSeconds } from "./timing.js";
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
  /** Why the current deload started: recent sessions were grinds, or it was due. Absent outside a deload. */
  deloadReason?: DeloadReason;
  /** Strength sessions since the last deload or break. Absent in states saved before scheduled deloads (read as 0). */
  sessionsSinceDeload?: number;
  /** Share of "grinder" sets (0 left in the tank, or below the rep range) in recent strength sessions. */
  strain: number[];
  strengthSessionsLogged: number;
}

export function initialTrainingState(): TrainingState {
  return { version: 1, substitutions: {}, exercises: {}, deloadRemaining: 0, strain: [], strengthSessionsLogged: 0 };
}

/** Days off after which the next strength session eases you back in. */
export const COMEBACK_DAYS = 14;

export type DeloadReason = "strain" | "scheduled";

/**
 * Weeks of training after which a planned lighter week is due, for lifters past the novice stage.
 * Novices recover quickly and only deload when sessions turn into grinds. For trained lifters a
 * light week every 4 to 8 weeks is common practice; the advanced interval matches the length of
 * an exercise block. [verify]
 */
export const SCHEDULED_DELOAD_WEEKS: Record<TrainingLevel, number | null> = { novice: null, intermediate: 8, advanced: 6 };

export function resolveExercise(state: TrainingState, programmedId: string): string {
  return state.substitutions[programmedId] ?? programmedId;
}

function cloneState(s: TrainingState): TrainingState {
  return JSON.parse(JSON.stringify(s)) as TrainingState;
}

/**
 * Every programmed exercise currently resolving to `fromId` resolves to `toId` from now on.
 * The target is resolved first, so substitutions never chain.
 */
function redirect(state: TrainingState, fromId: string, toId: string): void {
  const resolved = resolveExercise(state, toId);
  const target = resolved === fromId ? toId : resolved;
  const programmed = new Set<string>([fromId, ...Object.keys(state.substitutions)]);
  const moving = [...programmed].filter((x) => resolveExercise(state, x) === fromId);
  for (const x of moving) {
    if (x === target) delete state.substitutions[x];
    else state.substitutions[x] = target;
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

function ownedOrRounded(loadKg: number, owned: number[]): number {
  if (owned.some((w) => Math.abs(w - loadKg) < 1e-6)) return loadKg;
  return roundDownToOwned(loadKg, owned) ?? loadKg;
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
  const stored = progress?.repRange ?? fallback?.repRange ?? repRangeFor(exercise, ctx.level);
  // Ranges saved before a cap existed (e.g. 30 reps per side) are brought back inside it.
  const cap = maxRepsFor(exercise);
  const repRange: [number, number] = [Math.min(stored[0], cap), Math.min(stored[1], cap)];
  let loadKg: number | null = null;
  const owned = ctx.loadsFor(exercise);
  if (isLoaded(exercise) && owned.length > 0) {
    const remembered = progress?.loadKg ?? fallback?.loadKg ?? null;
    loadKg = remembered !== null
      ? ownedOrRounded(remembered, owned)
      : startingLoadKg(exercise, ctx.profile, ctx.equipment, ctx.level, repRange, TARGET_RIR);
  }
  const targetReps = clamp(
    progress?.targetReps ?? fallback?.targetReps ?? defaultTargetReps(repRange, exercise.loadType),
    repRange[0],
    repRange[1],
  );
  const p = buildPrescription({
    exercise,
    slot,
    sets,
    repRange,
    targetReps,
    loadKg,
    targetRir: progress?.targetRir ?? TARGET_RIR,
    benchmarkSet: false,
    units: ctx.loadUnits,
  });
  if (progress?.painCheck) p.painCheck = true;
  return p;
}

function lighter(p: Prescription, ctx: EngineContext): Prescription {
  if (p.loadKg === null) return { ...p, benchmarkSet: false };
  const e = getExercise(p.exerciseId);
  const prev = prevOwnedLoad(p.loadKg, ctx.loadsFor(e));
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
    units: ctx.loadUnits,
  });
}

/**
 * Shrink a strength session until it fits its time budget: drop rounds from
 * the last superset first (not below two), then the finisher, then whole
 * supersets. Needed when swaps or ladder moves bring in slower exercises.
 */
/** Sessions may run this far over budget before anything is cut. */
export const BUDGET_TOLERANCE = 0.05;
/** A whole pattern pair is only dropped to save at least this much. */
const MIN_PAIR_SAVING_SEC = 60;

/**
 * Re-time a personalised session and fit it to its budget. Sets are timed from the
 * reps the user will actually do. When over budget (beyond a small tolerance) the
 * smallest cut that helps goes first: one round of a superset above two rounds,
 * then a finisher set, then rounds down to one, and a whole pair only when that
 * saves at least a minute. Anything cut that fits again afterwards is put back.
 */
export function fitToBudget(session: SessionPlan): SessionPlan {
  if (session.kind !== "strength") return session;
  // What was planned, per superset and per exercise: cuts can be put back, never more than this
  // (the plan already kept each muscle's week within its ceiling).
  const plannedSets = session.supersets.map((ss) => ss.items.map((p) => p.sets));
  let supersets: Superset[] = session.supersets.map((ss) => ({ ...ss, items: ss.items.map((p) => ({ ...p })) }));
  const plannedFinisher = session.finisher;
  let finisher = plannedFinisher ? { ...plannedFinisher } : null;

  const timedItem = (p: Prescription, sets = p.sets) => ({ exercise: getExercise(p.exerciseId), repRange: p.repRange, reps: p.targetReps, sets });
  /** Sets each exercise would do with the superset at `rounds` (an exercise one set behind stays one behind). */
  const setsAt = (ss: Superset, rounds: number, i: number) =>
    ss.items.map((p, j) => Math.min(plannedSets[i]?.[j] ?? rounds, Math.max(1, rounds - (ss.rounds - p.sets))));
  // Setup (machines, bars, band anchors) and warm-up sets happen once; each round costs the same after that.
  const secsAt = (ss: Superset, rounds: number) => {
    const i = supersets.indexOf(ss);
    const sets = setsAt(ss, rounds, i);
    const exercises = ss.items.map((p) => getExercise(p.exerciseId));
    return (
      supersetSeconds(ss.items.map((p, j) => timedItem(p, sets[j])), Math.max(...sets), ss.transitionSec, ss.restSec) +
      setupSeconds(exercises) +
      rampSeconds(exercises, i)
    );
  };
  const secsFor = (ss: Superset) => secsAt(ss, ss.rounds);
  const roundSecs = (ss: Superset) => secsFor(ss) - secsAt(ss, ss.rounds - 1);
  const finisherSecs = (f: Prescription | null) => (f ? finisherSeconds(getExercise(f.exerciseId), f.repRange, f.sets, f.targetReps) : 0);
  const totalSec = () => session.warmupMinutes * 60 + supersets.reduce((s, ss) => s + secsFor(ss), 0) + finisherSecs(finisher);
  const budgetSec = session.budgetMinutes * 60;
  const limitSec = budgetSec * (1 + BUDGET_TOLERANCE);
  const setRounds = (ss: Superset, rounds: number) => {
    const sets = setsAt(ss, rounds, supersets.indexOf(ss));
    ss.items.forEach((p, j) => (p.sets = sets[j]!));
    ss.rounds = Math.max(...sets);
  };
  /** Of the supersets that can lose a round, the cheapest round that clears the overage, else the most expensive. */
  const roundToCut = (minRounds: number): Superset | undefined => {
    const over = totalSec() - limitSec;
    const options = supersets.filter((ss) => ss.rounds > minRounds).sort((a, b) => roundSecs(a) - roundSecs(b));
    return options.find((ss) => roundSecs(ss) >= over) ?? options[options.length - 1];
  };

  while (totalSec() > limitSec + 1e-9) {
    const over = totalSec() - budgetSec;
    const aboveTwo = roundToCut(2);
    if (aboveTwo) setRounds(aboveTwo, aboveTwo.rounds - 1);
    else if (finisher && finisher.sets > 1) finisher = { ...finisher, sets: finisher.sets - 1 };
    else if (finisher) finisher = null;
    else if (roundToCut(1)) {
      const ss = roundToCut(1)!;
      setRounds(ss, ss.rounds - 1);
    } else if (supersets.length > 1 && over >= MIN_PAIR_SAVING_SEC) supersets = supersets.slice(0, -1);
    else break;
  }

  // Put back what was cut and fits within the budget itself: rounds first (cheapest first, up to
  // each superset's planned rounds), then the finisher.
  let restored = true;
  while (restored) {
    restored = false;
    const candidates = supersets
      .filter((ss, i) => ss.items.some((p, j) => p.sets < (plannedSets[i]?.[j] ?? 0)))
      .sort((a, b) => secsAt(a, a.rounds + 1) - secsFor(a) - (secsAt(b, b.rounds + 1) - secsFor(b)));
    for (const ss of candidates) {
      const i = supersets.indexOf(ss);
      const target = ss.items.map((p, j) => Math.min(p.sets + 1, plannedSets[i]![j]!));
      const before = secsFor(ss);
      const prev = ss.items.map((p) => p.sets);
      ss.items.forEach((p, j) => (p.sets = target[j]!));
      ss.rounds = Math.max(...target);
      if (totalSec() <= budgetSec + 1e-9 && secsFor(ss) > before) {
        restored = true;
        break;
      }
      ss.items.forEach((p, j) => (p.sets = prev[j]!));
      ss.rounds = Math.max(...prev);
    }
    if (restored || !plannedFinisher) continue;
    const next = finisher ? (finisher.sets < plannedFinisher.sets ? { ...finisher, sets: finisher.sets + 1 } : null) : { ...plannedFinisher, sets: 1 };
    if (next && totalSec() - finisherSecs(finisher) + finisherSecs(next) <= budgetSec) {
      finisher = next;
      restored = true;
    }
  }

  for (const ss of supersets) ss.estimatedSec = secsFor(ss);
  return { ...session, supersets, finisher, estimatedMinutes: Math.round((totalSec() / 60) * 10) / 10 };
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
  const usable = (id: string) => inPool.has(id) && !used.has(id);

  /**
   * The exercise for a slot: its substitute, else what was programmed, else another exercise of the
   * same movement. In an alternate block, a swap or ladder move made on the slot's usual exercise
   * carries over (unless the alternate has its own), so a block of variety never undoes a "do this
   * instead" or drops someone back down a ladder they have climbed.
   */
  const pick = (p: Prescription): string | null => {
    const carried = p.alternateOf !== undefined && state.substitutions[p.exerciseId] === undefined && state.substitutions[p.alternateOf] !== undefined;
    const resolved = carried ? resolveExercise(state, p.alternateOf!) : resolveExercise(state, p.exerciseId);
    if (usable(resolved)) return resolved;
    if (usable(p.exerciseId)) return p.exerciseId;
    const pattern = getExercise(p.exerciseId).pattern;
    const alternatives = ctx.pool.exercises
      .filter((e) => e.pattern === pattern && !used.has(e.id))
      .sort((a, b) => Number(!!state.exercises[b.id]) - Number(!!state.exercises[a.id]) || a.ladderLevel - b.ladderLevel);
    return alternatives[0]?.id ?? null;
  };

  const remap = (p: Prescription, sets: number): Prescription | null => {
    const id = pick(p);
    if (!id) return null;
    used.add(id);
    const exercise = getExercise(id);
    let np = prescriptionFor(exercise, p.slot, sets, state, ctx, id === p.exerciseId ? p : undefined);
    np.benchmarkSet = p.benchmarkSet && !easier && !(state.exercises[id]?.calibrated ?? false);
    if (easier) np = lighter(np, ctx);
    return np;
  };

  // An easier session does one set fewer of each exercise (at least one); an exercise that sat out a
  // superset's last round still does one fewer than its partner.
  const supersets = session.supersets
    .map((ss) => {
      const items = ss.items.map((p) => remap(p, easier ? Math.max(1, p.sets - 1) : p.sets)).filter((p): p is Prescription => p !== null);
      return { ...ss, rounds: items.length > 0 ? Math.max(...items.map((p) => p.sets)) : 0, items };
    })
    .filter((ss) => ss.items.length > 0);
  const finisher = session.finisher ? remap(session.finisher, session.finisher.sets) : null;
  const deloadReason = deload ? (state.deloadReason ?? "strain") : undefined;
  return fitToBudget({ ...session, supersets, finisher, deload, comeback, ...(deloadReason ? { deloadReason } : {}) });
}

/** Why someone wants a different exercise; each wants different options first. */
export type SwapReason = "busy" | "hard" | "balance" | "dislike";

const TIER_RANK = { default: 0, optional: 1, advanced: 2, retired: 3 } as const;

/**
 * Other exercises that do the same job and that the user can do with their equipment, best match
 * first: same family, then the planner's own choices before optional branches and advanced skills.
 * The reason reorders them: equipment busy or missing puts different equipment first; too hard puts
 * easier and more stable options first (no advanced skills); balance puts two-sided options first.
 */
export function alternativesFor(p: Prescription, ctx: EngineContext, excludeIds: string[] = [], reason?: SwapReason, profile?: TrainingProfile): Exercise[] {
  const current = getExercise(p.exerciseId);
  const exclude = new Set([p.exerciseId, ...excludeIds]);
  const isolationFamily = (e: Exercise) => current.pattern !== "isolation" || e.family === current.family;
  let options = ctx.pool.exercises.filter((e) => e.pattern === p.pattern && !exclude.has(e.id) && isolationFamily(e));
  if (reason === "hard" || reason === "balance") options = options.filter((e) => e.tier !== "advanced");
  // Options that spare a recently painful area come first, whatever the reason.
  const cautioned = (e: Exercise) => (profile && cautionAreasFor(profile, e.id).length > 0 ? 1 : 0);
  const key = (e: Exercise): number[] => [cautioned(e), ...byReason(e)];
  const byReason = (e: Exercise): number[] => {
    const family = e.family === current.family ? 0 : 1;
    // Entry regressions (wall push-ups, sit-to-stands) are for when it's too hard, not a first offer.
    const tier = TIER_RANK[e.tier] + (e.ladderLevel === 0 && reason !== "hard" ? 0.5 : 0);
    switch (reason) {
      case "busy":
        return [e.loadType === current.loadType ? 1 : 0, family, tier];
      case "hard": {
        const easierRung = e.ladder === current.ladder && e.ladderLevel < current.ladderLevel ? 0 : 1;
        const stable = e.unilateral ? 1 : 0;
        return [easierRung, family, stable, tier];
      }
      case "balance":
        return [e.unilateral ? 1 : 0, family, tier];
      default:
        return [family, tier];
    }
  };
  return options
    .map((e) => ({ e, k: key(e) }))
    .sort((a, b) => {
      for (let i = 0; i < a.k.length; i++) if (a.k[i] !== b.k[i]) return a.k[i]! - b.k[i]!;
      return a.e.ladder === b.e.ladder ? a.e.ladderLevel - b.e.ladderLevel : a.e.ladder.localeCompare(b.e.ladder);
    })
    .map((x) => x.e);
}

/**
 * Swap an exercise for this session only, keeping the slot and the number of sets. A benchmark
 * set carries over when the new exercise hasn't been calibrated yet. With the training profile, the
 * new exercise gets the same caution as any planned exercise that loads a recently painful area.
 */
export function swapPrescription(p: Prescription, newExerciseId: string, state: TrainingState, ctx: EngineContext, profile?: TrainingProfile): Prescription {
  const np = prescriptionFor(getExercise(newExerciseId), p.slot, p.sets, state, ctx);
  np.benchmarkSet = p.benchmarkSet && np.loadType !== "time" && !(state.exercises[newExerciseId]?.calibrated ?? false);
  // A recently painful area keeps its check-in whichever exercise loads it.
  return profile ? markCaution(np, profile) : np;
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

function hasEasierOption(p: Prescription, ctx: EngineContext): boolean {
  if (p.loadKg !== null && prevOwnedLoad(p.loadKg, ctx.loadsFor(getExercise(p.exerciseId))) !== null) return true;
  return ladderNeighbour(getExercise(p.exerciseId), ctx, -1) !== null;
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

  const processed = new Set<string>();
  for (const p of prescriptions) {
    // Each exercise is progressed once per session, from all of its sets.
    if (processed.has(p.exerciseId)) continue;
    processed.add(p.exerciseId);
    const sets = logs.filter((l) => l.exerciseId === p.exerciseId);
    const progress = next.exercises[p.exerciseId] ?? progressFromPrescription(p, ctx);
    const snapshot = (x: ExerciseProgress) => ({ loadKg: x.loadKg, targetReps: x.targetReps, repRange: x.repRange });
    if (sets.length === 0) {
      changes.push({ slot: p.slot, exerciseId: p.exerciseId, nextExerciseId: p.exerciseId, action: "skipped", reason: "Not logged this time.", next: snapshot(progress) });
      continue;
    }

    let result: ProgressionResult;
    let action: ExerciseChange["action"];
    const pain = sets.some((l) => l.painFlag);
    if ((session.deload || session.comeback) && !pain) {
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
    } else if (p.caution && !progress.painCheck) {
      // A recently painful area this exercise loads: judged like an exercise that hurt itself, so
      // nothing gets heavier, but it isn't marked as having hurt unless it did.
      result = progressExercise({ ...progress, painCheck: true }, sets, ctx);
      if (!pain) {
        result = { ...result, next: { ...result.next, painCheck: false }, performed: { ...result.performed, painCheck: false } };
        if (result.action === "hold" && result.reason.startsWith("Pain-free")) {
          result.reason = `Felt fine. Held steady while your ${p.caution.toLowerCase()} settles.`;
        }
      }
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
    if (deloadFinished) {
      delete next.deloadReason;
      next.sessionsSinceDeload = 0;
    }
  } else if (session.comeback) {
    // A break of two weeks or more is rest enough; the count towards a planned light week restarts.
    next.sessionsSinceDeload = 0;
  } else {
    const byId = new Map(prescriptions.map((p) => [p.exerciseId, p]));
    const counted = logs.filter((l) => {
      const p = byId.get(l.exerciseId);
      return p !== undefined && p.loadType !== "time";
    });
    if (counted.length > 0) {
      // A set below the range only counts as a grind when an easier option exists; on the
      // easiest rung with the lightest weight, building up from below the range is the plan.
      const canEase = new Map([...byId.values()].map((p) => [p.exerciseId, hasEasierOption(p, ctx)]));
      const grinders = counted.filter((l) => l.rir === 0 || (l.reps < byId.get(l.exerciseId)!.repRange[0] && canEase.get(l.exerciseId))).length;
      next.strain = [...next.strain, grinders / counted.length].slice(-6);
    }
    next.sessionsSinceDeload = (next.sessionsSinceDeload ?? 0) + 1;
    const recent = next.strain.slice(-STRAINED_SESSIONS_FOR_DELOAD);
    const dueWeeks = SCHEDULED_DELOAD_WEEKS[ctx.volumeLevel];
    const strained = recent.length === STRAINED_SESSIONS_FOR_DELOAD && recent.every((s) => s >= STRAIN_THRESHOLD);
    const due = dueWeeks !== null && next.sessionsSinceDeload >= dueWeeks * Math.max(1, ctx.strengthPerWeek);
    if (strained || due) {
      next.deloadRemaining = Math.max(1, ctx.strengthPerWeek);
      next.deloadReason = strained ? "strain" : "scheduled";
      next.strain = [];
      deloadStarted = true;
    }
  }
  next.strengthSessionsLogged += 1;
  return { state: next, changes, deloadStarted, deloadFinished };
}
