import { getExercise } from "@repcurve/exercises";
import type { Muscle, SetLog } from "@repcurve/shared";
import type { EngineContext } from "./context.js";
import { freshProgress, progressExercise, type ExerciseProgress } from "./progression.js";
import { MUSCLES } from "./volume.js";
import { fitToBudget, prescriptionsOf, recordSession, type ExerciseChange, type RecordResult, type TrainingState } from "./state.js";
import type { Prescription, SessionPlan } from "./types.js";

/**
 * "Still sore" check-in. Ordinary next-day soreness isn't a reason to skip training, and it tracks
 * muscle damage poorly (Nosaka 2002; Hotfiel 2018), so the response stays small: a bit sore changes
 * nothing; very sore takes one set off the exercises that work that muscle hardest today and keeps
 * their weight where it is (today's sets neither push it up nor count as a stall).
 */

/** How sore a muscle group still is. "none" records that the person was asked and said not sore. */
export type SoreLevel = "none" | "bit" | "very";

export interface Soreness {
  /** A muscle group, e.g. "quads". */
  group: Muscle;
  level: SoreLevel;
}

/** Soreness peaks 48–72 hours after a session; a session longer ago than this isn't asked about. */
export const SORE_WINDOW_HOURS = 72;
const HOUR_MS = 3_600_000;

/** Plain names for the groups, as the check-in shows them. */
export const SORE_GROUP_NAME: Record<Muscle, string> = {
  quads: "Quads",
  glutes: "Glutes",
  hamstrings: "Hamstrings",
  chest: "Chest",
  shoulders: "Shoulders",
  triceps: "Triceps",
  biceps: "Biceps",
  back: "Back",
  core: "Core",
  calves: "Calves",
};

/** The muscles an exercise works hardest (its prime movers). */
export function primeMovers(exerciseId: string): Muscle[] {
  try {
    return getExercise(exerciseId).primary;
  } catch {
    return [];
  }
}

const inOrder = (groups: Iterable<Muscle>): Muscle[] => {
  const set = new Set(groups);
  return MUSCLES.filter((m) => set.has(m));
};

/** Muscles a session works as a prime mover. */
export function sessionMuscles(exerciseIds: string[]): Muscle[] {
  return inOrder(exerciseIds.flatMap(primeMovers));
}

/** A recent strength session, for the check-in: when it finished and what was actually done. */
export interface RecentSession {
  finishedAt: number;
  exerciseIds: string[];
}

export interface SoreQuestion {
  /** Groups today's plan works that a session in the last three days also worked. */
  groups: Muscle[];
  /** When the most recent of those sessions finished, to name it ("yesterday's session"). */
  since: number;
}

/**
 * Whether to ask about soreness before today's session: only a strength session that works a muscle
 * group one of the last three days' sessions also worked. Core alone doesn't count: a short core
 * finisher ends most sessions and rarely leaves much soreness, so asking every time would nag.
 * Null when there's nothing to ask.
 */
export function soreQuestion(plan: SessionPlan, recent: RecentSession[], now: number): SoreQuestion | null {
  if (plan.kind !== "strength") return null;
  const today = new Set(sessionMuscles(prescriptionsOf(plan).map((p) => p.exerciseId)));
  const groups = new Set<Muscle>();
  let since = -Infinity;
  for (const r of recent) {
    if (r.finishedAt > now || now - r.finishedAt > SORE_WINDOW_HOURS * HOUR_MS) continue;
    const shared = sessionMuscles(r.exerciseIds).filter((m) => today.has(m));
    if (shared.length === 0) continue;
    shared.forEach((m) => groups.add(m));
    since = Math.max(since, r.finishedAt);
  }
  return [...groups].some((m) => m !== "core") ? { groups: inOrder(groups), since } : null;
}

/** The groups answered "very" sore. */
export function verySore(soreness: Soreness[] | undefined): Muscle[] {
  return inOrder((soreness ?? []).filter((s) => s.level === "very").map((s) => s.group));
}

/**
 * Today's plan with the check-in's answers on it. Exercises whose prime movers include a very sore
 * group are marked `sore` and do one set fewer, never fewer than one and never more than one below
 * their superset's rounds; nothing else changes. Lighter sessions (deloads, comebacks) already do a
 * set fewer, so they're only marked.
 */
export function applySoreness(plan: SessionPlan, soreness: Soreness[] | undefined): SessionPlan {
  const very = new Set(verySore(soreness));
  if (plan.kind !== "strength" || very.size === 0) return plan;
  const easier = plan.deload || plan.comeback;
  let changed = false;
  const soreOf = (p: Prescription): Muscle[] => primeMovers(p.exerciseId).filter((m) => very.has(m));
  const supersets = plan.supersets.map((ss) => {
    const items = ss.items.map((p) => {
      const sore = soreOf(p);
      if (sore.length === 0) return p;
      changed = true;
      const sets = !easier && p.sets === ss.rounds && ss.rounds > 1 ? ss.rounds - 1 : p.sets;
      return { ...p, sets, sore: { groups: sore, setOff: sets < p.sets } };
    });
    // When every exercise sits out the last round, the round goes.
    const rounds = items.length > 0 ? Math.max(...items.map((p) => p.sets)) : ss.rounds;
    return { ...ss, rounds, items };
  });
  let finisher = plan.finisher;
  if (finisher && soreOf(finisher).length > 0) {
    changed = true;
    const sets = !easier && finisher.sets > 1 ? finisher.sets - 1 : finisher.sets;
    finisher = { ...finisher, sets, sore: { groups: soreOf(finisher), setOff: sets < finisher.sets } };
  }
  // Fewer sets only ever shorten the session; re-fitting brings the timings up to date.
  return changed ? fitToBudget({ ...plan, supersets, finisher }) : plan;
}

/** What the check-in changed today, in plain words, or null when nothing did. */
export function sorenessSummary(plan: SessionPlan): string | null {
  if (plan.kind !== "strength") return null;
  const sore = prescriptionsOf(plan).filter((p) => p.sore);
  if (sore.length === 0) return null;
  const groups = inOrder(sore.flatMap((p) => p.sore!.groups)).map((m) => SORE_GROUP_NAME[m].toLowerCase());
  const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
  const fewer = sore.filter((p) => p.sore!.setOff).map((p) => p.name);
  const named = list(groups);
  const lead = `${named.charAt(0).toUpperCase()}${named.slice(1)} still very sore`;
  const all = sore.map((p) => p.name);
  const same = `${list(all)} ${all.length === 1 ? "stays" : "stay"} at the same weight today`;
  if (fewer.length === 0) return `${lead}: ${same}.`;
  if (fewer.length === all.length) return `${lead}: one set fewer of ${list(all)}, at the same weight today.`;
  return `${lead}: one set fewer of ${list(fewer)}, and ${same}.`;
}

/**
 * Fold a finished session into the training state like recordSession, except that exercises done
 * while very sore are held where they were: today's sets can raise the strength estimate, but they
 * don't push the weight up, count as a stall or count toward a deload. Pain still goes through the
 * pain rules, and a benchmark set still sets a first working weight.
 */
export function recordSoreSession(state: TrainingState, session: SessionPlan, logs: SetLog[], ctx: EngineContext): RecordResult {
  if (session.kind !== "strength" || session.deload || session.comeback) return recordSession(state, session, logs, ctx);
  const prescriptions = prescriptionsOf(session);
  const held = new Map<string, Prescription>();
  for (const p of prescriptions) {
    if (!p.sore || held.has(p.exerciseId)) continue;
    const sets = logs.filter((l) => l.exerciseId === p.exerciseId);
    const progress = state.exercises[p.exerciseId];
    if (sets.length === 0 || sets.some((l) => l.painFlag) || p.caution || progress?.painCheck) continue;
    if (p.benchmarkSet && !progress?.calibrated) continue;
    held.set(p.exerciseId, p);
  }
  if (held.size === 0) return recordSession(state, session, logs, ctx);

  // Everything else is recorded as usual, without the held exercises' sets.
  const keep = (p: Prescription) => !held.has(p.exerciseId);
  const rest: SessionPlan = {
    ...session,
    supersets: session.supersets.map((ss) => ({ ...ss, items: ss.items.filter(keep) })),
    finisher: session.finisher && keep(session.finisher) ? session.finisher : null,
  };
  const result = recordSession(state, rest, logs.filter((l) => !held.has(l.exerciseId)), ctx);
  const exercises = { ...result.state.exercises };
  const heldChanges = new Map<string, ExerciseChange>();
  for (const [id, p] of held) {
    const before: ExerciseProgress = state.exercises[id] ?? {
      ...freshProgress(getExercise(id), ctx),
      loadKg: p.loadKg,
      repRange: p.repRange,
      targetRir: p.targetRir,
      targetReps: p.targetReps,
    };
    const fromThis = progressExercise(before, logs.filter((l) => l.exerciseId === id), ctx).performed;
    // A sore day's lower estimate doesn't count against you; a higher one does count.
    const e1rmKg = before.e1rmKg !== null && fromThis.e1rmKg !== null ? Math.max(before.e1rmKg, fromThis.e1rmKg) : (fromThis.e1rmKg ?? before.e1rmKg);
    const next: ExerciseProgress = { ...before, e1rmKg, bestE1rmKg: fromThis.bestE1rmKg ?? before.bestE1rmKg, timesPerformed: before.timesPerformed + 1 };
    exercises[id] = next;
    heldChanges.set(id, {
      slot: p.slot,
      exerciseId: id,
      nextExerciseId: id,
      action: "hold",
      reason: "Still very sore today, so the weight stays put. Same again next time.",
      next: { loadKg: next.loadKg, targetReps: next.targetReps, repRange: next.repRange },
    });
  }
  // Changes in the session's order.
  const bySlot = new Map(result.changes.map((c) => [c.slot, c]));
  const changes: ExerciseChange[] = [];
  for (const p of prescriptions) {
    const c = heldChanges.get(p.exerciseId) ?? bySlot.get(p.slot);
    if (c && !changes.includes(c)) changes.push(c);
  }
  return { ...result, state: { ...result.state, exercises }, changes };
}
