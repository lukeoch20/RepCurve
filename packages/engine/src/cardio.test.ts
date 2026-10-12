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

describe("jump rope", () => {
  const rope = { ...referenceEquipment, jumpRope: true };
  const noTreadmill = { ...rope, treadmill: false };

  it("turns interval days into jump rope intervals, without changing their length", () => {
    for (const m of [10, 15, 20, 30, 45]) {
      for (let week = 2; week <= 20; week += 2) {
        const s = buildCardioSession(input({ minutes: m, week, equipment: noTreadmill }));
        expect(s.cardio!.style).toBe("intervals");
        expect(s.cardio!.mode).toBe("jump_rope");
        expect(s.name).toBe("Jump rope intervals");
        expect(minutes(s)).toBe(m);
        // A minute on the rope at a time, however far into the plan.
        for (const seg of s.cardio!.segments.filter((x) => x.intent === "hard")) expect(seg.minutes).toBe(1);
      }
    }
  });

  it("alternates with the treadmill when there's both", () => {
    const modes = [2, 4, 6, 8].map((week) => buildCardioSession(input({ week, equipment: rope })).cardio!.mode);
    expect(new Set(modes)).toEqual(new Set(["jump_rope", "treadmill"]));
  });

  it("leaves steady days and people without a rope as they were", () => {
    expect(buildCardioSession(input({ week: 3, equipment: noTreadmill })).cardio!.mode).toBe("outdoor");
    expect(buildCardioSession(input({ week: 2 })).cardio!.mode).not.toBe("jump_rope");
  });
});

describe("cardio activities are separate from the format", () => {
  const gymish = { ...referenceEquipment, bike: true, rower: true, elliptical: true, stairClimber: true, jumpRope: true };

  it("offers what the equipment allows, with a rope only for intervals", () => {
    const steady = buildCardioSession(input({ equipment: gymish, week: 3 })).cardio!;
    expect(steady.style).not.toBe("intervals");
    expect(steady.options).toEqual(["walking", "running", "cycling", "elliptical", "rowing", "stairs", "marching"]);
    const intervals = buildCardioSession(input({ equipment: gymish, week: 2 })).cardio!;
    expect(intervals.style).toBe("intervals");
    expect(intervals.options).toContain("jump_rope");
    expect(buildCardioSession(input({ week: 3 })).cardio!.options).toEqual(["walking", "running", "marching"]);
  });

  it("keeps the format and effort targets when the activity changes", () => {
    for (const week of [2, 3]) {
      const walk = buildCardioSession(input({ equipment: gymish, week, activity: "walking" })).cardio!;
      const bike = buildCardioSession(input({ equipment: gymish, week, activity: "cycling" })).cardio!;
      expect(bike.activity).toBe("cycling");
      expect(bike.segments.map((s) => [s.minutes, s.effort])).toEqual(walk.segments.map((s) => [s.minutes, s.effort]));
      expect(bike.segments.map((s) => s.note ?? "").join(" ")).toMatch(/pedalling|resistance|spin/);
    }
  });

  it("names the session after the activity", () => {
    expect(buildCardioSession(input({ equipment: gymish, week: 2, activity: "rowing" })).name).toBe("Row intervals");
    expect(buildCardioSession(input({ equipment: gymish, week: 3, activity: "cycling" })).name).toBe("Steady ride");
  });

  it("ignores a preference the equipment or format can't serve", () => {
    expect(buildCardioSession(input({ week: 3, activity: "rowing" })).cardio!.activity).toBe("walking");
    expect(buildCardioSession(input({ equipment: gymish, week: 3, activity: "jump_rope" })).cardio!.activity).toBe("walking");
  });
});
