import type { Equipment, Profile } from "@repcurve/shared";
import { lbToKg } from "@repcurve/shared";
import { describe, expect, it } from "vitest";
import { BADGE_DEFS, badges, type Badge } from "./gamify";
import { closest, LADDER, lookStatuses, lookUnlocks, nextLook, routesText } from "./looks";
import { newCore, planFor } from "./plan";
import type { SessionRecord } from "./types";

/** Every badge, unearned with no progress, except the ones given. */
function badgeSet(earned: Record<string, { at: number; sessionId: string }> = {}, progress: Record<string, number> = {}): Badge[] {
  return BADGE_DEFS.map((d) => ({
    id: d.id, name: d.name, how: d.how, mark: d.mark, tier: d.tier,
    earned: earned[d.id] ?? null,
    ...(earned[d.id] ? {} : { progress: { have: progress[d.id] ?? 0, need: d.need } }),
  }));
}
const none = new Set<never>();

describe("looks as rewards", () => {
  it("start with Bluebird and Classic open, and the rest locked", () => {
    const s = lookStatuses(badgeSet(), none, false);
    expect([...s.values()].filter((l) => l.open).map((l) => l.id).sort()).toEqual(["bluebird", "classic"]);
    expect(s.get("forge")!.earned).toBe(false);
  });

  it("every route is a real badge", () => {
    const ids = new Set(BADGE_DEFS.map((d) => d.id));
    for (const look of LADDER) for (const r of look.routes) expect(ids.has(r.badgeId), r.badgeId).toBe(true);
  });

  it("open with any one of their routes", () => {
    for (const look of LADDER) {
      for (const route of look.routes) {
        const s = lookStatuses(badgeSet({ [route.badgeId]: { at: 5, sessionId: "s5" } }), none, false);
        expect(s.get(look.id)!.open, `${look.id} by ${route.badgeId}`).toBe(true);
        expect(s.get(look.id)!.openedBy!.id).toBe(route.badgeId);
        // Only that look: no route is shared between looks.
        expect(LADDER.filter((l) => s.get(l.id)!.open).map((l) => l.id)).toEqual([look.id]);
      }
    }
  });

  it("never lock again once kept on the device, and keep the style in use when they arrived", () => {
    // Earned, then the history that earned it is gone (a reset or an older backup): kept here, still open.
    const s = lookStatuses(badgeSet(), new Set(["pixel"] as const), false);
    expect(s.get("pixel")!.open).toBe(true);
    expect(s.get("pixel")!.earned).toBe(true);
    expect(s.get("forge")!.open).toBe(false);
  });

  it("are all open in the test app, while still showing what earns them", () => {
    const s = lookStatuses(badgeSet(), none, true);
    expect([...s.values()].every((l) => l.open)).toBe(true);
    expect(s.get("diamond")!.earned).toBe(false);
    expect(nextLook(s)!.id).toBe("forge");
  });

  it("say what's left on each route", () => {
    const s = lookStatuses(badgeSet({}, { "workouts-10": 7, "firsts-2": 1, "streak-4": 2 }), none, false);
    expect(routesText(s.get("forge")!)).toBe("10 workouts (3 to go), a personal record and a harder version of a move (1 of 2 done) or a 4-week streak (2 weeks to go)");
    expect(closest(s.get("forge")!)!.route.badgeId).toBe("workouts-10");
    const p = lookStatuses(badgeSet({}, { "level-5": 4 }), none, false);
    expect(routesText(p.get("pixel")!)).toContain("level 5 on any lift (1 level to go)");
  });

  it("name the next look up the ladder", () => {
    expect(nextLook(lookStatuses(badgeSet({ "workouts-10": { at: 1, sessionId: "a" } }), none, false))!.name).toBe("Pixel Press");
    const all = Object.fromEntries(LADDER.map((l) => [l.routes[0]!.badgeId, { at: 1, sessionId: "a" }]));
    expect(nextLook(lookStatuses(badgeSet(all), none, false))).toBeNull();
  });

  it("are announced by the session that opened them, once", () => {
    const set = badgeSet({ "streak-4": { at: 1, sessionId: "a" }, "workouts-10": { at: 2, sessionId: "b" }, "level-5": { at: 2, sessionId: "b" } });
    expect(lookUnlocks("b", set, none).map((l) => l.name)).toEqual(["Pixel Press"]); // Fired Forge opened earlier, in "a"
    expect(lookUnlocks("a", set, none).map((l) => l.name)).toEqual(["Fired Forge"]);
    // Already kept on this device (the style in use when looks arrived): nothing new.
    expect(lookUnlocks("b", set, new Set(["pixel"] as const))).toEqual([]);
  });
});

describe("looks from a real history", () => {
  const DAY = 86_400_000;
  const T0 = new Date(2026, 8, 7, 18).getTime();
  const profile: Profile = { sex: "female", age: 40, heightCm: 165, bodyweightKg: 65, trainingHistory: "never", goal: "both", daysPerWeek: 3, minutesPerSession: 20, injuries: [], units: "lb" };
  const equipment: Equipment = { dumbbells: { kind: "fixed", weights: [10, 15, 20], unit: "lb", pairs: true }, treadmill: false, mat: true, abRoller: false, pullupBar: false, bench: false, bands: [] };
  const core = newCore(profile, equipment, T0);
  const plan = planFor(core, 0);
  const rec = (i: number, day: number): SessionRecord => ({
    id: `s${i}`, index: i, kind: "strength", name: "A", week: 1, startedAt: T0 + day * DAY, finishedAt: T0 + day * DAY, activeMinutes: 20, plan,
    changes: [], cardio: null, deload: false, comeback: false, skipped: false,
    sets: [{ exerciseId: "goblet_squat", slot: "A.1", setIndex: 0, loadKg: lbToKg(20), reps: 10, rir: 2, at: 0 }],
  });

  it("open Fired Forge on a fourth week running", () => {
    const h = [0, 7, 14, 21].map((d, i) => rec(i, d));
    const all = badges(h, core);
    expect(lookUnlocks("s3", all, none).map((l) => l.id)).toEqual(["forge"]);
    expect(lookStatuses(badges(h.slice(0, 3), core), none, false).get("forge")!.open).toBe(false);
  });
});
