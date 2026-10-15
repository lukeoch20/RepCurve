import type { Split } from "@repcurve/shared";
import { initialTrainingState, TARGET_RIR, type CardioActivity, type TrainingState } from "@repcurve/engine";
import { findExercise } from "@repcurve/exercises";
import { MACHINES } from "@repcurve/shared";
import type { Band, Dumbbells, Equipment, Goal, Injury, Profile, Rir, TrainingHistory, Units } from "@repcurve/shared";
import { validTime, type Reminders } from "./calendar";
import { upgradeEquipment } from "./equipment";
import { MAX_ADDED_SETS } from "./session";
import { migrateOverrides } from "./profile";
import { migrateSoreCheck, migrateSoreness } from "./soreness";
import { DATA_VERSION, DEFAULT_SETTINGS, EMPTY_DATA, type ActiveSession, type AppData, type Core, type LoggedSet, type Locations, type SessionRecord, type Settings } from "./types";

/**
 * Bring stored or imported data up to the current shape: fill defaults that older versions
 * lacked, bring values the engine can't plan with back into range, and drop anything the app
 * can no longer use (malformed records, exercises the library no longer has) instead of crashing
 * on it later. Fields this version doesn't know are kept as they are, so data saved by a newer
 * version survives a visit from an older one.
 */

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const known = (id: unknown): id is string => typeof id === "string" && findExercise(id) !== undefined;
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
/** A whole number kept in range, or the fallback when it isn't a number at all. */
const whole = (x: unknown, lo: number, hi: number, fallback: number): number => (isNum(x) ? clamp(Math.round(x), lo, hi) : fallback);
/** The values of a list that are among the allowed ones, once each, in the list's order. */
const onlyKnown = <T,>(list: unknown, allowed: readonly T[]): T[] =>
  Array.isArray(list) ? [...new Set(list)].filter((x): x is T => allowed.includes(x as T)) : [];

const HISTORIES: TrainingHistory[] = ["never", "a_little", "lapsed", "regular"];
const GOALS: Goal[] = ["strength_muscle", "fitness", "both"];
const INJURIES: Injury[] = ["knee", "low_back", "shoulder", "wrist"];
const BANDS: Band[] = ["light", "medium", "heavy"];
const SPLITS: Split[] = ["full_body", "push_pull", "upper_lower", "ppl"];
const isUnits = (x: unknown): x is Units => x === "lb" || x === "kg";

/**
 * The profile with every value the engine plans from in range: a choice this version doesn't
 * know becomes the cautious default, and numbers are kept to what setup allows. Null when it
 * can't be repaired: sex, age, height or weight can't be read.
 */
export function migrateProfile(p: unknown, dumbbellUnit?: unknown): Profile | null {
  if (!isObj(p) || (p["sex"] !== "male" && p["sex"] !== "female")) return null;
  if (!isNum(p["age"]) || !isNum(p["heightCm"]) || !isNum(p["bodyweightKg"])) return null;
  return {
    ...(p as unknown as Profile),
    sex: p["sex"],
    age: clamp(p["age"], 14, 100),
    heightCm: clamp(p["heightCm"], 100, 250),
    bodyweightKg: clamp(p["bodyweightKg"], 25, 320),
    // An unknown training history counts as none: the gentlest start.
    trainingHistory: HISTORIES.includes(p["trainingHistory"] as TrainingHistory) ? (p["trainingHistory"] as TrainingHistory) : "never",
    goal: GOALS.includes(p["goal"] as Goal) ? (p["goal"] as Goal) : "both",
    daysPerWeek: whole(p["daysPerWeek"], 1, 6, 4),
    minutesPerSession: whole(p["minutesPerSession"], 10, 90, 20),
    injuries: onlyKnown(p["injuries"], INJURIES),
    units: isUnits(p["units"]) ? p["units"] : isUnits(dumbbellUnit) ? dumbbellUnit : "kg",
    // Setups from before splits existed move to push/pull, the default.
    split: SPLITS.includes(p["split"] as Split) ? (p["split"] as Split) : "push_pull",
  };
}

/** Dumbbells as the equipment editor makes them; anything it couldn't have made counts as none. */
function migrateDumbbells(d: unknown, units: Units): Dumbbells {
  if (!isObj(d)) return { kind: "none" };
  const unit = isUnits(d["unit"]) ? d["unit"] : units;
  const pairs = typeof d["pairs"] === "boolean" ? d["pairs"] : true;
  if (d["kind"] === "fixed") {
    const given = Array.isArray(d["weights"]) ? (d["weights"] as unknown[]) : [];
    const weights = [...new Set(given.filter((w): w is number => isNum(w) && w > 0 && w <= 500))].sort((a, b) => a - b).slice(0, 200);
    return weights.length > 0 ? { ...(d as object), kind: "fixed", weights, unit, pairs } : { kind: "none" };
  }
  if (d["kind"] === "adjustable") {
    const { min, max, step } = d;
    // At most 200 settings between the lightest and heaviest, as the equipment editor allows.
    if (isNum(min) && isNum(max) && isNum(step) && min > 0 && max >= min && max <= 500 && step > 0 && (max - min) / step <= 200) {
      return { ...(d as object), kind: "adjustable", min, max, step, unit, pairs };
    }
  }
  return { kind: "none" };
}

const KIT = ["treadmill", "mat", "abRoller", "pullupBar", "bench"] as const;
const OPTIONAL_KIT = [
  "flatBench", "jumpRope", "bandAnchor", "sliders", "suspension", "adjustableBench", "barbell", "rack", "trapBar", "ezBar", "cables", "bike", "elliptical", "rower", "stairClimber",
] as const;

/**
 * Equipment in the current shape: yes-or-no items that are yes or no, dumbbells the editor could
 * have made (or none), only bands and machines the app knows, and band anchors for older band
 * setups. Null when it isn't an equipment list at all.
 */
export function migrateEquipment(e: unknown, units: Units): Equipment | null {
  if (!isObj(e) || !("dumbbells" in e)) return null;
  const out: Obj = { ...e, dumbbells: migrateDumbbells(e["dumbbells"], units), bands: onlyKnown(e["bands"], BANDS) };
  for (const k of KIT) out[k] = e[k] === true;
  for (const k of OPTIONAL_KIT) if (k in e && typeof e[k] !== "boolean") delete out[k];
  if (Array.isArray(e["machines"])) out["machines"] = onlyKnown(e["machines"], MACHINES);
  else delete out["machines"];
  return upgradeEquipment(out as unknown as Equipment);
}

function migrateLocations(l: unknown, units: Units): Locations | undefined {
  if (!isObj(l)) return undefined;
  const out: Locations = { at: l["at"] === "gym" ? "gym" : "home" };
  const home = migrateEquipment(l["home"], units);
  const gym = migrateEquipment(l["gym"], units);
  if (home) out.home = home;
  if (gym) out.gym = gym;
  if (!out[out.at]) out.at = out.home ? "home" : "gym";
  return out.home || out.gym ? out : undefined;
}

const ACTIVITIES: CardioActivity[] = ["walking", "running", "cycling", "elliptical", "rowing", "stairs", "jump_rope", "marching"];

function validReminders(r: unknown): r is Reminders {
  return (
    isObj(r) &&
    Array.isArray(r["days"]) &&
    r["days"].length > 0 &&
    (r["days"] as unknown[]).every((d) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6) &&
    validTime(r["time"])
  );
}

function migrateSettings(s: unknown): Settings {
  // Fields from a newer version are kept; the ones this version knows are checked.
  const { cardioActivity, reminders, ...o } = isObj(s) ? s : ({} as Obj);
  return {
    ...o,
    restSec: isNum(o["restSec"]) && o["restSec"] > 0 ? clamp(Math.round(o["restSec"]), 10, 600) : DEFAULT_SETTINGS.restSec,
    transitionSec: isNum(o["transitionSec"]) && o["transitionSec"] >= 0 ? clamp(Math.round(o["transitionSec"]), 0, 300) : DEFAULT_SETTINGS.transitionSec,
    sound: typeof o["sound"] === "boolean" ? o["sound"] : DEFAULT_SETTINGS.sound,
    keepAwake: typeof o["keepAwake"] === "boolean" ? o["keepAwake"] : DEFAULT_SETTINGS.keepAwake,
    haptics: typeof o["haptics"] === "boolean" ? o["haptics"] : DEFAULT_SETTINGS.haptics,
    ...(typeof cardioActivity === "string" && ACTIVITIES.includes(cardioActivity as CardioActivity) ? { cardioActivity: cardioActivity as CardioActivity } : {}),
    ...(validReminders(reminders) ? { reminders } : {}),
  };
}

const rirOf = (x: unknown, fallback: Rir): Rir => whole(x, 0, 4, fallback) as Rir;
const kgOrNull = (x: unknown): number | null => (isNum(x) && x >= 0 ? x : null);

/** One exercise's progress, with every number the engine progresses from usable. */
function migrateProgress(id: string, p: unknown): TrainingState["exercises"][string] | null {
  if (!isObj(p) || !Array.isArray(p["repRange"]) || !isNum(p["repRange"][0]) || !isNum(p["repRange"][1])) return null;
  // Reps, or seconds for timed exercises.
  const a = clamp(p["repRange"][0], 1, 600);
  const b = clamp(p["repRange"][1], 1, 600);
  const repRange: [number, number] = [Math.min(a, b), Math.max(a, b)];
  const out: TrainingState["exercises"][string] = {
    ...(p as unknown as TrainingState["exercises"][string]),
    exerciseId: id,
    loadKg: kgOrNull(p["loadKg"]),
    repRange,
    targetRir: rirOf(p["targetRir"], TARGET_RIR),
    targetReps: isNum(p["targetReps"]) ? clamp(p["targetReps"], 1, 600) : repRange[0],
    stalls: whole(p["stalls"], 0, 1000, 0),
    e1rmKg: kgOrNull(p["e1rmKg"]),
    bestE1rmKg: kgOrNull(p["bestE1rmKg"]),
    calibrated: p["calibrated"] === true,
    timesPerformed: whole(p["timesPerformed"], 0, 1e6, 0),
  };
  if ("topStreak" in p) out.topStreak = whole(p["topStreak"], 0, 1000, 0);
  for (const k of ["maxedOut", "painCheck"] as const) if (k in p) out[k] = p[k] === true;
  return out;
}

function migrateState(s: unknown): TrainingState {
  const base = initialTrainingState();
  if (!isObj(s)) return base;
  const substitutions: Record<string, string> = {};
  if (isObj(s["substitutions"])) {
    for (const [from, to] of Object.entries(s["substitutions"])) if (known(from) && known(to) && from !== to) substitutions[from] = to;
  }
  const exercises: TrainingState["exercises"] = {};
  if (isObj(s["exercises"])) {
    for (const [id, p] of Object.entries(s["exercises"])) {
      const progress = known(id) ? migrateProgress(id, p) : null;
      if (progress) exercises[id] = progress;
    }
  }
  const { deloadReason, ...rest } = s;
  return {
    ...base,
    ...rest,
    substitutions,
    exercises,
    deloadRemaining: whole(s["deloadRemaining"], 0, 52, 0),
    strain: Array.isArray(s["strain"]) ? (s["strain"] as unknown[]).filter(isNum).map((x) => clamp(x, 0, 1)) : [],
    strengthSessionsLogged: whole(s["strengthSessionsLogged"], 0, 1e6, 0),
    ...deloadReasonOf(deloadReason),
    sessionsSinceDeload: whole(s["sessionsSinceDeload"], 0, 1e6, 0),
  };
}

/** A stored deload reason, if it is one we know; otherwise none (an unknown value is dropped, not copied). */
function deloadReasonOf(v: unknown): { deloadReason?: "strain" | "scheduled" } {
  return v === "strain" || v === "scheduled" ? { deloadReason: v } : {};
}

/** The profile and equipment of saved setup data, or which of them can't be repaired. */
function setupOf(c: unknown): { profile: Profile; equipment: Equipment } | "profile" | "equipment" {
  if (!isObj(c)) return "profile";
  const e = c["equipment"];
  const profile = migrateProfile(c["profile"], isObj(e) && isObj(e["dumbbells"]) ? e["dumbbells"]["unit"] : undefined);
  if (!profile) return "profile";
  const equipment = migrateEquipment(e, profile.units);
  return equipment ? { profile, equipment } : "equipment";
}

/** Why saved setup data can't be used, or null when it can. */
export function coreProblem(c: unknown): "profile" | "equipment" | null {
  const setup = setupOf(c);
  return typeof setup === "string" ? setup : null;
}

export function migrateCore(c: unknown): Core | null {
  const setup = setupOf(c);
  if (!isObj(c) || typeof setup === "string") return null;
  const { profile, equipment } = setup;
  const startedAt = typeof c["startedAt"] === "string" && !Number.isNaN(Date.parse(c["startedAt"])) ? c["startedAt"] : new Date().toISOString();
  const nextIndex = whole(c["nextIndex"], 0, 1e6, 0);
  const core: Core = {
    ...(c as unknown as Core),
    // A newer version's number is kept, so it still knows the data is its own.
    version: isNum(c["version"]) && c["version"] > DATA_VERSION ? c["version"] : DATA_VERSION,
    profile,
    equipment,
    settings: migrateSettings(c["settings"]),
    state: migrateState(c["state"]),
    startedAt,
    nextIndex,
  };
  delete core.activities;
  delete core.locations;
  delete core.positionOffset;
  if (Array.isArray(c["activities"])) {
    core.activities = (c["activities"] as unknown[]).filter(
      (a): a is NonNullable<Core["activities"]>[number] => isObj(a) && isNum(a["at"]) && isNum(a["minutes"]) && a["minutes"] > 0 && typeof a["name"] === "string",
    ).map((a) => ({ at: a.at, name: a.name, minutes: Math.min(a.minutes, 24 * 60), vigorous: a.vigorous === true }));
  }
  const locations = migrateLocations(c["locations"], profile.units);
  if (locations) {
    core.locations = locations;
    core.equipment = locations[locations.at]!;
  }
  // The programme position never goes before the first session.
  if (isNum(c["positionOffset"])) core.positionOffset = Math.max(-nextIndex, Math.min(1e6, Math.floor(c["positionOffset"])));
  return withValid(core, { profileOverrides: migrateOverrides(c["profileOverrides"]), soreCheck: migrateSoreCheck(c["soreCheck"]) });
}

/** `o` with each of these fields set when valid and removed when not. */
function withValid<T extends object>(o: T, fields: { [K in keyof T]?: T[K] | undefined }): T {
  const out = { ...o };
  for (const [k, v] of Object.entries(fields) as [keyof T, T[keyof T] | undefined][]) {
    if (v === undefined) delete out[k];
    else out[k] = v;
  }
  return out;
}

/** A prescription the session screens and the engine can read. */
function usablePrescription(p: unknown): boolean {
  return isObj(p) && known(p["exerciseId"]) && typeof p["slot"] === "string" && isNum(p["sets"]) && p["sets"] >= 0;
}

/**
 * A plan in the shape the app saves: its exercises are all still in the library, and the numbers
 * the week's planning reads are there.
 */
function usablePlan(plan: unknown): boolean {
  if (!isObj(plan) || (plan["kind"] !== "strength" && plan["kind"] !== "cardio") || !Array.isArray(plan["supersets"])) return false;
  for (const ss of plan["supersets"] as unknown[]) {
    if (!isObj(ss) || !Array.isArray(ss["items"]) || !(ss["items"] as unknown[]).every(usablePrescription)) return false;
  }
  const f = plan["finisher"];
  if (f !== null && f !== undefined && !usablePrescription(f)) return false;
  if (plan["kind"] === "strength") return true;
  const c = plan["cardio"];
  return isObj(c) && Array.isArray(c["segments"]) && (c["segments"] as unknown[]).every((s) => isObj(s) && isNum(s["minutes"]) && s["minutes"] >= 0);
}

/** The prescriptions of a plan the session screen works through: each has the numbers it pre-fills sets with. */
function runnablePlan(plan: unknown): boolean {
  if (!usablePlan(plan)) return false;
  const p = plan as Obj;
  if (!(p["supersets"] as Obj[]).every((ss) => isNum(ss["rounds"]))) return false;
  const items = [...(p["supersets"] as Obj[]).flatMap((ss) => ss["items"] as Obj[]), ...(isObj(p["finisher"]) ? [p["finisher"]] : [])];
  return items.every((i) => Array.isArray(i["repRange"]) && isNum(i["repRange"][0]) && isNum(i["repRange"][1]) && isNum(i["targetReps"]) && (i["loadKg"] === null || isNum(i["loadKg"])));
}

/** A logged set with the numbers progress and records are worked out from. */
function migrateSet(s: unknown, at: number): LoggedSet | null {
  if (!isObj(s) || !known(s["exerciseId"]) || !isNum(s["reps"])) return null;
  const out: LoggedSet = {
    ...(s as unknown as LoggedSet),
    setIndex: whole(s["setIndex"], 0, 1000, 0),
    loadKg: kgOrNull(s["loadKg"]),
    reps: clamp(s["reps"], 0, 10_000),
    rir: rirOf(s["rir"], TARGET_RIR),
    at: isNum(s["at"]) ? s["at"] : at,
  };
  if ("slot" in s && typeof s["slot"] !== "string") delete out.slot;
  if ("painFlag" in s) out.painFlag = s["painFlag"] === true;
  if ("extra" in s) out.extra = s["extra"] === true;
  if ("painArea" in s && typeof s["painArea"] !== "string") delete out.painArea;
  return out;
}

function migrateSets(sets: unknown, at: number): LoggedSet[] {
  return Array.isArray(sets) ? (sets as unknown[]).map((s) => migrateSet(s, at)).filter((s): s is LoggedSet => s !== null) : [];
}

function migrateSwaps(swaps: unknown): { swaps?: NonNullable<SessionRecord["swaps"]> } {
  if (!Array.isArray(swaps)) return {};
  return { swaps: (swaps as unknown[]).filter((w): w is NonNullable<SessionRecord["swaps"]>[number] => isObj(w) && known(w["from"]) && known(w["to"]) && typeof w["slot"] === "string") };
}

export function migrateRecord(r: unknown): SessionRecord | null {
  if (!isObj(r) || typeof r["id"] !== "string" || !isNum(r["index"]) || !isNum(r["finishedAt"])) return null;
  if (r["kind"] !== "strength" && r["kind"] !== "cardio") return null;
  const c = r["cardio"];
  return withValid<SessionRecord>({
    ...(r as unknown as SessionRecord),
    index: Math.max(0, Math.floor(r["index"])),
    name: typeof r["name"] === "string" ? r["name"] : r["kind"] === "cardio" ? "Cardio" : "Strength",
    week: isNum(r["week"]) ? r["week"] : 1,
    startedAt: isNum(r["startedAt"]) ? r["startedAt"] : r["finishedAt"],
    activeMinutes: isNum(r["activeMinutes"]) ? clamp(r["activeMinutes"], 0, 24 * 60) : 0,
    // A plan that can't be read is left out, as on records saved before plans were kept.
    plan: (usablePlan(r["plan"]) ? r["plan"] : {}) as unknown as SessionRecord["plan"],
    sets: migrateSets(r["sets"], r["finishedAt"]),
    changes: Array.isArray(r["changes"]) ? ((r["changes"] as unknown[]).filter(isObj) as unknown as SessionRecord["changes"]) : [],
    cardio: isObj(c)
      ? { ...(c as object), minutes: isNum(c["minutes"]) ? clamp(c["minutes"], 0, 24 * 60) : 0, effort: whole(c["effort"], 1, 10, 5), notes: typeof c["notes"] === "string" ? c["notes"] : "" }
      : null,
    deload: r["deload"] === true,
    comeback: r["comeback"] === true,
    skipped: r["skipped"] === true,
    ...migrateSwaps(r["swaps"]),
  }, { soreness: migrateSoreness(r["soreness"]) });
}

/** Sets added per slot: whole numbers from 1 up to the most that can be added. */
function migrateExtraSets(x: unknown): Record<string, number> | undefined {
  if (!isObj(x)) return undefined;
  const out: Record<string, number> = {};
  for (const [slot, n] of Object.entries(x)) if (Number.isInteger(n) && (n as number) > 0) out[slot] = Math.min(n as number, MAX_ADDED_SETS);
  return Object.keys(out).length > 0 ? out : undefined;
}

export function migrateActive(a: unknown): ActiveSession | null {
  if (!isObj(a) || typeof a["id"] !== "string" || !isNum(a["index"]) || !isNum(a["startedAt"]) || !runnablePlan(a["plan"])) return null;
  const t = a["timer"];
  const timer = isObj(t) && (t["kind"] === "rest" || t["kind"] === "transition") && isNum(t["endsAt"]) && isNum(t["durationSec"]) ? { ...(t as object), next: typeof t["next"] === "string" ? t["next"] : "" } : null;
  const c = a["cardio"];
  const cardio = isObj(c) && isNum(c["segmentIndex"]) && isNum(c["remainingMs"]) && (c["segmentEndsAt"] === null || isNum(c["segmentEndsAt"])) ? c : null;
  const strings = (x: unknown): string[] => (Array.isArray(x) ? (x as unknown[]).filter((s): s is string => typeof s === "string") : []);
  const entries = <T,>(x: unknown, ok: (v: Obj) => boolean): Record<string, T> =>
    isObj(x) ? (Object.fromEntries(Object.entries(x).filter(([, v]) => isObj(v) && ok(v))) as Record<string, T>) : {};
  const { extraSets: _, ...rest } = a;
  const extraSets = migrateExtraSets(a["extraSets"]);
  return withValid<ActiveSession>({
    ...(rest as unknown as ActiveSession),
    ...(extraSets ? { extraSets } : {}),
    pausedMs: isNum(a["pausedMs"]) ? Math.max(0, a["pausedMs"]) : 0,
    pausedAt: isNum(a["pausedAt"]) ? a["pausedAt"] : null,
    minutesOverride: isNum(a["minutesOverride"]) ? clamp(Math.round(a["minutesOverride"]), 10, 90) : null,
    sets: migrateSets(a["sets"], a["startedAt"]),
    warmupDone: strings(a["warmupDone"]),
    timer: timer as ActiveSession["timer"],
    cardio: cardio as unknown as ActiveSession["cardio"],
    advice: entries(a["advice"], (v) => typeof v["message"] === "string"),
    nextSet: entries(a["nextSet"], (v) => isNum(v["reps"]) && (v["loadKg"] === null || isNum(v["loadKg"]))),
    skippedSlots: strings(a["skippedSlots"]),
    ...migrateSwaps(a["swaps"]),
  }, { soreness: migrateSoreness(a["soreness"]) });
}

export function migrateData(raw: unknown): AppData {
  if (!isObj(raw)) return EMPTY_DATA;
  const core = migrateCore(raw["core"]);
  const history = (Array.isArray(raw["history"]) ? (raw["history"] as unknown[]) : [])
    .map(migrateRecord)
    .filter((r): r is SessionRecord => r !== null)
    .sort((a, b) => a.index - b.index || a.finishedAt - b.finishedAt);
  return { core, active: core ? migrateActive(raw["active"]) : null, history };
}

/** True when the data was saved by a newer version of RepCurve than this one. */
export function savedByNewerVersion(core: Core | null): boolean {
  return core !== null && core.version > DATA_VERSION;
}
