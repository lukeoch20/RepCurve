import {
  adviseNextSet,
  fitToBudget,
  preferExercise,
  prescriptionsOf,
  recordSession,
  swapPrescription,
  type ExerciseChange,
  type Prescription,
  type SessionPlan,
} from "@repcurve/engine";
import { getExercise } from "@repcurve/exercises";
import type { Rir } from "@repcurve/shared";
import { contextFor, todayPlan } from "./plan";
import type { ActiveSession, CardioProgress, CardioResult, Core, LoggedSet, SessionRecord, TimerState } from "./types";

/** Rest between sets of the core finisher. */
export const FINISHER_REST_SEC = 30;

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

/** Every set in the order they are done: round by round through each superset, then the finisher. */
export function setOrder(plan: SessionPlan): SetRef[] {
  const out: SetRef[] = [];
  plan.supersets.forEach((ss, g) => {
    for (let r = 0; r < ss.rounds; r++) {
      ss.items.forEach((p, i) =>
        out.push({ slot: p.slot, exerciseId: p.exerciseId, setIndex: r, group: g, round: r, position: i, label: `${ss.label}${i + 1}` }),
      );
    }
  });
  const f = plan.finisher;
  if (f) for (let r = 0; r < f.sets; r++) out.push({ slot: f.slot, exerciseId: f.exerciseId, setIndex: r, group: -1, round: r, position: 0, label: "Core" });
  return out;
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

function pending(active: ActiveSession, sets = active.sets): SetRef[] {
  return setOrder(active.plan).filter(
    (r) => !active.skippedSlots.includes(r.slot) && !sets.some((s) => s.slot === r.slot && s.setIndex === r.setIndex),
  );
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

export function describeRef(plan: SessionPlan, ref: SetRef): string {
  const p = prescriptionAt(plan, ref.slot);
  const name = p?.name ?? getExercise(ref.exerciseId).name;
  const total = ref.group === -1 ? (plan.finisher?.sets ?? 1) : (plan.supersets[ref.group]?.rounds ?? 1);
  return `${ref.label} ${name} · set ${ref.setIndex + 1} of ${total}`;
}

export interface SetValues {
  loadKg: number | null;
  reps: number;
  rir: Rir;
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
  return { kind, endsAt: now + durationSec * 1000, durationSec, next: describeRef(active.plan, next) };
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
  };
  if (v.painFlag) set.painFlag = true;
  const sets = [...active.sets.filter((s) => !(s.slot === ref.slot && s.setIndex === ref.setIndex)), set];
  const skippedSlots = v.painFlag && !active.skippedSlots.includes(ref.slot) ? [...active.skippedSlots, ref.slot] : active.skippedSlots;
  const next: ActiveSession = { ...active, sets, skippedSlots, ...coach(active, ref.slot, sets, core) };
  return { ...next, timer: timerAfter(next, ref, sets, core, now) };
}

export function editSet(active: ActiveSession, slot: string, setIndex: number, v: SetValues, core: Core): ActiveSession {
  const existing = loggedSet(active, slot, setIndex);
  if (!existing) return active;
  const updated: LoggedSet = { ...existing, loadKg: existing.loadKg === null ? null : v.loadKg, reps: Math.max(0, Math.round(v.reps)), rir: v.rir };
  if (v.painFlag) updated.painFlag = true;
  else delete updated.painFlag;
  const sets = active.sets.map((s) => (s === existing ? updated : s));
  return { ...active, sets, ...coach(active, slot, sets, core) };
}

export function removeSet(active: ActiveSession, slot: string, setIndex: number, core: Core): ActiveSession {
  const sets = active.sets.filter((s) => !(s.slot === slot && s.setIndex === setIndex));
  return { ...active, sets, ...coach(active, slot, sets, core) };
}

export function skipSlot(active: ActiveSession, slot: string): ActiveSession {
  if (active.skippedSlots.includes(slot)) return active;
  return { ...active, skippedSlots: [...active.skippedSlots, slot], timer: null };
}

export function unskipSlot(active: ActiveSession, slot: string): ActiveSession {
  return { ...active, skippedSlots: active.skippedSlots.filter((s) => s !== slot) };
}

/** Swap an exercise before any of its sets are logged. A permanent swap also updates the training state. */
export function swapExercise(
  active: ActiveSession,
  core: Core,
  slot: string,
  exerciseId: string,
  permanent: boolean,
): { active: ActiveSession; core: Core } {
  const p = prescriptionAt(active.plan, slot);
  if (!p || setsForSlot(active, slot).length > 0) return { active, core };
  const ctx = contextFor(core);
  const state = permanent ? preferExercise(core.state, p.exerciseId, exerciseId) : core.state;
  const np = swapPrescription(p, exerciseId, state, ctx);
  const replace = (x: Prescription) => (x.slot === slot ? np : x);
  const plan: SessionPlan = {
    ...active.plan,
    supersets: active.plan.supersets.map((ss) => ({ ...ss, items: ss.items.map(replace) })),
    finisher: active.plan.finisher ? replace(active.plan.finisher) : null,
  };
  const { [slot]: _a, ...advice } = active.advice;
  const { [slot]: _n, ...nextSet } = active.nextSet;
  return { active: { ...active, plan, advice, nextSet }, core: permanent ? { ...core, state } : core };
}

// ---------------------------------------------------------------- timers

export function timerRemainingMs(timer: TimerState, now: number, pausedAt: number | null): number {
  return timer.endsAt - (pausedAt ?? now);
}

export function adjustTimer(active: ActiveSession, deltaSec: number, now: number): ActiveSession {
  const t = active.timer;
  if (!t) return active;
  const ref = active.pausedAt ?? now;
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

/** Move past any segments that have ended. Returns how many segment boundaries were crossed. */
export function tickCardio(active: ActiveSession, now: number): { active: ActiveSession; crossed: number } {
  const c = active.cardio;
  const segs = active.plan.cardio?.segments ?? [];
  if (!c || !c.started || c.finished || c.segmentEndsAt === null || now < c.segmentEndsAt) return { active, crossed: 0 };
  let segmentIndex = c.segmentIndex;
  let segmentEndsAt: number | null = c.segmentEndsAt;
  let crossed = 0;
  let finished = false;
  while (segmentEndsAt !== null && now >= segmentEndsAt) {
    crossed++;
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
  return { active: { ...active, cardio: { ...c, segmentIndex, segmentEndsAt, remainingMs, finished } }, crossed };
}

export function skipSegment(active: ActiveSession, now: number): ActiveSession {
  const c = active.cardio;
  const segs = active.plan.cardio?.segments ?? [];
  if (!c || c.finished) return active;
  const nextIndex = c.segmentIndex + 1;
  if (nextIndex >= segs.length) return { ...active, cardio: { ...c, finished: true, segmentEndsAt: null, remainingMs: 0 } };
  const ms = segmentMs(active.plan, nextIndex);
  const running = c.started && active.pausedAt === null;
  return {
    ...active,
    cardio: { ...c, started: true, segmentIndex: nextIndex, remainingMs: ms, segmentEndsAt: running ? now + ms : c.started ? null : now + ms },
  };
}

export function cardioRemainingMs(active: ActiveSession, now: number): number {
  const c = active.cardio;
  if (!c) return 0;
  if (c.segmentEndsAt !== null && active.pausedAt === null) return Math.max(0, c.segmentEndsAt - now);
  return c.remainingMs;
}

/** Minutes of cardio done so far: finished segments plus the elapsed part of the current one. */
export function cardioMinutesDone(active: ActiveSession, now: number): number {
  const c = active.cardio;
  const segs = active.plan.cardio?.segments ?? [];
  if (!c || !c.started) return 0;
  if (c.finished) return segs.reduce((n, s) => n + s.minutes, 0);
  const before = segs.slice(0, c.segmentIndex).reduce((n, s) => n + s.minutes, 0);
  const current = (segs[c.segmentIndex]?.minutes ?? 0) - cardioRemainingMs(active, now) / 60_000;
  return Math.round((before + Math.max(0, current)) * 10) / 10;
}

// ---------------------------------------------------------------- lifecycle

export function startSession(core: Core, history: SessionRecord[], now: number, minutes: number | null): ActiveSession {
  const plan = todayPlan(core, history, now, minutes);
  return {
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
        ? { segmentIndex: 0, segmentEndsAt: null, remainingMs: segmentMs(plan, 0), started: false, finished: false }
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

function baseRecord(active: ActiveSession, now: number): Omit<SessionRecord, "changes" | "cardio" | "skipped"> {
  return {
    id: active.id,
    index: active.index,
    kind: active.plan.kind,
    name: active.plan.name,
    week: active.plan.week,
    startedAt: active.startedAt,
    finishedAt: now,
    activeMinutes: Math.round(elapsedMs(active, now) / 60_000),
    plan: active.plan,
    sets: active.sets,
    deload: active.plan.deload,
    comeback: active.plan.comeback,
  };
}

/** Close the session: progress every exercise and move on to the next session. */
export function finishSession(active: ActiveSession, core: Core, now: number, cardio?: CardioResult): { core: Core; record: SessionRecord } {
  let state = core.state;
  let changes: ExerciseChange[] = [];
  if (active.plan.kind === "strength") {
    const result = recordSession(core.state, active.plan, active.sets, contextFor(core));
    state = result.state;
    changes = result.changes;
  }
  const record: SessionRecord = { ...baseRecord(active, now), changes, cardio: cardio ?? null, skipped: false };
  return { core: { ...core, state, nextIndex: Math.max(core.nextIndex, active.index + 1) }, record };
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
  const order = setOrder(active.plan).filter((r) => !active.skippedSlots.includes(r.slot));
  const done = order.filter((r) => loggedSet(active, r.slot, r.setIndex)).length;
  return { done, total: order.length };
}
