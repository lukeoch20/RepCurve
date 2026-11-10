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

  it("keeps mini-band exercises for people whose bands were ticked before loop bands had their own tile", () => {
    const withBands = migrateCore(newCore(profile, { ...equipment, bands: ["medium"] }, 0))!;
    expect(withBands.equipment.loopBands).toBe(true);
    expect(migrateCore(newCore(profile, equipment, 0))!.equipment.loopBands).toBeUndefined();
    // Once the editor has said yes or no, that answer stands.
    const said = migrateCore(newCore(profile, { ...equipment, bands: ["medium"], bandAnchor: false, loopBands: false }, 0))!;
    expect(said.equipment.loopBands).toBe(false);
    expect(said.equipment.bandAnchor).toBe(false);
  });

  it("turns home and gym into training setups, drops machines it doesn't know, and keeps training where the user said", () => {
    const gym: Equipment = { ...equipment, cables: true, machines: ["leg_press", "teleporter" as never] };
    const { setups: _, ...v4 } = newCore(profile, equipment, 0);
    const raw = { ...v4, version: 4, equipment: gym, locations: { home: equipment, gym, at: "gym" } };
    const c = migrateCore(JSON.parse(JSON.stringify(raw)))!;
    expect(c.setups.list.map((x) => [x.id, x.name])).toEqual([["home", "Home"], ["gym", "Gym"]]);
    expect(c.setups.usual).toBe("gym");
    expect(c.equipment.machines).toEqual(["leg_press"]);
    expect("locations" in c).toBe(false);
    const broken = migrateCore(JSON.parse(JSON.stringify({ ...raw, locations: { home: equipment, gym: { nope: 1 }, at: "gym" } })))!;
    expect(broken.setups.list.map((x) => x.id)).toEqual(["home"]);
    expect(broken.setups.usual).toBe("home");
    expect(broken.equipment).toEqual(equipment);
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
      version: DATA_VERSION + 1,
      soreness: [{ group: "quads", at: T }],
      settings: { ...core.settings, reminders: { days: [1, 3, 5], time: "07:00" } },
      state: { ...core.state, profileOverrides: { forget: ["Shoulder"] } },
    };
    const back = migrateCore(JSON.parse(JSON.stringify(newer)))!;
    expect(back).toMatchObject({ version: DATA_VERSION + 1, soreness: [{ group: "quads", at: T }] });
    expect((back.settings as unknown as Record<string, unknown>)["reminders"]).toEqual({ days: [1, 3, 5], time: "07:00" });
    expect((back.state as unknown as Record<string, unknown>)["profileOverrides"]).toEqual({ forget: ["Shoulder"] });
    expect(savedByNewerVersion(back)).toBe(true);
    expect(savedByNewerVersion(newCore(profile, equipment, T))).toBe(false);
  });

  it("brings older data up to this version", () => {
    const core = { ...newCore(profile, equipment, T), version: 1 };
    expect(migrateCore(JSON.parse(JSON.stringify(core)))!.version).toBe(DATA_VERSION);
  });

  it("plans cautiously for a goal or training history it doesn't know, and drops dumbbells the editor couldn't have made", () => {
    const core = newCore(profile, equipment, T);
    expect(migrateCore({ ...core, profile: { ...core.profile, goal: "muscle" } })!.profile.goal).toBe("both");
    expect(migrateCore({ ...core, profile: { ...core.profile, trainingHistory: "lots" } })!.profile.trainingHistory).toBe("never");
    // Equipment lives in the setups; the next workout's (core.equipment) follows from them.
    const withDumbbells = (dumbbells: unknown) => ({ ...core, setups: { ...core.setups, list: core.setups.list.map((x) => ({ ...x, equipment: { ...x.equipment, dumbbells } })) } });
    const thousands = migrateCore(withDumbbells({ kind: "adjustable", min: 5, max: 100, step: 0.0001, unit: "lb" }))!;
    expect(thousands.equipment.dumbbells).toEqual({ kind: "none" });
    expect(thousands.setups.list[0]!.equipment.dumbbells).toEqual({ kind: "none" });
    const fine = migrateCore(withDumbbells({ kind: "adjustable", min: 5, max: 50, step: 2.5, unit: "lb" }))!;
    expect(fine.equipment.dumbbells).toEqual({ kind: "adjustable", min: 5, max: 50, step: 2.5, unit: "lb", pairs: true });
  });

  it("refuses setup data it can't repair: no sex, age, height or weight, or no equipment list", () => {
    const core = newCore(profile, equipment, T);
    expect(migrateCore({ ...core, profile: { ...core.profile, sex: "x" } })).toBeNull();
    expect(migrateCore({ ...core, profile: { ...core.profile, age: "33" } })).toBeNull();
    expect(migrateCore({ ...core, profile: { ...core.profile, bodyweightKg: null } })).toBeNull();
    expect(migrateCore({ ...core, equipment: "dumbbells" })).toBeNull();
    expect(migrateCore({ ...core, equipment: { nope: 1 } })).toBeNull();
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

describe("deload state", () => {
  it("keeps a planned deload's reason and the count towards the next, and drops values it doesn't know", () => {
    const core = JSON.parse(JSON.stringify(newCore(profile, equipment, 0)));
    core.state = { ...core.state, deloadRemaining: 2, deloadReason: "scheduled", sessionsSinceDeload: 7 };
    const kept = migrateCore(core)!.state;
    expect(kept.deloadReason).toBe("scheduled");
    expect(kept.sessionsSinceDeload).toBe(7);
    core.state = { ...core.state, deloadReason: "bored", sessionsSinceDeload: "lots" };
    const cleaned = migrateCore(core)!.state;
    expect("deloadReason" in cleaned).toBe(false);
    expect(cleaned.sessionsSinceDeload).toBe(0);
  });
});

describe("usernames, aims and tips in saved data", () => {
  const account = { userId: "11111111-1111-4111-8111-111111111111", secret: "ab".repeat(32), username: "Luke_O" };

  it("keeps a claimed username with its id and secret, and drops one that can't be used", () => {
    const core = { ...newCore(profile, equipment, 0), account };
    expect(migrateCore(JSON.parse(JSON.stringify(core)))!.account).toEqual(account);
    for (const bad of [{ ...account, userId: "me" }, { ...account, secret: "short" }, { ...account, username: "no spaces allowed" }, "Luke_O"]) {
      expect("account" in migrateCore({ ...core, account: bad })!).toBe(false);
    }
    // Older data has none, and gets none.
    expect("account" in migrateCore(newCore(profile, equipment, 0))!).toBe(false);
  });

  it("keeps the aim, and asks again for one this version doesn't know", () => {
    expect(migrateCore(newCore({ ...profile, aim: "lose_fat" }, equipment, 0))!.profile.aim).toBe("lose_fat");
    const odd = JSON.parse(JSON.stringify(newCore(profile, equipment, 0)));
    odd.profile.aim = "bulk";
    expect("aim" in migrateCore(odd)!.profile).toBe(false);
  });

  it("keeps tips after workouts turned off, and ignores a setting it can't read", () => {
    const core = newCore(profile, equipment, 0);
    expect(migrateCore({ ...core, settings: { ...core.settings, aimTips: false } })!.settings.aimTips).toBe(false);
    expect("aimTips" in migrateCore({ ...core, settings: { ...core.settings, aimTips: "no" } })!.settings).toBe(false);
  });
});
