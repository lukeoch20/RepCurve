import {
  adviseNextSet,
  fitToBudget,
  preferExercise,
  prescriptionsOf,
  primeMovers,
  recordSessionWithExtras,
  recordSoreSession,
  swapPrescription,
  type ExerciseChange,
  type Prescription,
  type SessionPlan,
  type SwapEvent,
  type SwapReason,
  type TrainingProfile,
  verySore,
} from "@repcurve/engine";
import { findExercise } from "@repcurve/exercises";
import type { Rir } from "@repcurve/shared";
import { contextFor, todayPlan } from "./plan";
import { currentSoreness } from "./soreness";
import { sessionSetup } from "./setups";
import type { ActiveSession, CardioProgress, CardioResult, Core, LoggedSet, SessionRecord, TimerState } from "./types";

/** Rest between sets of the core finisher. */
export const FINISHER_REST_SEC = 30;
/** Sets that can be added to one exercise beyond the plan. */
export const MAX_ADDED_SETS = 5;
/** Time after the last logged set that still counts as training (cooling down, packing up). */
export const AFTER_LAST_SET_MS = 10 * 60_000;
/** A workout this long past its last set was probably left open. */
export const STALE_MS = 3 * 3_600_000;

export interface SetRef {
  slot: string;
  exerciseId: string;
  setIndex: number;
  /** Superset index, or -1 for the core finisher. */
  group: number;
  round: number;
  /** Position within the round (0 = first exercise of the pair). */
  position: number;
  /** "A1", "A2", "B1"… or "Core". */
  label: string;
}

/**
 * Every set in the order they are done: round by round through each superset, then the finisher.
 * Sets added to an exercise make extra rounds after the planned ones.
 */
export function setOrder(plan: SessionPlan, added: Record<string, number> = {}): SetRef[] {
  const out: SetRef[] = [];
  const setsOf = (p: Prescription) => p.sets + (added[p.slot] ?? 0);
  plan.supersets.forEach((ss, g) => {
    const rounds = Math.max(ss.rounds, ...ss.items.map(setsOf));
    for (let r = 0; r < rounds; r++) {
      // An exercise with fewer sets than the superset has rounds sits out the last round.
      ss.items.forEach((p, i) => {
        if (r < setsOf(p)) out.push({ slot: p.slot, exerciseId: p.exerciseId, setIndex: r, group: g, round: r, position: i, label: `${ss.label}${i + 1}` });
      });
    }
  });
  const f = plan.finisher;
  if (f) for (let r = 0; r < setsOf(f); r++) out.push({ slot: f.slot, exerciseId: f.exerciseId, setIndex: r, group: -1, round: r, position: 0, label: "Core" });
  return out;
}

/** Sets added to a slot beyond the plan. */
export function addedSets(active: ActiveSession, slot: string): number {
  return active.extraSets?.[slot] ?? 0;
}

/** Sets of a slot today: the plan's plus any added. */
export function setCount(active: ActiveSession, slot: string): number {
  return (prescriptionAt(active.plan, slot)?.sets ?? 0) + addedSets(active, slot);
}

export function prescriptionAt(plan: SessionPlan, slot: string): Prescription | undefined {
  return prescriptionsOf(plan).find((p) => p.slot === slot);
}

export function loggedSet(active: ActiveSession, slot: string, setIndex: number): LoggedSet | undefined {
  return active.sets.find((s) => s.slot === slot && s.setIndex === setIndex);
}

export function setsForSlot(active: ActiveSession, slot: string): LoggedSet[] {
  return active.sets.filter((s) => s.slot === slot).sort((a, b) => a.setIndex - b.setIndex);
}

export function pending(active: ActiveSession, sets = active.sets): SetRef[] {
  return setOrder(active.plan, active.extraSets).filter(
    (r) => !active.skippedSlots.includes(r.slot) && !isSkippedSet(active, r.slot, r.setIndex) && !sets.some((s) => s.slot === r.slot && s.setIndex === r.setIndex),
  );
}

const skipKey = (slot: string, setIndex: number) => `${slot}#${setIndex}`;

/** Whether one set was skipped ("not feeling it"). */
export function isSkippedSet(active: ActiveSession, slot: string, setIndex: number): boolean {
  return active.skippedSets?.includes(skipKey(slot, setIndex)) ?? false;
}

/** How many of an exercise's planned sets were skipped one at a time. */
export function skippedPlannedSets(active: ActiveSession, p: Prescription): number {
  let n = 0;
  for (let i = 0; i < p.sets; i++) if (isSkippedSet(active, p.slot, i) && !loggedSet(active, p.slot, i)) n++;
  return n;
}

/** The set to do next, or null when everything is logged or skipped. */
export function nextUp(active: ActiveSession): SetRef | null {
  return pending(active)[0] ?? null;
}

/** What a set's inputs start with: coaching from the previous set, else the last load used, else the plan. */
export function prefill(active: ActiveSession, slot: string, setIndex: number): { loadKg: number | null; reps: number; rir: Rir } {
  const done = loggedSet(active, slot, setIndex);
  if (done) return { loadKg: done.loadKg, reps: done.reps, rir: done.rir };
  const p = prescriptionAt(active.plan, slot);
  const override = active.nextSet[slot];
  const prev = setsForSlot(active, slot).filter((s) => s.setIndex < setIndex).at(-1);
  return {
    loadKg: override ? override.loadKg : prev ? prev.loadKg : (p?.loadKg ?? null),
    reps: override ? override.reps : (p?.targetReps ?? 10),
    rir: p?.targetRir ?? 2,
  };
}

export function describeRef(plan: SessionPlan, ref: SetRef, added: Record<string, number> = {}): string {
  const p = prescriptionAt(plan, ref.slot);
  const name = p?.name ?? findExercise(ref.exerciseId)?.name ?? ref.exerciseId;
  const planned = ref.group === -1 ? (plan.finisher?.sets ?? 1) : (p?.sets ?? plan.supersets[ref.group]?.rounds ?? 1);
  return `${ref.label} ${name} · set ${ref.setIndex + 1} of ${planned + (added[ref.slot] ?? 0)}`;
}

export interface SetValues {
  loadKg: number | null;
  reps: number;
  rir: Rir;
  /** true flags pain, false clears it, undefined keeps what an edited set had. */
  painFlag?: boolean;
}

function timerAfter(active: ActiveSession, done: SetRef, sets: LoggedSet[], core: Core, now: number): TimerState | null {
  const next = pending(active, sets)[0];
  if (!next) return null;
  let kind: TimerState["kind"] = "rest";
  let durationSec = core.settings.restSec;
  if (done.group === -1) durationSec = Math.min(FINISHER_REST_SEC, core.settings.restSec);
  else if (next.group === done.group && next.round === done.round) {
    kind = "transition";
    durationSec = core.settings.transitionSec;
  }
  return { kind, endsAt: now + durationSec * 1000, durationSec, next: describeRef(active.plan, next, active.extraSets) };
}

function coach(active: ActiveSession, slot: string, sets: LoggedSet[], core: Core): Pick<ActiveSession, "advice" | "nextSet"> {
  const p = prescriptionAt(active.plan, slot);
  if (!p) return { advice: active.advice, nextSet: active.nextSet };
  const forSlot = sets.filter((s) => s.slot === slot);
  if (forSlot.length === 0) {
    const { [slot]: _a, ...advice } = active.advice;
    const { [slot]: _n, ...nextSet } = active.nextSet;
    return { advice, nextSet };
  }
  const a = adviseNextSet(p, forSlot, contextFor(core));
  const last = forSlot[forSlot.length - 1]!;
  return {
    advice: { ...active.advice, [slot]: { message: a.message, tone: a.tone } },
    nextSet: { ...active.nextSet, [slot]: { loadKg: p.loadKg === null ? null : (a.loadKg ?? last.loadKg), reps: a.targetReps } },
  };
}

export function logSet(active: ActiveSession, ref: SetRef, v: SetValues, core: Core, now: number): ActiveSession {
  const p = prescriptionAt(active.plan, ref.slot);
  if (!p) return active;
  const set: LoggedSet = {
    exerciseId: p.exerciseId,
    slot: ref.slot,
    setIndex: ref.setIndex,
    loadKg: p.loadKg === null ? null : v.loadKg,
    reps: Math.max(0, Math.round(v.reps)),
    rir: v.rir,
    at: now,
    activeMs: elapsedMs(active, now),
  };
  if (v.painFlag) set.painFlag = true;
  if (ref.setIndex >= p.sets) set.extra = true;
  const sets = [...active.sets.filter((s) => !(s.slot === ref.slot && s.setIndex === ref.setIndex)), set];
  const skippedSlots = v.painFlag && !active.skippedSlots.includes(ref.slot) ? [...active.skippedSlots, ref.slot] : active.skippedSlots;
  const next: ActiveSession = { ...active, sets, skippedSlots, ...coach(active, ref.slot, sets, core) };
  return { ...next, timer: timerAfter(next, ref, sets, core, now) };
}

export function editSet(active: ActiveSession, slot: string, setIndex: number, v: SetValues, core: Core): ActiveSession {
  const existing = loggedSet(active, slot, setIndex);
  if (!existing) return active;
  const updated: LoggedSet = { ...existing, loadKg: existing.loadKg === null ? null : v.loadKg, reps: Math.max(0, Math.round(v.reps)), rir: v.rir };
  // A pain report stays unless the user explicitly clears it.
  if (v.painFlag === true) updated.painFlag = true;
  else if (v.painFlag === false) delete updated.painFlag;
  const sets = active.sets.map((s) => (s === existing ? updated : s));
  return { ...active, sets, ...coach(active, slot, sets, core) };
}

/** Where a flagged set hurt, for the record and for spotting a pattern later. */
export function setPainArea(active: ActiveSession, slot: string, setIndex: number, area: string | null): ActiveSession {
  const existing = loggedSet(active, slot, setIndex);
  if (!existing?.painFlag) return active;
  const updated: LoggedSet = { ...existing };
  if (area) updated.painArea = area;
  else delete updated.painArea;
  return { ...active, sets: active.sets.map((s) => (s === existing ? updated : s)) };
}

export function removeSet(active: ActiveSession, slot: string, setIndex: number, core: Core): ActiveSession {
  const sets = active.sets.filter((s) => !(s.slot === slot && s.setIndex === setIndex));
  return { ...active, sets, ...coach(active, slot, sets, core) };
}

/** A running rest timer's "up next" follows the sets as they are now; with nothing left to do it stops. */
function retarget(active: ActiveSession): ActiveSession {
  if (!active.timer) return active;
  const next = pending(active)[0];
  return { ...active, timer: next ? { ...active.timer, next: describeRef(active.plan, next, active.extraSets) } : null };
}

/** One more set of an exercise than planned. It's logged like the others; progression judges the planned ones. */
export function addSet(active: ActiveSession, slot: string): ActiveSession {
  const n = addedSets(active, slot);
  if (!prescriptionAt(active.plan, slot) || active.skippedSlots.includes(slot) || n >= MAX_ADDED_SETS) return active;
  return retarget({ ...active, extraSets: { ...active.extraSets, [slot]: n + 1 } });
}

/** Take back the last added set of an exercise, while it isn't logged. */
export function removeAddedSet(active: ActiveSession, slot: string): ActiveSession {
  const n = addedSets(active, slot);
  if (n === 0 || loggedSet(active, slot, setCount(active, slot) - 1)) return active;
  const { [slot]: _, ...rest } = active.extraSets ?? {};
  // A skipped added set goes with it.
  const last = setCount(active, slot) - 1;
  const without = isSkippedSet(active, slot, last) ? unskipSet(active, slot, last) : active;
  return retarget({ ...without, extraSets: n > 1 ? { ...rest, [slot]: n - 1 } : rest });
}

/**
 * Skip one set, for a set you're not feeling: it isn't logged, up next moves on (a running rest
 * timer now counts down to the next set), and the exercise holds at its weight next time rather
 * than being judged on fewer sets.
 */
export function skipSet(active: ActiveSession, slot: string, setIndex: number): ActiveSession {
  if (!prescriptionAt(active.plan, slot) || active.skippedSlots.includes(slot) || loggedSet(active, slot, setIndex) || isSkippedSet(active, slot, setIndex)) return active;
  if (setIndex < 0 || setIndex >= setCount(active, slot)) return active;
  return retarget({ ...active, skippedSets: [...(active.skippedSets ?? []), skipKey(slot, setIndex)] });
}

/** Take back a skipped set: it's to do again. */
export function unskipSet(active: ActiveSession, slot: string, setIndex: number): ActiveSession {
  if (!isSkippedSet(active, slot, setIndex)) return active;
  const skippedSets = active.skippedSets!.filter((k) => k !== skipKey(slot, setIndex));
  const { skippedSets: _, ...rest } = active;
  return retarget(skippedSets.length > 0 ? { ...rest, skippedSets } : rest);
}

export function skipSlot(active: ActiveSession, slot: string): ActiveSession {
  if (active.skippedSlots.includes(slot)) return active;
  return { ...active, skippedSlots: [...active.skippedSlots, slot], timer: null };
}

export function unskipSlot(active: ActiveSession, slot: string): ActiveSession {
  return { ...active, skippedSlots: active.skippedSlots.filter((s) => s !== slot) };
}

/**
 * Swap an exercise before any of its sets are logged. A permanent swap also updates the training state.
 * The new exercise gets the pain check-in when it loads a recently painful area, as a planned one would.
 */
export function swapExercise(
  active: ActiveSession,
  core: Core,
  slot: string,
  exerciseId: string,
  permanent: boolean,
  reason?: SwapReason,
  /** The training profile, so an exercise swapped in keeps any caution on the area it loads. */
  profile?: TrainingProfile,
): { active: ActiveSession; core: Core } {
  const p = prescriptionAt(active.plan, slot);
  if (!p || setsForSlot(active, slot).length > 0) return { active, core };
  const ctx = contextFor(core);
  const state = permanent ? preferExercise(core.state, p.exerciseId, exerciseId) : core.state;
  const np = withSoreness(p, swapPrescription(p, exerciseId, state, ctx, profile), active.soreness);
  const replace = (x: Prescription) => (x.slot === slot ? np : x);
  const plan: SessionPlan = {
    ...active.plan,
    supersets: active.plan.supersets.map((ss) => {
      if (!ss.items.some((x) => x.slot === slot)) return ss;
      const items = ss.items.map(replace);
      return { ...ss, items, rounds: Math.max(...items.map((x) => x.sets)) };
    }),
    finisher: active.plan.finisher ? replace(active.plan.finisher) : null,
  };
  const { [slot]: _a, ...advice } = active.advice;
  const { [slot]: _n, ...nextSet } = active.nextSet;
  const swap: SwapEvent = { slot, from: p.exerciseId, to: exerciseId, permanent, ...(reason ? { reason } : {}) };
  const swaps = [...(active.swaps ?? []), swap];
  return { active: { ...active, plan, advice, nextSet, swaps }, core: permanent ? { ...core, state } : core };
}

/**
 * The soreness hold for an exercise swapped in: one that works a muscle answered very sore is held
 * like the one it replaces; one that doesn't gets back the set the sore exercise gave up.
 */
function withSoreness(from: Prescription, to: Prescription, soreness: ActiveSession["soreness"]): Prescription {
  const very = new Set(verySore(soreness));
  const groups = primeMovers(to.exerciseId).filter((m) => very.has(m));
  const { sore: _, ...rest } = to;
  if (groups.length > 0) return { ...rest, benchmarkSet: false, sore: { groups, setOff: from.sore?.setOff ?? false } };
  return from.sore?.setOff ? { ...rest, sets: to.sets + 1 } : rest;
}

// ---------------------------------------------------------------- timers

export function timerRemainingMs(timer: TimerState, now: number, pausedAt: number | null): number {
  return timer.endsAt - (pausedAt ?? now);
}

export function adjustTimer(active: ActiveSession, deltaSec: number, now: number): ActiveSession {
  const t = active.timer;
  if (!t) return active;
  const ref = active.pausedAt ?? now;
  // A timer that already ran out starts a fresh countdown for the extra time.
  if (t.endsAt <= ref) {
    if (deltaSec <= 0) return active;
    return { ...active, timer: { ...t, endsAt: ref + deltaSec * 1000, durationSec: deltaSec } };
  }
  const endsAt = Math.max(ref, t.endsAt + deltaSec * 1000);
  return { ...active, timer: { ...t, endsAt, durationSec: Math.max(0, t.durationSec + deltaSec) } };
}

/** Restart the running rest timer at a new length, counted from when it started. */
export function setTimerLength(active: ActiveSession, seconds: number): ActiveSession {
  const t = active.timer;
  if (!t) return active;
  const startedAt = t.endsAt - t.durationSec * 1000;
  return { ...active, timer: { ...t, durationSec: seconds, endsAt: startedAt + seconds * 1000 } };
}

export function clearTimer(active: ActiveSession): ActiveSession {
  return active.timer ? { ...active, timer: null } : active;
}

// ---------------------------------------------------------------- pause

export function elapsedMs(active: ActiveSession, now: number): number {
  const pausedNow = active.pausedAt !== null ? now - active.pausedAt : 0;
  return Math.max(0, now - active.startedAt - active.pausedMs - pausedNow);
}

/**
 * Active time up to an earlier moment `t`. Past pauses are only known in total, so they're
 * placed as late as they could have been: a workout paused overnight after its last set still
 * counts the time up to that set.
 */
export function elapsedAt(active: ActiveSession, t: number, now: number): number {
  if (t >= now) return elapsedMs(active, now);
  if (active.pausedAt !== null && active.pausedAt <= t) return elapsedMs(active, active.pausedAt);
  const pausedBefore = Math.max(0, active.pausedMs - ((active.pausedAt ?? now) - t));
  return Math.max(0, t - active.startedAt - pausedBefore);
}

/** When the last set was logged, or null before the first. */
export function lastSetAt(active: ActiveSession): number | null {
  return active.sets.length > 0 ? Math.max(...active.sets.map((s) => s.at)) : null;
}

/**
 * Active time when the last set was logged. Sets keep the active time they were logged at, so
 * pauses before the last set are left out exactly; older sets fall back to placing pauses late.
 */
function activeAtLastSet(active: ActiveSession, now: number): number | null {
  const last = lastSetAt(active);
  if (last === null) return null;
  const set = active.sets.find((s) => s.at === last)!;
  return set.activeMs ?? elapsedAt(active, last, now);
}

/** Sets are logged but none for hours: the workout was probably left open after it ended. */
export function looksLeftOpen(active: ActiveSession, now: number): boolean {
  const last = lastSetAt(active);
  return last !== null && now - last > STALE_MS;
}

/**
 * Minutes recorded for a session that ended at `end` (now, or earlier when closed as of its last
 * set). A workout left open doesn't count the hours it sat there: time stops a little after the
 * last set, and never runs past twice the plan (or two hours, if that's longer).
 */
export function activeMinutes(active: ActiveSession, end: number, now = end): number {
  const last = lastSetAt(active);
  const atLast = activeAtLastSet(active, now);
  let ms = last !== null && atLast !== null && end === last ? atLast : elapsedAt(active, end, now);
  if (last !== null && atLast !== null && end > last) ms = Math.min(ms, atLast + AFTER_LAST_SET_MS);
  const capMs = Math.max(2 * active.plan.estimatedMinutes, 120) * 60_000;
  return Math.round(Math.min(ms, capMs) / 60_000);
}

export function pause(active: ActiveSession, now: number): ActiveSession {
  if (active.pausedAt !== null) return active;
  let cardio = active.cardio;
  if (cardio && cardio.segmentEndsAt !== null) cardio = { ...cardio, remainingMs: Math.max(0, cardio.segmentEndsAt - now), segmentEndsAt: null };
  return { ...active, pausedAt: now, cardio };
}

export function resume(active: ActiveSession, now: number): ActiveSession {
  if (active.pausedAt === null) return active;
  const gap = now - active.pausedAt;
  const timer = active.timer ? { ...active.timer, endsAt: active.timer.endsAt + gap } : null;
  let cardio = active.cardio;
  if (cardio && cardio.started && !cardio.finished && cardio.segmentEndsAt === null) cardio = { ...cardio, segmentEndsAt: now + cardio.remainingMs };
  return { ...active, pausedAt: null, pausedMs: active.pausedMs + gap, timer, cardio };
}

// ---------------------------------------------------------------- cardio

function segmentMs(plan: SessionPlan, i: number): number {
  return (plan.cardio?.segments[i]?.minutes ?? 0) * 60_000;
}

export function startCardio(active: ActiveSession, now: number): ActiveSession {
  const c = active.cardio;
  if (!c || c.started) return active;
  return { ...active, cardio: { ...c, started: true, segmentEndsAt: now + c.remainingMs } };
}

/** Time already spent in segments before the current one; older saved sessions lack the counter. */
function doneBefore(active: ActiveSession): number {
  const c = active.cardio!;
  if (c.doneMs !== undefined) return c.doneMs;
  return (active.plan.cardio?.segments ?? []).slice(0, c.segmentIndex).reduce((n, s) => n + s.minutes * 60_000, 0);
}

/** Move past any segments that have ended. Returns how many segment boundaries were crossed. */
export function tickCardio(active: ActiveSession, now: number): { active: ActiveSession; crossed: number } {
  const c = active.cardio;
  const segs = active.plan.cardio?.segments ?? [];
  if (!c || !c.started || c.finished || c.segmentEndsAt === null || now < c.segmentEndsAt) return { active, crossed: 0 };
  let segmentIndex = c.segmentIndex;
  let segmentEndsAt: number | null = c.segmentEndsAt;
  let doneMs = doneBefore(active);
  let crossed = 0;
  let finished = false;
  while (segmentEndsAt !== null && now >= segmentEndsAt) {
    crossed++;
    doneMs += segmentMs(active.plan, segmentIndex);
    segmentIndex++;
    if (segmentIndex >= segs.length) {
      finished = true;
      segmentIndex = segs.length - 1;
      segmentEndsAt = null;
    } else {
      segmentEndsAt += segmentMs(active.plan, segmentIndex);
    }
  }
  const remainingMs = segmentEndsAt === null ? 0 : segmentEndsAt - now;
  return { active: { ...active, cardio: { ...c, segmentIndex, segmentEndsAt, remainingMs, finished, doneMs } }, crossed };
}

/** Move to the next part now. Only the time actually spent in the skipped part counts as done. */
export function skipSegment(active: ActiveSession, now: number): ActiveSession {
  const c = active.cardio;
  const segs = active.plan.cardio?.segments ?? [];
  if (!c || c.finished) return active;
  const spent = c.started ? Math.max(0, segmentMs(active.plan, c.segmentIndex) - cardioRemainingMs(active, now)) : 0;
  const doneMs = doneBefore(active) + spent;
  const nextIndex = c.segmentIndex + 1;
  if (nextIndex >= segs.length) return { ...active, cardio: { ...c, finished: true, segmentEndsAt: null, remainingMs: 0, doneMs } };
  const ms = segmentMs(active.plan, nextIndex);
  const running = c.started && active.pausedAt === null;
  return {
    ...active,
    cardio: { ...c, started: true, segmentIndex: nextIndex, remainingMs: ms, segmentEndsAt: running ? now + ms : c.started ? null : now + ms, doneMs },
  };
}

export function cardioRemainingMs(active: ActiveSession, now: number): number {
  const c = active.cardio;
  if (!c) return 0;
  if (c.segmentEndsAt !== null && active.pausedAt === null) return Math.max(0, c.segmentEndsAt - now);
  return c.remainingMs;
}

/** Minutes of cardio actually done: time spent in earlier segments plus the elapsed part of the current one. */
export function cardioMinutesDone(active: ActiveSession, now: number): number {
  const c = active.cardio;
  if (!c || !c.started) return 0;
  const current = c.finished ? 0 : Math.max(0, segmentMs(active.plan, c.segmentIndex) - cardioRemainingMs(active, now));
  return Math.round(((doneBefore(active) + current) / 60_000) * 10) / 10;
}

// ---------------------------------------------------------------- lifecycle

export function startSession(core: Core, history: SessionRecord[], now: number, minutes: number | null): ActiveSession {
  const plan = todayPlan(core, history, now, minutes);
  const soreness = plan.kind === "strength" ? currentSoreness(core, now) : undefined;
  return {
    ...(soreness ? { soreness } : {}),
    // The setup it starts with stays with it, whatever happens to setups before it's finished.
    setup: sessionSetup(core),
    id: `s${core.nextIndex + 1}-${now.toString(36)}`,
    index: core.nextIndex,
    plan,
    startedAt: now,
    pausedMs: 0,
    pausedAt: null,
    minutesOverride: minutes,
    sets: [],
    warmupDone: [],
    timer: null,
    cardio:
      plan.kind === "cardio"
        ? { segmentIndex: 0, doneMs: 0, segmentEndsAt: null, remainingMs: segmentMs(plan, 0), started: false, finished: false }
        : null,
    advice: {},
    nextSet: {},
    skippedSlots: [],
  };
}

export function toggleWarmup(active: ActiveSession, name: string): ActiveSession {
  const done = active.warmupDone.includes(name) ? active.warmupDone.filter((n) => n !== name) : [...active.warmupDone, name];
  return { ...active, warmupDone: done };
}

function baseRecord(active: ActiveSession, now: number, end = now): Omit<SessionRecord, "changes" | "cardio" | "skipped"> {
  return {
    id: active.id,
    index: active.index,
    kind: active.plan.kind,
    name: active.plan.name,
    week: active.plan.week,
    startedAt: active.startedAt,
    finishedAt: end,
    activeMinutes: activeMinutes(active, end, now),
    plan: active.plan,
    sets: active.sets,
    deload: active.plan.deload,
    comeback: active.plan.comeback,
    ...(active.swaps && active.swaps.length > 0 ? { swaps: active.swaps } : {}),
    ...(active.soreness ? { soreness: active.soreness } : {}),
    ...(active.setup ? { setup: { id: active.setup.id, name: active.setup.name } } : {}),
  };
}

/**
 * The core as a session in progress sees it: with the equipment the session started with, so
 * loads, swaps and progression keep to what's there even if setups change meanwhile.
 */
export function sessionCore(core: Core, active: Pick<ActiveSession, "setup">): Core {
  return active.setup ? { ...core, equipment: active.setup.equipment } : core;
}

/**
 * Close the session: progress every exercise and move on to the next session. `endedAt` closes
 * it as of an earlier moment, for a workout that was left open.
 */
export function finishSession(active: ActiveSession, core: Core, now: number, cardio?: CardioResult, endedAt = now): { core: Core; record: SessionRecord } {
  let state = core.state;
  let changes: ExerciseChange[] = [];
  const plan = withSkippedSets(active);
  if (active.plan.kind === "strength") {
    // Added sets aren't judged, and exercises done while very sore, or with a set skipped, are held at their weight.
    const result = recordSessionWithExtras(core.state, plan, active.sets, contextFor(core), recordSoreSession);
    state = result.state;
    changes = result.changes;
  }
  const record: SessionRecord = { ...baseRecord(active, now, Math.min(endedAt, now)), plan, changes, cardio: cardio ?? null, skipped: false };
  return { core: { ...core, state, nextIndex: Math.max(core.nextIndex, active.index + 1) }, record };
}

/** The plan with each exercise's skipped sets marked, so progression holds those exercises. */
function withSkippedSets(active: ActiveSession): SessionPlan {
  if (!active.skippedSets?.length) return active.plan;
  const mark = (p: Prescription): Prescription => {
    const n = skippedPlannedSets(active, p);
    return n > 0 ? { ...p, skippedSets: n } : p;
  };
  return {
    ...active.plan,
    supersets: active.plan.supersets.map((ss) => ({ ...ss, items: ss.items.map(mark) })),
    finisher: active.plan.finisher ? mark(active.plan.finisher) : null,
  };
}

/** Skip the next session without training: it is recorded as skipped and the sequence moves on. */
export function skipSession(core: Core, history: SessionRecord[], now: number): { core: Core; record: SessionRecord } {
  const plan = todayPlan(core, history, now);
  const record: SessionRecord = {
    id: `s${core.nextIndex + 1}-${now.toString(36)}`,
    index: core.nextIndex,
    kind: plan.kind,
    name: plan.name,
    week: plan.week,
    startedAt: now,
    finishedAt: now,
    activeMinutes: 0,
    plan,
    sets: [],
    changes: [],
    cardio: null,
    deload: plan.deload,
    comeback: plan.comeback,
    skipped: true,
  };
  return { core: { ...core, nextIndex: core.nextIndex + 1 }, record };
}

/** Re-fit a not-yet-started session to a new time budget. */
export function refit(plan: SessionPlan): SessionPlan {
  return fitToBudget(plan);
}

export function progressSummary(active: ActiveSession): { done: number; total: number } {
  // Skipped exercises and skipped sets drop out of the count.
  const order = setOrder(active.plan, active.extraSets).filter((r) => !active.skippedSlots.includes(r.slot) && !isSkippedSet(active, r.slot, r.setIndex));
  const done = order.filter((r) => loggedSet(active, r.slot, r.setIndex)).length;
  return { done, total: order.length };
}
