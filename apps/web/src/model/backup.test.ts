import type { Equipment, Profile } from "@repcurve/shared";
import { describe, expect, it } from "vitest";
import { exportBackup, parseBackup } from "./backup";
import { fullGym } from "./equipment";
import { migrateData } from "./migrate";
import { currentProgram, newCore, timeChoices, todayPlan, weekSessions } from "./plan";
import { finishSession, logSet, nextUp, prefill, startSession } from "./session";
import { EMPTY_DATA, type AppData, type Core, type SessionRecord } from "./types";

describe("backups", () => {
  it("round-trips", () => {
    const text = exportBackup(EMPTY_DATA, 0);
    const r = parseBackup(text);
    expect(r.ok).toBe(true);
  });
  it("rejects other JSON and garbage with a clear message", () => {
    expect(parseBackup("{}")).toEqual({ ok: false, error: "That isn't a RepCurve backup file." });
    expect(parseBackup("nope").ok).toBe(false);
  });
});

describe("RC-13: damaged data can't crash the app", () => {
  const profile = {
    sex: "male", age: 33, heightCm: 178, bodyweightKg: 84, trainingHistory: "never", goal: "both",
    daysPerWeek: 4, minutesPerSession: 20, injuries: [], units: "lb",
  };
  const equipment = {
    dumbbells: { kind: "fixed", weights: [10, 15, 20], unit: "lb", pairs: true },
    treadmill: true, mat: true, abRoller: true, pullupBar: false, bench: false, bands: [],
  };
  const backup = (extra: Record<string, unknown>) =>
    JSON.stringify({ format: "repcurve-backup", version: 1, core: { profile, equipment, state: {}, nextIndex: 2, startedAt: "2026-01-01T00:00:00Z" }, ...extra });

  it("fills missing settings and training state with defaults", () => {
    const r = parseBackup(backup({ history: [] }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.core!.settings.restSec).toBe(60);
    expect(r.data.core!.state.substitutions).toEqual({});
    expect(r.data.core!.nextIndex).toBe(2);
  });

  it("repairs history entries without sets and drops ones that can't be read", () => {
    const r = parseBackup(backup({ history: [{ id: "a", index: 0, kind: "strength", finishedAt: 1 }, { nope: true }, "x"] }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.history).toHaveLength(1);
    expect(r.data.history[0]!.sets).toEqual([]);
  });

  it("drops exercises the library no longer has", () => {
    const r = parseBackup(backup({
      history: [{ id: "a", index: 0, kind: "strength", finishedAt: 1, sets: [{ exerciseId: "gone_lift", reps: 5 }, { exerciseId: "goblet_squat", reps: 8, loadKg: 9, rir: 2 }] }],
      active: { id: "x", index: 2, startedAt: 1, plan: { kind: "strength", supersets: [{ items: [{ exerciseId: "gone_lift" }] }], finisher: null } },
    }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.history[0]!.sets.map((s) => s.exerciseId)).toEqual(["goblet_squat"]);
    expect(r.data.active).toBeNull();
  });

  it("drops substitutions and progress for unknown exercises", () => {
    const text = JSON.stringify({
      format: "repcurve-backup",
      core: { profile, equipment, state: { substitutions: { goblet_squat: "gone_lift", db_rdl: "db_staggered_rdl" }, exercises: { gone_lift: { repRange: [8, 12], targetReps: 8 } } } },
    });
    const r = parseBackup(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.core!.state.substitutions).toEqual({ db_rdl: "db_staggered_rdl" });
    expect(r.data.core!.state.exercises).toEqual({});
  });

  it("rejects a damaged profile and newer backup versions", () => {
    expect(parseBackup(JSON.stringify({ format: "repcurve-backup", core: { profile: { age: "x" }, equipment, state: {} } })).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ format: "repcurve-backup", version: 99 })).ok).toBe(false);
  });
});

// ------------------------------------------------------------------ L1: hostile backups

const T0 = Date.UTC(2026, 9, 5, 7);
const DAY = 86_400_000;

/** A real-looking backup: two finished sessions, one under way, home and gym equipment. */
function realData(): AppData {
  const p: Profile = { sex: "female", age: 41, heightCm: 165, bodyweightKg: 70, trainingHistory: "lapsed", goal: "strength_muscle", daysPerWeek: 3, minutesPerSession: 25, injuries: ["knee"], units: "kg", split: "full_body" };
  const home: Equipment = { dumbbells: { kind: "adjustable", min: 2, max: 24, step: 2, unit: "kg", pairs: true }, treadmill: false, mat: true, abRoller: false, pullupBar: true, bench: true, bands: ["light", "heavy"], bandAnchor: true, loopBands: false };
  const setups = { list: [{ id: "home", name: "Home", equipment: home }, { id: "gym", name: "Gym", equipment: fullGym("kg") }], usual: "home" };
  let core: Core = { ...newCore(p, home, T0, undefined, setups), activities: [{ at: T0, name: "Swim", minutes: 30, vigorous: true }] };
  const history: SessionRecord[] = [];
  for (let i = 0; i < 2; i++) {
    let t = T0 + i * 2 * DAY;
    let a = startSession(core, history, t, null);
    for (let ref = nextUp(a); ref; ref = nextUp(a)) {
      t += 60_000;
      const v = prefill(a, ref.slot, ref.setIndex);
      a = logSet(a, ref, { loadKg: v.loadKg, reps: v.reps, rir: 2 }, core, t);
    }
    const r = finishSession(a, core, t, a.plan.kind === "cardio" ? { minutes: 20, effort: 6, notes: "" } : undefined);
    core = r.core;
    history.push(r.record);
  }
  return { core, active: startSession(core, history, T0 + 5 * DAY, null), history };
}

/** Everything the app plans from restored data. Throws if any of it can't cope. */
function planFrom(data: AppData): void {
  const { core, history } = data;
  if (!core) return;
  const now = T0 + 6 * DAY;
  todayPlan(core, history, now);
  currentProgram(core);
  weekSessions(core, history, now);
  timeChoices(core, history, now);
  if (!data.active) startSession(core, history, now, null);
}

/** A copy of a backup with one value changed (`undefined` removes it). */
function withValue(text: string, path: string, value: unknown): string {
  const o = JSON.parse(text) as Record<string, unknown>;
  const keys = path.split(".");
  let at = o;
  for (const k of keys.slice(0, -1)) at = at[k] as Record<string, unknown>;
  if (value === undefined) delete at[keys[keys.length - 1]!];
  else at[keys[keys.length - 1]!] = value;
  return JSON.stringify(o);
}

describe("L1: backups with values the app doesn't know", () => {
  const good = exportBackup(realData(), T0 + 6 * DAY);

  it("round-trips a real backup unchanged, and reading it twice changes nothing", () => {
    const data = JSON.parse(JSON.stringify(realData())) as AppData;
    const r = parseBackup(exportBackup(data, 0));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data).toEqual(data);
    expect(migrateData(JSON.parse(JSON.stringify(r.data)))).toEqual(r.data);
  });

  const repaired: [string, unknown, (d: AppData) => void][] = [
    ["core.profile.goal", "foo", (d) => expect(d.core!.profile.goal).toBe("both")],
    ["core.profile.split", "bar", (d) => expect(d.core!.profile.split).toBe("push_pull")],
    ["core.profile.trainingHistory", "x", (d) => expect(d.core!.profile.trainingHistory).toBe("never")],
    ["core.profile.daysPerWeek", 99, (d) => expect(d.core!.profile.daysPerWeek).toBe(6)],
    ["core.profile.daysPerWeek", "3", (d) => expect(d.core!.profile.daysPerWeek).toBe(4)],
    ["core.profile.minutesPerSession", -5, (d) => expect(d.core!.profile.minutesPerSession).toBe(10)],
    ["core.profile.minutesPerSession", 1e300, (d) => expect(d.core!.profile.minutesPerSession).toBe(90)],
    ["core.profile.units", "parsec", (d) => expect(d.core!.profile.units).toBe("kg")],
    ["core.profile.injuries", ["knee", "soul", 7], (d) => expect(d.core!.profile.injuries).toEqual(["knee"])],
    ["core.profile.injuries", "knee", (d) => expect(d.core!.profile.injuries).toEqual([])],
    ["core.profile.age", -5, (d) => expect(d.core!.profile.age).toBe(14)],
    ["core.profile.bodyweightKg", 1e9, (d) => expect(d.core!.profile.bodyweightKg).toBe(320)],
    ["core.setups.list.0.equipment.dumbbells", "lots", (d) => expect(d.core!.equipment.dumbbells).toEqual({ kind: "none" })],
    ["core.setups.list.0.equipment.dumbbells", { kind: "fixed", weights: ["x", -2, 10, 10, 5] }, (d) => expect(d.core!.equipment.dumbbells).toMatchObject({ kind: "fixed", weights: [5, 10] })],
    ["core.setups.list.0.equipment.dumbbells", { kind: "adjustable", min: 50, max: 5, step: 5, unit: "kg" }, (d) => expect(d.core!.equipment.dumbbells).toEqual({ kind: "none" })],
    ["core.setups.list.0.equipment.bands", "heavy", (d) => expect(d.core!.equipment.bands).toEqual([])],
    ["core.setups.list.0.equipment.machines", true, (d) => expect(d.core!.equipment.machines).toBeUndefined()],
    ["core.setups.list.0.equipment.treadmill", "yes", (d) => expect(d.core!.equipment.treadmill).toBe(false)],
    ["core.setups.list.0.equipment.barbell", 1, (d) => expect(d.core!.equipment.barbell).toBeUndefined()],
    ["core.setups.list.0.equipment", { dumbbells: null, machines: ["leg_press", "teleporter"], bands: [{}] }, (d) => expect(d.core!.equipment).toMatchObject({ dumbbells: { kind: "none" }, machines: ["leg_press"], bands: [] })],
    ["core.setups.list.0.equipment", "x", (d) => expect(d.core!.setups.list.map((x) => x.id)).toEqual(["gym"])],
    ["core.setups.list.0.name", 7, (d) => expect(d.core!.setups.list[0]!.name).toBe("Setup")],
    ["core.setups.list.1.id", "home", (d) => expect(d.core!.setups.list.map((x) => x.name)).toEqual(["Home"])],
    ["core.setups.usual", "moon", (d) => expect(d.core!.setups.usual).toBe("home")],
    ["core.setups.kept", "moon", (d) => expect(d.core!.setups.kept).toBeUndefined()],
    ["core.setups.once", { id: "gym", index: "soon" }, (d) => expect(d.core!.setups.once).toBeUndefined()],
    ["core.setups", "x", (d) => expect(d.core!.setups.list).toEqual([{ id: "home", name: "Home", equipment: d.core!.equipment }])],
    ["history.0.setup", { id: 5 }, (d) => expect(d.history[0]!.setup).toBeUndefined()],
    ["active.setup", { id: "gym", name: "Gym", equipment: "x" }, (d) => expect(d.active!.setup).toMatchObject({ id: "home", name: "Home" })],
    ["core.settings.restSec", 1e9, (d) => expect(d.core!.settings.restSec).toBe(600)],
    ["core.settings", "x", (d) => expect(d.core!.settings.restSec).toBe(60)],
    ["core.state", [], (d) => expect(d.core!.state.exercises).toEqual({})],
    ["core.state.deloadRemaining", -3, (d) => expect(d.core!.state.deloadRemaining).toBe(0)],
    ["core.state.strain", [0.5, "x", 9], (d) => expect(d.core!.state.strain).toEqual([0.5, 1])],
    ["core.nextIndex", -7, (d) => expect(d.core!.nextIndex).toBe(0)],
    ["core.positionOffset", -1e9, (d) => expect(d.core!.nextIndex + (d.core!.positionOffset ?? 0)).toBe(0)],
    ["active.plan.supersets", "x", (d) => expect(d.active).toBeNull()],
    ["active.timer", { kind: "rest", endsAt: "soon" }, (d) => expect(d.active!.timer).toBeNull()],
    ["active.sets", [{ exerciseId: "goblet_squat", reps: 8, loadKg: "x", rir: 9 }], (d) => expect(d.active!.sets[0]).toMatchObject({ loadKg: null, rir: 4 })],
  ];

  it.each(repaired)("repairs %s = %j to a value it can plan with", (path, value, check) => {
    const r = parseBackup(withValue(good, path, value));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    check(r.data);
    expect(() => planFrom(r.data)).not.toThrow();
  });

  it("repairs every training-progress number to one the engine can progress from", () => {
    const o = JSON.parse(good) as { core: { state: { exercises: Record<string, Record<string, unknown>> } } };
    for (const p of Object.values(o.core.state.exercises)) Object.assign(p, { loadKg: "x", repRange: [12, 8], targetReps: null, targetRir: 7, stalls: -1, timesPerformed: "x", calibrated: "yes" });
    const r = parseBackup(JSON.stringify(o));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const progress = Object.values(r.data.core!.state.exercises);
    expect(progress.length).toBeGreaterThan(0);
    for (const p of progress) expect(p).toMatchObject({ loadKg: null, repRange: [8, 12], targetReps: 8, targetRir: 4, stalls: 0, timesPerformed: 0, calibrated: false });
    expect(() => planFrom(r.data)).not.toThrow();
  });

  it("keeps a session whose plan can't be read, without its plan", () => {
    const o = JSON.parse(good) as { history: Record<string, unknown>[] };
    o.history[0]!["plan"] = { kind: "strength", week: 1, supersets: [null] };
    o.history[1]!["changes"] = [null, "x"];
    const r = parseBackup(JSON.stringify(o));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.history).toHaveLength(2);
    expect(r.data.history[0]!.plan).toEqual({});
    expect(r.data.history[1]!.changes).toEqual([]);
    expect(() => planFrom(r.data)).not.toThrow();
  });

  const refused: [string, unknown, RegExp][] = [
    ["core.profile.sex", "x", /profile is damaged/],
    ["core.profile.age", "old", /profile is damaged/],
    ["core.profile", undefined, /profile is damaged/],
    ["core.equipment", "x", /equipment list is damaged/],
    ["core.equipment", { nope: 1 }, /equipment list is damaged/],
    ["history", "x", /session history is damaged/],
    ["history", [1, 2, 3], /None of the sessions/],
    ["format", "other", /isn't a RepCurve backup/],
  ];

  it.each(refused)("refuses %s = %j with a clear message", (path, value, message) => {
    const r = parseBackup(withValue(good, path, value));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(message);
  });

  it("refuses JSON that isn't a backup object", () => {
    for (const text of ["[]", "null", "42", '"repcurve-backup"']) expect(parseBackup(text).ok).toBe(false);
  });

  it("plans from any single setup value replaced with nonsense, or refuses the backup", () => {
    const paths: string[] = [];
    const walk = (o: unknown, path: string) => {
      if (!o || typeof o !== "object" || Array.isArray(o) || path === "core.state.exercises") return;
      for (const [k, v] of Object.entries(o)) {
        paths.push(`${path}.${k}`);
        walk(v, `${path}.${k}`);
      }
    };
    walk((JSON.parse(good) as { core: unknown }).core, "core");
    expect(paths.length).toBeGreaterThan(40);
    for (const path of paths) {
      for (const value of ["x", -1, null]) {
        const r = parseBackup(withValue(good, path, value));
        if (!r.ok || !r.data.core) continue;
        const { core, history } = r.data;
        const what = `${path} = ${JSON.stringify(value)}`;
        expect(() => todayPlan(core, history, T0 + 6 * DAY), what).not.toThrow();
        expect(() => currentProgram(core), what).not.toThrow();
      }
    }
  }, 120_000);
});
