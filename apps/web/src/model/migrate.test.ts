import type { Equipment, Profile } from "@repcurve/shared";
import { describe, expect, it } from "vitest";
import { migrateCore, savedByNewerVersion } from "./migrate";
import { DATA_VERSION } from "./types";
import { newCore } from "./plan";

const profile: Profile = {
  sex: "male", age: 33, heightCm: 178, bodyweightKg: 84, trainingHistory: "never", goal: "both",
  daysPerWeek: 3, minutesPerSession: 20, injuries: [], units: "lb",
};
const equipment: Equipment = {
  dumbbells: { kind: "fixed", weights: [10, 15, 20], unit: "lb", pairs: true },
  treadmill: true, mat: true, abRoller: false, pullupBar: false, bench: true, bands: [],
};

describe("splits in saved data", () => {
  it("moves setups from before splits to push/pull", () => {
    const old = JSON.parse(JSON.stringify(newCore(profile, equipment, 0)));
    delete old.profile.split;
    expect(migrateCore(old)!.profile.split).toBe("push_pull");
  });

  it("keeps a chosen split, and replaces one it doesn't know", () => {
    expect(migrateCore(newCore({ ...profile, split: "full_body" }, equipment, 0))!.profile.split).toBe("full_body");
    expect(migrateCore(newCore({ ...profile, split: "ppl" }, equipment, 0))!.profile.split).toBe("ppl");
    const odd = JSON.parse(JSON.stringify(newCore(profile, equipment, 0)));
    odd.profile.split = "bro_split";
    expect(migrateCore(odd)!.profile.split).toBe("push_pull");
  });
});

describe("equipment from before the evidence review", () => {
  it("keeps band rows for people who already had bands (they assumed a door anchor)", () => {
    const withBands = migrateCore(newCore(profile, { ...equipment, bands: ["medium"] }, 0))!;
    expect(withBands.equipment.bandAnchor).toBe(true);
    expect(migrateCore(newCore(profile, equipment, 0))!.equipment.bandAnchor).toBeUndefined();
  });

  it("keeps valid places, drops machines it doesn't know, and trains where the user said", () => {
    const gym: Equipment = { ...equipment, cables: true, machines: ["leg_press", "teleporter" as never] };
    const raw = { ...newCore(profile, equipment, 0), locations: { home: equipment, gym, at: "gym" } };
    const c = migrateCore(JSON.parse(JSON.stringify(raw)))!;
    expect(c.locations?.at).toBe("gym");
    expect(c.equipment.machines).toEqual(["leg_press"]);
    const broken = migrateCore(JSON.parse(JSON.stringify({ ...raw, locations: { home: equipment, gym: { nope: 1 }, at: "gym" } })))!;
    expect(broken.locations?.at).toBe("home");
    expect(broken.locations?.gym).toBeUndefined();
  });

  it("keeps logged outside activity and a cardio preference", () => {
    const raw = { ...newCore(profile, equipment, 0), activities: [{ at: 5, name: "Walk", minutes: 30, vigorous: false }, { at: 6, minutes: -1 }] };
    raw.settings = { ...raw.settings, cardioActivity: "cycling" };
    const c = migrateCore(JSON.parse(JSON.stringify(raw)))!;
    expect(c.activities).toEqual([{ at: 5, name: "Walk", minutes: 30, vigorous: false }]);
    expect(c.settings.cardioActivity).toBe("cycling");
  });
});

describe("data from another version of the app", () => {
  const T = Date.UTC(2026, 9, 13);

  it("keeps fields it doesn't know, so an older copy can't strip a newer one's data", () => {
    const core = newCore(profile, equipment, T);
    const newer = {
      ...core,
      version: 3,
      soreness: [{ group: "quads", at: T }],
      settings: { ...core.settings, reminders: { days: [1, 3, 5], time: "07:00" } },
      state: { ...core.state, profileOverrides: { forget: ["Shoulder"] } },
    };
    const back = migrateCore(JSON.parse(JSON.stringify(newer)))!;
    expect(back).toMatchObject({ version: 3, soreness: [{ group: "quads", at: T }] });
    expect((back.settings as unknown as Record<string, unknown>)["reminders"]).toEqual({ days: [1, 3, 5], time: "07:00" });
    expect((back.state as unknown as Record<string, unknown>)["profileOverrides"]).toEqual({ forget: ["Shoulder"] });
    expect(savedByNewerVersion(back)).toBe(true);
    expect(savedByNewerVersion(newCore(profile, equipment, T))).toBe(false);
  });

  it("brings older data up to this version", () => {
    const core = { ...newCore(profile, equipment, T), version: 1 };
    expect(migrateCore(JSON.parse(JSON.stringify(core)))!.version).toBe(DATA_VERSION);
  });

  it("refuses a profile with an unknown goal or training history, and a dumbbell step that makes thousands of weights", () => {
    const core = newCore(profile, equipment, T);
    expect(migrateCore({ ...core, profile: { ...core.profile, goal: "muscle" } })).toBeNull();
    expect(migrateCore({ ...core, profile: { ...core.profile, trainingHistory: "lots" } })).toBeNull();
    expect(migrateCore({ ...core, equipment: { ...core.equipment, dumbbells: { kind: "adjustable", min: 5, max: 100, step: 0.0001, unit: "lb" } } })).toBeNull();
    expect(migrateCore({ ...core, equipment: { ...core.equipment, dumbbells: { kind: "adjustable", min: 5, max: 50, step: 2.5, unit: "lb" } } })).not.toBeNull();
  });
});

describe("reminder settings", () => {
  const T = Date.UTC(2026, 9, 13);
  it("keeps valid reminder days and drops broken ones", () => {
    const core = newCore(profile, equipment, T);
    const ok = migrateCore({ ...core, settings: { ...core.settings, reminders: { days: [1, 3, 5], time: "07:00" } } })!;
    expect(ok.settings.reminders).toEqual({ days: [1, 3, 5], time: "07:00" });
    const bad = migrateCore({ ...core, settings: { ...core.settings, reminders: { days: [9], time: "7am" }, cardioActivity: "flying" } })!;
    expect(bad.settings.reminders).toBeUndefined();
    expect(bad.settings.cardioActivity).toBeUndefined();
  });
});
