import { blockSessions, BORROWED, findDrill, findExercise, type Routine, type RoutineItem } from "@repcurve/exercises";
import { meetsRequirements } from "@repcurve/shared";
import type { Equipment, Injury } from "@repcurve/shared";

/** Seconds to get into position before a drill starts. */
export const MOBILITY_READY_SEC = 10;
/** Seconds to change sides between two holds. */
export const MOBILITY_SWITCH_SEC = 5;
/** Seconds between sets: holds, then reps. */
export const MOBILITY_REST_SEC = { hold: 10, reps: 20 } as const;
/** A session counts toward its block when at least this share of its planned work was done. */
export const MOBILITY_COUNTS_AT = 0.5;

/** One drill of a session, as this person does it. */
export interface MobilityItem {
  /** Drill id, or a library exercise id. */
  id: string;
  name: string;
  kind: "hold" | "reps";
  /** A light strength exercise from the library rather than a mobility drill. */
  exercise: boolean;
  sided: boolean;
  /** Which side is which, e.g. "{Side} knee down". Missing means "{Side} side". */
  sideLabel?: string;
  sets: number;
  /** Seconds a hold lasts; reps (or counts) otherwise. */
  amount: number;
  /** What a rep drill counts, e.g. "circles each way". Missing means reps. */
  count?: string;
  /** Seconds one count takes, for the estimate. */
  countSec: number;
  cue: string;
  /** How to do it with the areas this person goes easy on. */
  ease: string[];
}

export type MobilityStepKind = "ready" | "work" | "switch" | "rest";

/**
 * One thing the session screen shows. "ready", "switch" and "rest" count down and move on by
 * themselves when hands-free is on, and wait for a tap when it's off. A "work" step of a hold
 * always counts down; a "work" step of reps ends when the person says it's done.
 */
export interface MobilityStep {
  kind: MobilityStepKind;
  /** Position of its drill in the plan's items. */
  item: number;
  /** 0-based set of that drill. */
  set: number;
  side?: "left" | "right";
  /** Seconds it runs for; null for reps, which aren't timed. */
  seconds: number | null;
  /** Seconds it's expected to take, for the session's estimated length. */
  estSec: number;
}

export interface MobilityPlan {
  routine: string;
  /** The routine's content version this was built from. */
  version: number;
  /** 0-based level of the routine. */
  level: number;
  name: string;
  items: MobilityItem[];
  steps: MobilityStep[];
  /** What differs from the routine as written, and why, in plain words. */
  changes: string[];
  /** Drills the person chose to leave out, which they can bring back. */
  leftOut: { id: string; name: string }[];
  estimatedSec: number;
}

export interface MobilityInput {
  equipment: Equipment;
  /** Areas the person goes easy on. */
  injuries: Injury[];
  /** Drills the person left out of this routine. */
  leftOut?: string[];
  /** Movement families this week's workouts already train, so the routine's strength work doesn't repeat them. */
  trainedFamilies?: string[];
}

const AREA: Record<Injury, string> = { knee: "knees", low_back: "lower back", shoulder: "shoulders", wrist: "wrists" };
const areas = (injuries: Injury[]): string => {
  const words = injuries.map((i) => AREA[i]);
  return words.length <= 1 ? words.join("") : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
};

type Resolved = { item: MobilityItem; family?: string } | { dropped: string; because: "area" | "equipment"; hit: Injury[] };

/** A drill or library exercise as a session item, or why this person can't be given it. */
function resolve(id: string, r: RoutineItem, input: MobilityInput): Resolved | null {
  const drill = findDrill(id);
  if (drill) {
    if (!meetsRequirements(drill.requires, input.equipment)) return { dropped: drill.name, because: "equipment", hit: [] };
    const hit = drill.avoidWith.filter((i) => input.injuries.includes(i));
    if (hit.length > 0) return { dropped: drill.name, because: "area", hit };
    const ease = input.injuries.flatMap((i) => drill.ease?.[i] ?? []);
    return {
      item: {
        id: drill.id,
        name: drill.name,
        kind: drill.kind,
        exercise: false,
        sided: drill.sided,
        ...(drill.sideLabel ? { sideLabel: drill.sideLabel } : {}),
        sets: r.sets,
        amount: r.amount,
        ...(drill.count ? { count: drill.count } : {}),
        countSec: drill.countSec ?? 4,
        cue: drill.cue,
        ease: [...new Set(ease)],
      },
    };
  }
  const e = findExercise(id);
  if (!e || e.tier === "retired") return null;
  if (!meetsRequirements(e.requires, input.equipment)) return { dropped: e.name, because: "equipment", hit: [] };
  const hit = e.avoidWith.filter((i) => input.injuries.includes(i));
  if (hit.length > 0) return { dropped: e.name, because: "area", hit };
  const borrowed = BORROWED[e.id];
  return {
    item: {
      id: e.id,
      name: e.name,
      kind: "reps",
      exercise: true,
      sided: e.unilateral,
      ...(borrowed?.sideLabel ? { sideLabel: borrowed.sideLabel } : {}),
      sets: r.sets,
      amount: r.amount,
      countSec: e.repTimeSec,
      cue: borrowed?.cue ?? e.cue ?? "",
      ease: [],
    },
    family: e.family,
  };
}

function stepsFor(item: MobilityItem, index: number): MobilityStep[] {
  const out: MobilityStep[] = [{ kind: "ready", item: index, set: 0, seconds: MOBILITY_READY_SEC, estSec: MOBILITY_READY_SEC }];
  const hold = item.kind === "hold";
  const seconds = hold ? item.amount : null;
  const estSec = hold ? item.amount : Math.round(item.amount * item.countSec);
  for (let set = 0; set < item.sets; set++) {
    if (set > 0) {
      const rest = MOBILITY_REST_SEC[item.kind];
      out.push({ kind: "rest", item: index, set, seconds: rest, estSec: rest });
    }
    if (!item.sided) {
      out.push({ kind: "work", item: index, set, seconds, estSec });
      continue;
    }
    out.push({ kind: "work", item: index, set, side: "left", seconds, estSec });
    // Reps go at the person's own pace, so there's nothing to count down between sides.
    if (hold) out.push({ kind: "switch", item: index, set, seconds: MOBILITY_SWITCH_SEC, estSec: MOBILITY_SWITCH_SEC });
    out.push({ kind: "work", item: index, set, side: "right", seconds, estSec });
  }
  return out;
}

/**
 * A routine as this person does it today: drills that tend to bother an area they go easy on
 * are swapped for a gentler one or left out, strength work their week's workouts already cover
 * isn't repeated, and anything they left out stays out. Every difference is said in `changes`.
 */
export function buildMobilityPlan(routine: Routine, level: number, input: MobilityInput): MobilityPlan {
  const at = Math.min(Math.max(0, Math.floor(level)), routine.levels.length - 1);
  const leftOut = new Set(input.leftOut ?? []);
  const trained = new Set(input.trainedFamilies ?? []);
  const items: MobilityItem[] = [];
  const changes: string[] = [];
  const out: { id: string; name: string }[] = [];

  for (const r of routine.levels[at]!.items) {
    let miss: Extract<Resolved, { dropped: string }> | null = null;
    let found: Extract<Resolved, { item: MobilityItem }> | null = null;
    /** The drill a gentler one stands in for, and the areas it would have bothered. */
    let instead: { name: string; hit: Injury[] } | null = null;
    for (const id of r.options) {
      const got = resolve(id, r, input);
      if (!got) continue;
      if ("item" in got) {
        found = got;
        break;
      }
      // Sparing an area: the gentler version of the same job, when there is one.
      const gentler = got.because === "area" ? findDrill(id)?.gentler : undefined;
      const swap = gentler ? resolve(gentler, r, input) : null;
      if (swap && "item" in swap) {
        found = swap;
        instead = { name: got.dropped, hit: got.hit };
        break;
      }
      miss ??= got;
    }
    if (!found) {
      if (miss) changes.push(miss.because === "area" ? `${miss.dropped} is left out, to go easy on your ${areas(miss.hit)}.` : `${miss.dropped} is left out: it needs equipment you don't have here.`);
      continue;
    }
    const id = found.item.id;
    // Already in the session (a gentler stand-in can be a drill the routine has anyway): once is enough.
    if (items.some((i) => i.id === id)) {
      if (instead) changes.push(`${instead.name} is left out, to go easy on your ${areas(instead.hit)}.`);
      continue;
    }
    if (leftOut.has(id)) {
      if (!out.some((o) => o.id === id)) out.push({ id, name: found.item.name });
      continue;
    }
    if (found.family && trained.has(found.family)) {
      changes.push(`${found.item.name} is left out: this week's workouts already train that movement.`);
      continue;
    }
    if (instead) changes.push(`${found.item.name} instead of ${instead.name.toLowerCase()}, to go easy on your ${areas(instead.hit)}.`);
    items.push(found.item);
  }

  const steps = items.flatMap(stepsFor);
  return {
    routine: routine.id,
    version: routine.version,
    level: at,
    name: routine.name,
    items,
    steps,
    changes,
    leftOut: out,
    estimatedSec: steps.reduce((n, s) => n + s.estSec, 0),
  };
}

/** A plan's length to the nearest minute, never less than one. */
export function mobilityMinutes(plan: Pick<MobilityPlan, "estimatedSec">): number {
  return Math.max(1, Math.round(plan.estimatedSec / 60));
}

/** How much of a drill there is, in words: "2 × 30 s each side", "8 switches". */
export function mobilityDose(item: Pick<MobilityItem, "kind" | "sets" | "amount" | "sided" | "count">): string {
  const sets = item.sets > 1 ? `${item.sets} × ` : "";
  if (item.kind === "hold") return `${sets}${item.amount} s${item.sided ? " each side" : ""}`;
  if (!item.count) return `${sets}${item.amount}${item.sets > 1 ? "" : " reps"}${item.sided ? " each side" : ""}`;
  return `${sets}${item.amount} ${item.count}${item.sided ? ", each side" : ""}`;
}

/** Seconds of drill work in a plan: holds and reps, without getting ready, switching or resting. */
export function mobilityWorkSec(steps: MobilityStep[]): number {
  return steps.reduce((n, s) => n + (s.kind === "work" ? s.estSec : 0), 0);
}

/** The level a block's next session is done at, after `done` sessions that counted: levels share the block evenly. */
export function blockLevel(routine: Routine, done: number): number {
  const total = blockSessions(routine);
  if (total <= 0) return 0;
  const each = total / routine.levels.length;
  return Math.min(routine.levels.length - 1, Math.max(0, Math.floor(done / each)));
}
