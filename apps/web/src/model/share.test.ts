import type { Equipment, Profile } from "@repcurve/shared";
import { lbToKg } from "@repcurve/shared";
import { describe, expect, it } from "vitest";
import { newCore, planFor } from "./plan";
import { liftSeries } from "./progress";
import { shareCard } from "./share";
import type { SessionRecord } from "./types";

const DAY = 86_400_000;
const T0 = new Date(2026, 8, 7, 18).getTime();
const profile: Profile = { sex: "male", age: 33, heightCm: 178, bodyweightKg: 84, trainingHistory: "never", goal: "both", daysPerWeek: 3, minutesPerSession: 20, injuries: [], units: "lb" };
const equipment: Equipment = { dumbbells: { kind: "fixed", weights: [10, 20, 25], unit: "lb", pairs: true }, treadmill: true, mat: true, abRoller: false, pullupBar: false, bench: false, bands: [] };
const plan = planFor(newCore(profile, equipment, T0), 0);
const rec = (i: number, day: number, lb: number | null, kind: "strength" | "cardio" = "strength"): SessionRecord => ({
  id: `s${i}`, index: i, kind, name: "A", week: 1, startedAt: T0 + day * DAY, finishedAt: T0 + day * DAY, activeMinutes: 20, plan,
  changes: [], cardio: kind === "cardio" ? { minutes: 20, effort: 5, notes: "my knee" } : null, deload: false, comeback: false, skipped: false,
  sets: lb === null ? [] : [{ exerciseId: "goblet_squat", slot: "A.1", setIndex: 0, loadKg: lbToKg(lb), reps: 10, rir: 2, at: 0, painFlag: true, painArea: "knee" }],
});

describe("the shareable progress card", () => {
  it("shows a lift's curve, its change and a few totals", () => {
    const h = [rec(0, 0, 20), rec(1, 2, 25), rec(2, 9, null, "cardio")];
    const card = shareCard(h, liftSeries(h)[0]!, "lb", T0 + 10 * DAY);
    expect(card.heading).toBe("My strength curve");
    expect(card.subheading).toBe("Goblet squat · estimated max");
    expect(card.big).toBe("+25%");
    expect(card.line).toHaveLength(2);
    expect(card.stats).toEqual([
      { value: "3", label: "workouts" },
      { value: "2", label: "week streak" },
      { value: "60", label: "minutes" },
    ]);
  });

  it("shows sessions per week before there are any lifts", () => {
    const h = [rec(0, 0, null, "cardio"), rec(1, 7, null, "cardio"), rec(2, 8, null, "cardio")];
    const card = shareCard(h, null, "lb", T0 + 8 * DAY);
    expect(card.line).toBeNull();
    expect(card.bars).toEqual([1, 2]);
    expect(card.big).toBeNull();
  });

  it("never carries pain, notes or anything about the person", () => {
    const h = [rec(0, 0, 20), rec(1, 2, 25), rec(2, 9, null, "cardio")];
    const text = JSON.stringify(shareCard(h, liftSeries(h)[0]!, "lb", T0 + 10 * DAY));
    for (const word of ["knee", "pain", "Pain", "male", "effort"]) expect(text).not.toContain(word);
  });
});
