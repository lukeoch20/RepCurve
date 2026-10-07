import { describe, expect, it } from "vitest";
import { exportBackup, parseBackup } from "./backup";
import { EMPTY_DATA } from "./types";

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
