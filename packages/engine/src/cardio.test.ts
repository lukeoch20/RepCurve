import { describe, expect, it } from "vitest";
import { buildCardioSession, type CardioSessionInput } from "./cardio.js";
import { referenceEquipment, referenceProfile } from "./testkit.js";

const input = (over: Partial<CardioSessionInput> & { minutes?: number } = {}): CardioSessionInput => ({
  profile: { ...referenceProfile, minutesPerSession: over.minutes ?? 20 },
  equipment: referenceEquipment,
  level: "novice",
  cardioIndex: 0,
  index: 0,
  week: 2,
  dayIndex: 0,
  cardioPerWeek: 1,
  ...over,
});
const minutes = (s: ReturnType<typeof buildCardioSession>) => s.cardio!.segments.reduce((n, x) => n + x.minutes, 0);
const push = (s: ReturnType<typeof buildCardioSession>) => s.cardio!.segments.filter((x) => x.effort === 7).reduce((n, x) => n + x.minutes, 0);

describe("RC-12: cardio progresses and listens to logged effort", () => {
  it("fills the budget exactly for every length and week", () => {
    for (const m of [10, 15, 20, 30, 45]) {
      for (let week = 1; week <= 20; week++) {
        for (const cardioPerWeek of [1, 2]) {
          for (const cardioIndex of [0, 1]) {
            const s = buildCardioSession(input({ minutes: m, week, cardioPerWeek, cardioIndex }));
            expect(minutes(s), `${m} min, week ${week}`).toBe(m);
            for (const seg of s.cardio!.segments) expect(seg.minutes, `${m} min, week ${week}`).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it("grows the strong finish of steady sessions week by week", () => {
    const weeks = [1, 3, 5, 7].map((week) => push(buildCardioSession(input({ week }))));
    expect(weeks[0]).toBe(0);
    expect(weeks[1]).toBeGreaterThan(0);
    expect(weeks[2]).toBeGreaterThan(weeks[1]!);
  });

  it("holds back after a very hard session and pushes after an easy one", () => {
    const base = push(buildCardioSession(input({ week: 3 })));
    expect(push(buildCardioSession(input({ week: 3, lastEffort: 9 })))).toBeLessThan(base);
    expect(push(buildCardioSession(input({ week: 3, lastEffort: 3 })))).toBeGreaterThan(base);
  });

  it("alternates intervals every other week with one cardio day a week", () => {
    expect(buildCardioSession(input({ week: 2 })).cardio!.style).toBe("intervals");
    expect(buildCardioSession(input({ week: 3 })).cardio!.style).not.toBe("intervals");
  });

  it("keeps building intervals after the count caps, by lengthening the work", () => {
    const early = buildCardioSession(input({ week: 4, minutes: 20 }));
    const late = buildCardioSession(input({ week: 8, minutes: 20 }));
    const hardMin = (s: ReturnType<typeof buildCardioSession>) => s.cardio!.segments.filter((x) => x.intent === "hard").reduce((n, x) => n + x.minutes, 0);
    expect(hardMin(late)).toBeGreaterThan(hardMin(early));
  });
});

describe("RC-24: long interval sessions aren't mostly cool-down", () => {
  it("turns spare time into a steady block", () => {
    const s = buildCardioSession(input({ week: 2, minutes: 45 }));
    const cool = s.cardio!.segments.filter((x) => x.intent === "cooldown").reduce((n, x) => n + x.minutes, 0);
    expect(cool).toBeLessThanOrEqual(2);
    expect(s.cardio!.segments.some((x) => x.intent === "steady")).toBe(true);
  });
});
