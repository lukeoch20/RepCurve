import { blockLevel, buildMobilityPlan, MOBILITY_COUNTS_AT, type MobilityPlan, type MobilityStep } from "@repcurve/engine";
import { blockSessions, findExercise, findRoutine, type Routine } from "@repcurve/exercises";
import { localWeek, planExerciseIds, weekSessions } from "./plan";
import type { Core, SessionRecord } from "./types";

/**
 * Mobility sessions: stretches and slow drills run from a timer, apart from the workouts.
 * A routine can be done once, or as a block of sessions over some weeks. Finished sessions are
 * kept with the rest of the person's data; the one under way lives on the device only.
 */

const DAY_MS = 86_400_000;
/** Days without a block session after which the first one back is a level easier. */
export const EASE_BACK_DAYS = 14;
/** A countdown found this long past its end was asleep (the phone locked): the session waits for the person. */
export const LATE_MS = 20_000;
/** A session left open this long is closed by itself, keeping what was done. */
export const MOBILITY_STALE_MS = 6 * 3_600_000;
/** Finished sessions are kept this long: older ones have done their job. */
const KEEP_MS = 366 * DAY_MS;

/** A block of sessions in progress. */
export interface MobilityBlock {
  routine: string;
  startedAt: number;
  /** Sessions that counted so far in this round. */
  done: number;
  /** 1 for the first run through the block; later rounds stay at the top level. Missing means 1. */
  round?: number;
  /** The level (0-based) the person asked to stay at. Missing means the block's own pace. */
  level?: number;
  /** When the person paused the block. Missing while it's running. */
  pausedAt?: number;
}

/** What was planned and done of one drill in a finished session, in seconds of work. */
export interface MobilityDrillLog {
  id: string;
  plannedSec: number;
  doneSec: number;
  /** Left before it was finished. */
  skipped?: boolean;
  /** Stopped because something hurt. */
  hurt?: boolean;
}

export interface MobilityEntry {
  id: string;
  routine: string;
  /** The routine's content version it was built from. */
  version: number;
  level: number;
  startedAt: number;
  finishedAt: number;
  /** Minutes from start to finish, pauses left out. */
  minutes: number;
  drills: MobilityDrillLog[];
  /** Its number in the block's round, when it counted toward one. */
  blockSession?: number;
}

/** Everything kept about mobility. */
export interface MobilityState {
  block?: MobilityBlock;
  /** Finished sessions, oldest first. */
  log: MobilityEntry[];
  /** Drills the person left out of a routine, by routine. Missing means none. */
  leftOut?: Record<string, string[]>;
  /** False when each hold should wait for a tap. Missing means holds follow on by themselves. */
  handsFree?: boolean;
}

/** A session under way. */
export interface ActiveMobility {
  id: string;
  plan: MobilityPlan;
  /** Counts toward the block in progress, rather than being a one-off. */
  block: boolean;
  startedAt: number;
  stepIndex: number;
  /** Epoch ms when the current step's countdown ends; null while it waits for a tap or is paused. */
  endsAt: number | null;
  /** Milliseconds left in the current step while nothing is counting down. */
  remainingMs: number;
  pausedAt: number | null;
  /** Total milliseconds spent paused so far. */
  pausedMs: number;
  /** Getting ready, switching sides and resting count down and move on by themselves. */
  handsFree: boolean;
  /** Seconds of work done per drill, in the plan's order. */
  doneSec: number[];
  /** Drills (positions in the plan) left before they were finished. */
  skipped: number[];
  /** Drills stopped because something hurt. */
  hurt: number[];
  /** Every step is behind: waiting to be saved. */
  finished: boolean;
  /** When the session last moved on, so time away isn't counted as time spent. */
  touchedAt: number;
}

// ---------------------------------------------------------------- planning

/** Movement families this week's workouts train, done or still to come, so a routine doesn't repeat them. */
export function trainedFamilies(core: Core, history: SessionRecord[], now: number): string[] {
  const out = new Set<string>();
  for (const s of weekSessions(core, history, now).sessions) {
    if (s.plan.kind !== "strength" || s.status === "skipped") continue;
    for (const id of planExerciseIds(s.plan)) {
      const family = findExercise(id)?.family;
      if (family) out.add(family);
    }
  }
  return [...out];
}

/** A routine as this person does it now, at a level. */
export function routinePlan(core: Core, routine: Routine, level: number, trained: string[]): MobilityPlan {
  return buildMobilityPlan(routine, level, {
    equipment: core.equipment,
    injuries: core.profile.injuries,
    leftOut: core.mobility?.leftOut?.[routine.id] ?? [],
    trainedFamilies: trained,
  });
}

/** Whether the person stopped this drill for pain the last time it came up. */
export function stoppedForPain(core: Pick<Core, "mobility">, drill: string): boolean {
  const log = core.mobility?.log ?? [];
  for (let i = log.length - 1; i >= 0; i--) {
    const d = log[i]!.drills.find((x) => x.id === drill);
    if (d) return d.hurt === true;
  }
  return false;
}

// ---------------------------------------------------------------- blocks

export interface BlockStatus {
  routine: Routine;
  block: MobilityBlock;
  done: number;
  total: number;
  /** 1-based week of the block the next session belongs to. */
  week: number;
  weeks: number;
  /** 0-based level the next session is done at. */
  level: number;
  /** Why that level isn't the block's own pace, when it isn't. */
  levelNote: string | null;
  perWeek: number;
  /** Block sessions finished this calendar week (Monday to Sunday). */
  thisWeek: number;
  doneToday: boolean;
  /** Every session is done: time for the review. */
  reviewDue: boolean;
  paused: boolean;
}

const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();
const startOfDay = (t: number) => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};
/** Calendar days from one moment to a later one, in the person's own time zone. */
const daysBetween = (from: number, to: number) => Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS);

/** Where the block in progress stands, or null without one (or when its routine is gone). */
export function blockStatus(core: Pick<Core, "mobility">, now: number): BlockStatus | null {
  const block = core.mobility?.block;
  const routine = block ? findRoutine(block.routine) : undefined;
  if (!block || !routine || routine.kind !== "block") return null;
  const total = blockSessions(routine);
  const perWeek = routine.perWeek ?? 1;
  const top = routine.levels.length - 1;
  const done = Math.min(block.done, total);
  const counted = (core.mobility?.log ?? []).filter((e) => e.routine === routine.id && e.blockSession !== undefined && e.finishedAt >= block.startedAt);
  const last = counted[counted.length - 1];
  const pace = (block.round ?? 1) > 1 ? top : blockLevel(routine, done);
  let level = block.level !== undefined ? Math.min(pace, Math.max(0, block.level)) : pace;
  let levelNote = level < pace ? `Staying at level ${level + 1}, as you asked.` : null;
  const away = last ? daysBetween(last.finishedAt, now) : 0;
  if (away >= EASE_BACK_DAYS && level > 0 && done < total) {
    level -= 1;
    levelNote = `It's been ${away} days, so this one is a level easier. The one after goes back up.`;
  }
  return {
    routine,
    block,
    done,
    total,
    week: Math.min(routine.weeks ?? 1, Math.floor(done / perWeek) + 1),
    weeks: routine.weeks ?? 1,
    level,
    levelNote,
    perWeek,
    thisWeek: counted.filter((e) => localWeek(e.finishedAt) === localWeek(now)).length,
    doneToday: last !== undefined && sameDay(last.finishedAt, now),
    reviewDue: done >= total,
    paused: block.pausedAt !== undefined,
  };
}

const withMobility = (core: Core, change: Partial<MobilityState>): Core => ({ ...core, mobility: { log: [], ...core.mobility, ...change } });

function withBlock(core: Core, block: MobilityBlock | undefined): Core {
  const { block: _, ...rest } = { log: [], ...core.mobility };
  return { ...core, mobility: block ? { ...rest, block } : rest };
}

/** Start a block. One runs at a time: starting another replaces it. */
export function startBlock(core: Core, routine: string, now: number): Core {
  const r = findRoutine(routine);
  return r?.kind === "block" ? withBlock(core, { routine, startedAt: now, done: 0 }) : core;
}

export function pauseBlock(core: Core, now: number): Core {
  const block = core.mobility?.block;
  return block && block.pausedAt === undefined ? withBlock(core, { ...block, pausedAt: now }) : core;
}

export function resumeBlock(core: Core): Core {
  const block = core.mobility?.block;
  if (!block || block.pausedAt === undefined) return core;
  const { pausedAt: _, ...rest } = block;
  return withBlock(core, rest);
}

/** Stop the block. Its finished sessions stay in the log. */
export function endBlock(core: Core): Core {
  return core.mobility?.block ? withBlock(core, undefined) : core;
}

/** After the review: the same block again, staying at its top level. */
export function anotherRound(core: Core, now: number): Core {
  const block = core.mobility?.block;
  return block ? withBlock(core, { routine: block.routine, startedAt: now, done: 0, round: (block.round ?? 1) + 1 }) : core;
}

/** Stay at a level (0-based), or null to go back to the block's own pace. */
export function setBlockLevel(core: Core, level: number | null): Core {
  const block = core.mobility?.block;
  if (!block) return core;
  const { level: _, ...rest } = block;
  return withBlock(core, level === null ? rest : { ...rest, level: Math.max(0, Math.floor(level)) });
}

/** Leave a drill out of a routine, or bring it back. */
export function setLeftOut(core: Core, routine: string, drill: string, out: boolean): Core {
  const all = { ...core.mobility?.leftOut };
  const list = (all[routine] ?? []).filter((d) => d !== drill);
  if (out) list.push(drill);
  if (list.length > 0) all[routine] = list;
  else delete all[routine];
  return withMobility(core, { leftOut: all });
}

export function setHandsFree(core: Core, on: boolean): Core {
  return withMobility(core, { handsFree: on });
}

/** Holds follow on by themselves unless the person turned that off. */
export const handsFreeOn = (core: Pick<Core, "mobility">): boolean => core.mobility?.handsFree !== false;

// ---------------------------------------------------------------- a session under way

/** Whether a step counts down by itself: a hold always does; the pauses around it do when hands-free is on. */
const countsDown = (a: Pick<ActiveMobility, "handsFree">, step: MobilityStep): boolean => step.seconds !== null && (step.kind === "work" || a.handsFree);

function enter(a: ActiveMobility, index: number, now: number): ActiveMobility {
  const step = a.plan.steps[index];
  if (!step) return { ...a, endsAt: null, remainingMs: 0, finished: true, touchedAt: now };
  const ms = (step.seconds ?? 0) * 1000;
  return { ...a, stepIndex: index, remainingMs: ms, endsAt: countsDown(a, step) ? now + ms : null, touchedAt: now };
}

export function startMobility(plan: MobilityPlan, opts: { block: boolean; handsFree: boolean }, now: number): ActiveMobility {
  const a: ActiveMobility = {
    id: `m-${now.toString(36)}`,
    plan,
    block: opts.block,
    startedAt: now,
    stepIndex: 0,
    endsAt: null,
    remainingMs: 0,
    pausedAt: null,
    pausedMs: 0,
    handsFree: opts.handsFree,
    doneSec: plan.items.map(() => 0),
    skipped: [],
    hurt: [],
    finished: false,
    touchedAt: now,
  };
  return enter(a, 0, now);
}

/** The step on screen, or null once the session has run out of steps. */
export function currentStep(a: ActiveMobility): MobilityStep | null {
  return a.finished ? null : (a.plan.steps[a.stepIndex] ?? null);
}

/** Milliseconds left in the current step: never more than the step is long, whatever clock `now` came from. */
export function stepRemainingMs(a: ActiveMobility, now: number): number {
  if (a.endsAt === null || a.pausedAt !== null) return a.remainingMs;
  const whole = (a.plan.steps[a.stepIndex]?.seconds ?? 0) * 1000;
  return Math.max(0, Math.min(whole, a.endsAt - now));
}

/** Whether the current step is counting down right now. */
export const isCounting = (a: ActiveMobility): boolean => !a.finished && a.pausedAt === null && a.endsAt !== null;

/** Whole seconds of a hold held so far. */
function heldSec(a: ActiveMobility, step: MobilityStep, now: number): number {
  if (step.kind !== "work" || step.seconds === null) return 0;
  return Math.max(0, Math.min(step.seconds, step.seconds - Math.ceil(stepRemainingMs(a, now) / 1000)));
}

function credit(a: ActiveMobility, item: number, sec: number): number[] {
  return sec > 0 ? a.doneSec.map((s, i) => (i === item ? s + sec : s)) : a.doneSec;
}

/** Move past the countdown that just ended. One step at a time: the next one's clock starts now. */
export function tickMobility(a: ActiveMobility, now: number): ActiveMobility {
  if (a.finished || a.pausedAt !== null || a.endsAt === null || now < a.endsAt) return a;
  const step = a.plan.steps[a.stepIndex]!;
  const late = now - a.endsAt > LATE_MS;
  const next = enter({ ...a, doneSec: credit(a, step.item, step.kind === "work" ? (step.seconds ?? 0) : 0) }, a.stepIndex + 1, now);
  // It ended while the app was asleep: wait for the person rather than running on without them.
  return late && !next.finished ? pauseMobility(next, now) : next;
}

/** The person moves on: starts what was waiting, finishes their reps, or ends a hold early (it counts for the time held). */
export function nextMobility(a: ActiveMobility, now: number): ActiveMobility {
  if (a.finished || a.pausedAt !== null) return a;
  const step = a.plan.steps[a.stepIndex]!;
  const sec = step.kind !== "work" ? 0 : step.seconds === null ? step.estSec : heldSec(a, step, now);
  return enter({ ...a, doneSec: credit(a, step.item, sec) }, a.stepIndex + 1, now);
}

const unpaused = (a: ActiveMobility, now: number): ActiveMobility => (a.pausedAt === null ? a : { ...a, pausedAt: null, pausedMs: a.pausedMs + (now - a.pausedAt) });

/**
 * Leave the rest of the current drill: on to the next one. `hurt` says it was stopped for pain,
 * and then the next drill waits for a tap even hands-free: nothing starts by itself after pain.
 */
export function skipDrill(a: ActiveMobility, now: number, hurt = false): ActiveMobility {
  if (a.finished) return a;
  const step = a.plan.steps[a.stepIndex]!;
  const doneSec = credit(a, step.item, heldSec(a, step, now));
  let next = a.stepIndex + 1;
  while (next < a.plan.steps.length && a.plan.steps[next]!.item === step.item) next++;
  const add = (list: number[]) => (list.includes(step.item) ? list : [...list, step.item]);
  const entered = enter({ ...unpaused(a, now), doneSec, skipped: add(a.skipped), hurt: hurt ? add(a.hurt) : a.hurt }, next, now);
  return hurt && !entered.finished ? { ...entered, endsAt: null } : entered;
}

/** Start the current step again from the top, e.g. after losing the position. */
export function restartStep(a: ActiveMobility, now: number): ActiveMobility {
  return a.finished ? a : enter(unpaused(a, now), a.stepIndex, now);
}

export function pauseMobility(a: ActiveMobility, now: number): ActiveMobility {
  if (a.finished || a.pausedAt !== null) return a;
  return { ...a, remainingMs: stepRemainingMs(a, now), endsAt: null, pausedAt: now, touchedAt: now };
}

export function resumeMobility(a: ActiveMobility, now: number): ActiveMobility {
  if (a.pausedAt === null) return a;
  const step = a.plan.steps[a.stepIndex];
  const on = unpaused(a, now);
  return { ...on, endsAt: step && !a.finished && countsDown(on, step) ? now + a.remainingMs : null, touchedAt: now };
}

/** Turn hands-free on or off mid-session: a pause that was waiting starts counting, or one that was counting waits. */
export function sessionHandsFree(a: ActiveMobility, on: boolean, now: number): ActiveMobility {
  if (a.handsFree === on) return a;
  const next = { ...a, handsFree: on };
  const step = currentStep(a);
  if (!step || step.kind === "work" || a.pausedAt !== null) return next;
  return on ? { ...next, endsAt: now + a.remainingMs, touchedAt: now } : { ...next, remainingMs: stepRemainingMs(a, now), endsAt: null, touchedAt: now };
}

/** Milliseconds spent in the session up to `now`, pauses left out. */
export function mobilityElapsedMs(a: ActiveMobility, now: number): number {
  return Math.max(0, now - a.startedAt - a.pausedMs - (a.pausedAt !== null ? Math.max(0, now - a.pausedAt) : 0));
}

/** Seconds of work planned for each drill of a plan, in its order. */
export function plannedSec(plan: MobilityPlan): number[] {
  const out = plan.items.map(() => 0);
  for (const s of plan.steps) if (s.kind === "work") out[s.item]! += s.estSec;
  return out;
}

/** Share of the planned work done so far, 0 to 1. */
export function mobilityProgress(a: ActiveMobility): number {
  const planned = plannedSec(a.plan);
  const total = planned.reduce((n, s) => n + s, 0);
  if (total === 0) return 0;
  return Math.min(1, a.doneSec.reduce((n, s, i) => n + Math.min(s, planned[i]!), 0) / total);
}

/**
 * Close the session and keep what was done, the part of a hold under way included. With nothing
 * done there's nothing to keep (entry is null). A block session counts toward the block when at
 * least half its planned work was done. `endedAt` closes it as of an earlier moment, for a
 * session that was left open.
 */
export function finishMobility(a: ActiveMobility, core: Core, now: number, endedAt = now): { core: Core; entry: MobilityEntry | null } {
  const planned = plannedSec(a.plan);
  const end = Math.min(endedAt, now);
  const step = currentStep(a);
  const doneSec = step ? credit(a, step.item, heldSec(a, step, end)) : a.doneSec;
  const drills: MobilityDrillLog[] = a.plan.items.map((it, i) => ({
    id: it.id,
    plannedSec: planned[i]!,
    doneSec: Math.min(planned[i]!, Math.round(doneSec[i] ?? 0)),
    ...(a.skipped.includes(i) ? { skipped: true } : {}),
    ...(a.hurt.includes(i) ? { hurt: true } : {}),
  }));
  const total = planned.reduce((n, s) => n + s, 0);
  const done = drills.reduce((n, d) => n + d.doneSec, 0);
  // A drill stopped for pain is worth remembering even when nothing else was done.
  if (done === 0 && a.hurt.length === 0) return { core, entry: null };
  // Time away with the app closed never counts: no longer than three times the plan.
  const ms = Math.min(mobilityElapsedMs(a, end), a.plan.estimatedSec * 3000);
  const running = core.mobility?.block;
  // The block this session counts toward, if it does.
  const block = a.block && running && running.routine === a.plan.routine && running.pausedAt === undefined && total > 0 && done / total >= MOBILITY_COUNTS_AT ? running : null;
  const entry: MobilityEntry = {
    id: a.id,
    routine: a.plan.routine,
    version: a.plan.version,
    level: a.plan.level,
    startedAt: a.startedAt,
    finishedAt: end,
    minutes: Math.max(1, Math.round(ms / 60_000)),
    drills,
    ...(block ? { blockSession: block.done + 1 } : {}),
  };
  const log = [...(core.mobility?.log ?? []).filter((e) => e.finishedAt >= end - KEEP_MS && e.id !== entry.id), entry];
  const next = withMobility(core, { log });
  return { core: block ? withBlock(next, { ...block, done: block.done + 1 }) : next, entry };
}

// ---------------------------------------------------------------- restoring one after a reload

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const indexes = (x: unknown, n: number): number[] => (Array.isArray(x) ? [...new Set(x.filter((i): i is number => Number.isInteger(i) && i >= 0 && i < n))] : []);

/**
 * A session read back from the device after a reload, paused where it was with the interrupted
 * step ready to start again. Null when it can't be read, or was built from a routine that has
 * since changed.
 */
export function restoreMobility(saved: unknown, now: number): ActiveMobility | null {
  if (!isObj(saved) || typeof saved["id"] !== "string" || !isNum(saved["startedAt"]) || !isObj(saved["plan"])) return null;
  const plan = saved["plan"] as unknown as MobilityPlan;
  const routine = typeof plan.routine === "string" ? findRoutine(plan.routine) : undefined;
  if (!routine || routine.version !== plan.version || !Array.isArray(plan.items) || !Array.isArray(plan.steps) || plan.steps.length === 0) return null;
  const stepOk = (s: unknown) => isObj(s) && isNum(s["item"]) && s["item"] >= 0 && s["item"] < plan.items.length && isNum(s["estSec"]) && (s["seconds"] === null || isNum(s["seconds"]));
  const itemOk = (i: unknown) => isObj(i) && typeof i["id"] === "string" && typeof i["name"] === "string" && typeof i["cue"] === "string" && isNum(i["sets"]) && isNum(i["amount"]) && Array.isArray(i["ease"]);
  if (!plan.steps.every(stepOk) || !plan.items.every(itemOk) || !isNum(plan.estimatedSec)) return null;
  const finished = saved["finished"] === true;
  const stepIndex = isNum(saved["stepIndex"]) ? Math.min(plan.steps.length - 1, Math.max(0, Math.floor(saved["stepIndex"]))) : 0;
  const touchedAt = isNum(saved["touchedAt"]) ? Math.min(now, saved["touchedAt"]) : Math.min(now, saved["startedAt"]);
  const endsAt = isNum(saved["endsAt"]) ? saved["endsAt"] : null;
  const pausedAt = isNum(saved["pausedAt"]) ? Math.min(now, saved["pausedAt"]) : endsAt !== null ? Math.min(now, endsAt) : touchedAt;
  const doneSec = plan.items.map((_, i) => (Array.isArray(saved["doneSec"]) && isNum(saved["doneSec"][i]) ? Math.max(0, saved["doneSec"][i]) : 0));
  return {
    id: saved["id"],
    plan,
    block: saved["block"] === true,
    startedAt: Math.min(now, saved["startedAt"]),
    stepIndex,
    endsAt: null,
    remainingMs: finished ? 0 : (plan.steps[stepIndex]!.seconds ?? 0) * 1000,
    pausedAt: finished ? null : pausedAt,
    pausedMs: isNum(saved["pausedMs"]) ? Math.max(0, saved["pausedMs"]) : 0,
    handsFree: saved["handsFree"] !== false,
    doneSec,
    skipped: indexes(saved["skipped"], plan.items.length),
    hurt: indexes(saved["hurt"], plan.items.length),
    finished,
    touchedAt,
  };
}

// ---------------------------------------------------------------- stored data

const keptEntry = (e: unknown): e is MobilityEntry =>
  isObj(e) && typeof e["id"] === "string" && typeof e["routine"] === "string" && isNum(e["finishedAt"]) && isNum(e["minutes"]) && Array.isArray(e["drills"]);

/**
 * Stored mobility data in the shape the app reads: sessions it can list, a block only for a
 * routine it still has, and left-out drills as lists of names. Undefined when there's nothing.
 */
export function migrateMobility(m: unknown): MobilityState | undefined {
  if (!isObj(m)) return undefined;
  const log = (Array.isArray(m["log"]) ? (m["log"] as unknown[]) : []).filter(keptEntry).map((e) => ({
    ...e,
    version: isNum(e.version) ? e.version : 1,
    level: isNum(e.level) ? Math.max(0, Math.floor(e.level)) : 0,
    startedAt: isNum(e.startedAt) ? e.startedAt : e.finishedAt,
    minutes: Math.min(24 * 60, Math.max(0, e.minutes)),
    drills: (e.drills as unknown[])
      .filter((d): d is MobilityDrillLog => isObj(d) && typeof d["id"] === "string" && isNum(d["plannedSec"]) && isNum(d["doneSec"]))
      .map((d) => ({ id: d.id, plannedSec: Math.max(0, d.plannedSec), doneSec: Math.max(0, d.doneSec), ...(d.skipped === true ? { skipped: true } : {}), ...(d.hurt === true ? { hurt: true } : {}) })),
  }));
  const { block: _b, leftOut: _l, handsFree: _h, log: _log, ...rest } = m;
  const out: MobilityState = { ...rest, log: log.sort((a, b) => a.finishedAt - b.finishedAt) };
  const b = m["block"];
  if (isObj(b) && typeof b["routine"] === "string" && findRoutine(b["routine"])?.kind === "block" && isNum(b["startedAt"])) {
    const routine = findRoutine(b["routine"])!;
    out.block = {
      routine: routine.id,
      startedAt: b["startedAt"],
      done: isNum(b["done"]) ? Math.min(blockSessions(routine), Math.max(0, Math.floor(b["done"]))) : 0,
      ...(isNum(b["round"]) && b["round"] > 1 ? { round: Math.floor(b["round"]) } : {}),
      ...(isNum(b["level"]) ? { level: Math.min(routine.levels.length - 1, Math.max(0, Math.floor(b["level"]))) } : {}),
      ...(isNum(b["pausedAt"]) ? { pausedAt: b["pausedAt"] } : {}),
    };
  }
  if (isObj(m["leftOut"])) {
    const leftOut: Record<string, string[]> = {};
    for (const [routine, list] of Object.entries(m["leftOut"])) {
      const ids = Array.isArray(list) ? [...new Set(list.filter((d): d is string => typeof d === "string"))] : [];
      if (ids.length > 0) leftOut[routine] = ids;
    }
    if (Object.keys(leftOut).length > 0) out.leftOut = leftOut;
  }
  if (typeof m["handsFree"] === "boolean") out.handsFree = m["handsFree"];
  return out.block || out.log.length > 0 || out.leftOut || out.handsFree !== undefined || Object.keys(rest).length > 0 ? out : undefined;
}

// ---------------------------------------------------------------- looking back

export interface MobilityTotals {
  sessions: number;
  minutes: number;
  /** Sessions this calendar week. */
  thisWeek: number;
}

export function mobilityTotals(core: Pick<Core, "mobility">, now: number): MobilityTotals {
  const log = core.mobility?.log ?? [];
  return { sessions: log.length, minutes: log.reduce((n, e) => n + e.minutes, 0), thisWeek: log.filter((e) => localWeek(e.finishedAt) === localWeek(now)).length };
}
