import type { Equipment, Profile } from "@repcurve/shared";
import { describe, expect, it } from "vitest";
import { dayLabel } from "../model/format";
import { nextUp } from "../model/session";
import { INITIAL, reducer, type AppState } from "./reducer";

const profile: Profile = {
  sex: "male", age: 33, heightCm: 178, bodyweightKg: 84, trainingHistory: "never", goal: "both",
  daysPerWeek: 4, minutesPerSession: 20, injuries: [], units: "lb",
};
const equipment: Equipment = {
  dumbbells: { kind: "fixed", weights: [10, 15, 20, 25, 30], unit: "lb", pairs: true },
  treadmill: true, mat: true, abRoller: true, pullupBar: false, bench: false, bands: [],
};
const T0 = Date.UTC(2026, 9, 5, 12);

const loaded = (): AppState => reducer(INITIAL, { type: "loaded", data: { core: null, active: null, history: [] } });

describe("reducer: a session from setup to finish", () => {
  it("sets up, starts, logs, finishes and moves to the next session", () => {
    let s = reducer(loaded(), { type: "setup", profile, equipment, now: T0 });
    expect(s.data.core!.nextIndex).toBe(0);
    s = reducer(s, { type: "start", now: T0, minutes: null });
    expect(s.data.active).not.toBeNull();
    // Starting twice doesn't replace the session in progress.
    expect(reducer(s, { type: "start", now: T0 + 1, minutes: null }).data.active).toBe(s.data.active);
    const ref = nextUp(s.data.active!)!;
    s = reducer(s, { type: "log", ref, values: { loadKg: 9.07, reps: 10, rir: 2 }, now: T0 + 60_000 });
    expect(s.data.active!.sets).toHaveLength(1);
    s = reducer(s, { type: "finish", now: T0 + 20 * 60_000 });
    expect(s.data.active).toBeNull();
    expect(s.data.history).toHaveLength(1);
    expect(s.data.core!.nextIndex).toBe(1);
    expect(s.finished?.id).toBe(s.data.history[0]!.id);
  });

  it("skips a session without starting it", () => {
    let s = reducer(loaded(), { type: "setup", profile, equipment, now: T0 });
    s = reducer(s, { type: "skip", now: T0 });
    expect(s.data.history[0]!.skipped).toBe(true);
    expect(s.data.core!.nextIndex).toBe(1);
  });

  it("discards a session in progress without touching progress", () => {
    let s = reducer(loaded(), { type: "setup", profile, equipment, now: T0 });
    const core = s.data.core;
    s = reducer(s, { type: "start", now: T0, minutes: null });
    s = reducer(s, { type: "discard" });
    expect(s.data.active).toBeNull();
    expect(s.data.core).toBe(core);
    expect(s.data.history).toHaveLength(0);
  });

  it("merges settings changes", () => {
    let s = reducer(loaded(), { type: "setup", profile, equipment, now: T0 });
    s = reducer(s, { type: "settings", settings: { restSec: 120 } });
    expect(s.data.core!.settings.restSec).toBe(120);
    expect(s.data.core!.settings.transitionSec).toBe(20);
  });
});

describe("dayLabel", () => {
  it("names today, yesterday, weekdays, then dates", () => {
    const now = new Date(2026, 9, 7, 9).getTime();
    expect(dayLabel(new Date(2026, 9, 7, 0, 5).getTime(), now)).toBe("Today");
    expect(dayLabel(new Date(2026, 9, 6, 23, 30).getTime(), now)).toBe("Yesterday");
    expect(dayLabel(new Date(2026, 9, 3, 12).getTime(), now)).toBe(new Date(2026, 9, 3).toLocaleDateString(undefined, { weekday: "long" }));
    expect(dayLabel(new Date(2026, 8, 20, 12).getTime(), now)).toBe(new Date(2026, 8, 20).toLocaleDateString(undefined, { month: "short", day: "numeric" }));
  });
});
