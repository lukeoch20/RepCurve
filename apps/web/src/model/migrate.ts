import { initialTrainingState, type TrainingState } from "@repcurve/engine";
import { findExercise } from "@repcurve/exercises";
import type { Equipment, Profile } from "@repcurve/shared";
import { DEFAULT_SETTINGS, EMPTY_DATA, type ActiveSession, type AppData, type Core, type SessionRecord, type Settings } from "./types";

/**
 * Bring stored or imported data up to the current shape: fill defaults that older versions
 * lacked, and drop anything the app can no longer use (malformed records, exercises the
 * library no longer has) instead of crashing on it later.
 */

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const known = (id: unknown): id is string => typeof id === "string" && findExercise(id) !== undefined;

export function validProfile(p: unknown): p is Profile {
  return (
    isObj(p) &&
    (p["sex"] === "male" || p["sex"] === "female") &&
    isNum(p["age"]) &&
    isNum(p["heightCm"]) &&
    isNum(p["bodyweightKg"]) &&
    typeof p["trainingHistory"] === "string" &&
    typeof p["goal"] === "string" &&
    isNum(p["daysPerWeek"]) &&
    p["daysPerWeek"] >= 1 &&
    p["daysPerWeek"] <= 7 &&
    isNum(p["minutesPerSession"]) &&
    p["minutesPerSession"] > 0 &&
    Array.isArray(p["injuries"]) &&
    (p["units"] === "lb" || p["units"] === "kg")
  );
}

export function validEquipment(e: unknown): e is Equipment {
  if (!isObj(e) || !isObj(e["dumbbells"]) || !Array.isArray(e["bands"])) return false;
  const d = e["dumbbells"];
  if (d["kind"] === "none") return true;
  if (d["kind"] === "fixed") return Array.isArray(d["weights"]) && (d["weights"] as unknown[]).every(isNum);
  if (d["kind"] === "adjustable") return isNum(d["min"]) && isNum(d["max"]) && isNum(d["step"]) && (d["step"] as number) > 0;
  return false;
}

function migrateSettings(s: unknown): Settings {
  const o = isObj(s) ? s : {};
  return {
    restSec: isNum(o["restSec"]) && o["restSec"] > 0 ? o["restSec"] : DEFAULT_SETTINGS.restSec,
    transitionSec: isNum(o["transitionSec"]) && o["transitionSec"] >= 0 ? o["transitionSec"] : DEFAULT_SETTINGS.transitionSec,
    sound: typeof o["sound"] === "boolean" ? o["sound"] : DEFAULT_SETTINGS.sound,
    keepAwake: typeof o["keepAwake"] === "boolean" ? o["keepAwake"] : DEFAULT_SETTINGS.keepAwake,
  };
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
      if (!known(id) || !isObj(p) || !Array.isArray(p["repRange"]) || !isNum(p["targetReps"])) continue;
      exercises[id] = { ...(p as unknown as TrainingState["exercises"][string]), exerciseId: id };
    }
  }
  return {
    ...base,
    substitutions,
    exercises,
    deloadRemaining: isNum(s["deloadRemaining"]) ? Math.max(0, s["deloadRemaining"]) : 0,
    strain: Array.isArray(s["strain"]) ? (s["strain"] as unknown[]).filter(isNum) : [],
    strengthSessionsLogged: isNum(s["strengthSessionsLogged"]) ? s["strengthSessionsLogged"] : 0,
  };
}

export function migrateCore(c: unknown): Core | null {
  if (!isObj(c) || !validProfile(c["profile"]) || !validEquipment(c["equipment"])) return null;
  const startedAt = typeof c["startedAt"] === "string" && !Number.isNaN(Date.parse(c["startedAt"])) ? c["startedAt"] : new Date().toISOString();
  const core: Core = {
    version: 1,
    profile: c["profile"],
    equipment: c["equipment"],
    settings: migrateSettings(c["settings"]),
    state: migrateState(c["state"]),
    startedAt,
    nextIndex: isNum(c["nextIndex"]) ? Math.max(0, Math.floor(c["nextIndex"])) : 0,
  };
  if (isNum(c["positionOffset"])) core.positionOffset = Math.floor(c["positionOffset"]);
  return core;
}

/** Every exercise a plan refers to is still in the library. */
function planUsable(plan: unknown): boolean {
  if (!isObj(plan) || (plan["kind"] !== "strength" && plan["kind"] !== "cardio")) return false;
  if (!Array.isArray(plan["supersets"])) return false;
  for (const ss of plan["supersets"] as unknown[]) {
    if (!isObj(ss) || !Array.isArray(ss["items"])) return false;
    for (const p of ss["items"] as unknown[]) if (!isObj(p) || !known(p["exerciseId"])) return false;
  }
  const f = plan["finisher"];
  if (f !== null && f !== undefined && (!isObj(f) || !known(f["exerciseId"]))) return false;
  return plan["kind"] === "strength" || isObj(plan["cardio"]);
}

export function migrateRecord(r: unknown): SessionRecord | null {
  if (!isObj(r) || typeof r["id"] !== "string" || !isNum(r["index"]) || !isNum(r["finishedAt"])) return null;
  if (r["kind"] !== "strength" && r["kind"] !== "cardio") return null;
  const sets = Array.isArray(r["sets"])
    ? (r["sets"] as unknown[]).filter((s): s is SessionRecord["sets"][number] => isObj(s) && known(s["exerciseId"]) && isNum(s["reps"]))
    : [];
  return {
    ...(r as unknown as SessionRecord),
    name: typeof r["name"] === "string" ? r["name"] : r["kind"] === "cardio" ? "Cardio" : "Strength",
    week: isNum(r["week"]) ? r["week"] : 1,
    startedAt: isNum(r["startedAt"]) ? r["startedAt"] : r["finishedAt"],
    activeMinutes: isNum(r["activeMinutes"]) ? r["activeMinutes"] : 0,
    plan: (isObj(r["plan"]) ? r["plan"] : {}) as unknown as SessionRecord["plan"],
    sets,
    changes: Array.isArray(r["changes"]) ? (r["changes"] as SessionRecord["changes"]) : [],
    cardio: isObj(r["cardio"]) ? (r["cardio"] as unknown as SessionRecord["cardio"]) : null,
    deload: r["deload"] === true,
    comeback: r["comeback"] === true,
    skipped: r["skipped"] === true,
  };
}

export function migrateActive(a: unknown): ActiveSession | null {
  if (!isObj(a) || typeof a["id"] !== "string" || !isNum(a["index"]) || !isNum(a["startedAt"]) || !planUsable(a["plan"])) return null;
  const sets = Array.isArray(a["sets"]) ? (a["sets"] as unknown[]).filter((s) => isObj(s) && known(s["exerciseId"]) && isNum(s["reps"])) : [];
  return {
    ...(a as unknown as ActiveSession),
    pausedMs: isNum(a["pausedMs"]) ? a["pausedMs"] : 0,
    pausedAt: isNum(a["pausedAt"]) ? a["pausedAt"] : null,
    minutesOverride: isNum(a["minutesOverride"]) ? a["minutesOverride"] : null,
    sets: sets as ActiveSession["sets"],
    warmupDone: Array.isArray(a["warmupDone"]) ? (a["warmupDone"] as string[]) : [],
    timer: isObj(a["timer"]) ? (a["timer"] as unknown as ActiveSession["timer"]) : null,
    cardio: isObj(a["cardio"]) ? (a["cardio"] as unknown as ActiveSession["cardio"]) : null,
    advice: isObj(a["advice"]) ? (a["advice"] as ActiveSession["advice"]) : {},
    nextSet: isObj(a["nextSet"]) ? (a["nextSet"] as ActiveSession["nextSet"]) : {},
    skippedSlots: Array.isArray(a["skippedSlots"]) ? (a["skippedSlots"] as string[]) : [],
  };
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
