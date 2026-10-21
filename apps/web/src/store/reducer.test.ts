import type { Equipment, Profile } from "@repcurve/shared";
import { describe, expect, it } from "vitest";
import { dayLabel } from "../model/format";
import { nextUp } from "../model/session";
import { INITIAL, reducer, safeReducer, type AppState } from "./reducer";

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

  it("adds a set and takes it back", () => {
    let s = reducer(loaded(), { type: "setup", profile, equipment, now: T0 });
    s = reducer(s, { type: "start", now: T0, minutes: null });
    const slot = nextUp(s.data.active!)!.slot;
    s = reducer(s, { type: "addSet", slot });
    expect(s.data.active!.extraSets).toEqual({ [slot]: 1 });
    s = reducer(s, { type: "removeAddedSet", slot });
    expect(s.data.active!.extraSets).toEqual({});
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

describe("reducer: training at home and at a gym", () => {
  const gym: Equipment = { ...equipment, barbell: true, rack: true, cables: true, machines: ["leg_press", "lat_pulldown", "chest_press"] };
  const both = { list: [{ id: "home", name: "Home", equipment }, { id: "gym", name: "Gym", equipment: gym }], usual: "home" };

  it("plans from the setup in use, and switches with it", () => {
    let s = reducer(loaded(), { type: "setup", profile, setups: both, now: T0 });
    expect(s.data.core!.equipment).toEqual(equipment);
    s = reducer(s, { type: "chooseSetup", id: "gym", mode: "kept" });
    expect(s.data.core!.equipment).toEqual(gym);
    expect(s.data.core!.setups.kept).toBe("gym");
    // Changing units from Settings keeps both setups and the choice.
    s = reducer(s, { type: "setup", profile: { ...profile, units: "kg" }, now: T0 });
    expect(s.data.core!.setups.list.map((x) => x.equipment)).toEqual([equipment, gym]);
    expect(s.data.core!.equipment).toEqual(gym);
  });

  it("doesn't switch setup in the middle of a session", () => {
    let s = reducer(loaded(), { type: "setup", profile, setups: both, now: T0 });
    s = reducer(s, { type: "start", now: T0, minutes: null });
    expect(reducer(s, { type: "chooseSetup", id: "gym", mode: "once" })).toBe(s);
    expect(reducer(s, { type: "backToUsual" })).toBe(s);
  });
});

describe("L2: an action that fails changes nothing", () => {
  // Data the engine can't plan from (an unknown goal got past every check), so starting throws.
  const broken = (): AppState => {
    const s = safeReducer(loaded(), { type: "setup", profile, equipment, now: T0 });
    return { ...s, data: { ...s.data, core: { ...s.data.core!, profile: { ...profile, goal: "unknown" as never } } } };
  };

  it("the plain reducer throws, so this is a real failure", () => {
    expect(() => reducer(broken(), { type: "start", now: T0, minutes: null })).toThrow();
  });

  it("keeps the data exactly as it was and records what failed", () => {
    const before = broken();
    const after = safeReducer(before, { type: "start", now: T0 + 5, minutes: null });
    // The same objects: nothing is saved, nothing re-renders from new data.
    expect(after.data).toBe(before.data);
    expect(after.finished).toBe(before.finished);
    expect(after.failure).toMatchObject({ action: "start" });
    expect(after.failure!.error).toBeInstanceOf(Error);
    // Each failure is a new record, so the app notices a repeat.
    const again = safeReducer(after, { type: "start", now: T0 + 6, minutes: null });
    expect(again.failure).not.toBe(after.failure);
    expect(again.data).toBe(before.data);
  });

  it("carries on as usual for actions that work", () => {
    const s = safeReducer(safeReducer(broken(), { type: "start", now: T0, minutes: null }), { type: "settings", settings: { restSec: 90 } });
    expect(s.data.core!.settings.restSec).toBe(90);
  });
});

describe("reducer: the username", () => {
  const account = { userId: "11111111-1111-4111-8111-111111111111", secret: "ab".repeat(32), username: "luke" };

  it("is saved with the first setup, changed and let go without touching training", () => {
    let s = reducer(loaded(), { type: "setup", profile, equipment, account, now: T0 });
    expect(s.data.core!.account).toEqual(account);
    const state = s.data.core!.state;
    s = reducer(s, { type: "account", account: { ...account, username: "lukelifts" } });
    expect(s.data.core!.account!.username).toBe("lukelifts");
    expect(s.data.core!.state).toBe(state);
    s = reducer(s, { type: "account", account: null });
    expect("account" in s.data.core!).toBe(false);
    // Editing the profile later keeps it.
    s = reducer(s, { type: "account", account });
    s = reducer(s, { type: "setup", profile: { ...profile, aim: "get_stronger" }, now: T0 });
    expect(s.data.core!.account).toEqual(account);
    expect(s.data.core!.profile.aim).toBe("get_stronger");
  });
});
