import type { Equipment, Profile } from "@repcurve/shared";
import { describe, expect, it } from "vitest";
import { migrateCore } from "./migrate";
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
