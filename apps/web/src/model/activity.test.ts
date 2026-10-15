import { describe, expect, it } from "vitest";
import { cardioCredit, weekActivity } from "./activity";
import type { SessionRecord } from "./types";

const T = new Date(2026, 9, 14, 12).getTime(); // a Wednesday
const DAY = 24 * 60 * 60 * 1000;

const cardio = (minutesDone: number, at = T): SessionRecord => ({
  id: `c${at}`, index: 0, kind: "cardio", name: "Intervals", week: 1, startedAt: at, finishedAt: at, activeMinutes: minutesDone,
  plan: {
    cardio: {
      mode: "outdoor", style: "intervals", totalMinutes: 20,
      segments: [
        { minutes: 4, intent: "warmup", effort: 3 },
        { minutes: 6, intent: "hard", effort: 8 },
        { minutes: 6, intent: "easy", effort: 3 },
        { minutes: 4, intent: "cooldown", effort: 2 },
      ],
    },
  } as SessionRecord["plan"],
  sets: [], changes: [], cardio: { minutes: minutesDone, effort: 7, notes: "" }, deload: false, comeback: false, skipped: false,
});
const strength = (at: number): SessionRecord => ({ ...cardio(20, at), id: `s${at}`, kind: "strength", cardio: null });

describe("weekly activity against the WHO guidelines", () => {
  it("counts hard minutes double and a cool-down not at all, scaled to what was done", () => {
    expect(cardioCredit(cardio(20))).toBe(4 + 12 + 6);
    expect(cardioCredit(cardio(10))).toBe(11);
  });

  it("adds outside activity, counts strength days once each, and only this week", () => {
    const core = { activities: [{ at: T, name: "Swim", minutes: 20, vigorous: true }, { at: T - 10 * DAY, name: "Walk", minutes: 60, vigorous: false }] };
    const w = weekActivity(core, [cardio(20), strength(T - DAY), strength(T - DAY + 1000), strength(T - 9 * DAY)], T);
    expect(w.aerobic).toBe(22 + 40);
    expect(w.strengthDays).toBe(1);
    expect(w.extras.map((a) => a.name)).toEqual(["Swim"]);
  });
});
