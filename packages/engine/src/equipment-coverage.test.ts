import { getExercise } from "@repcurve/exercises";
import { canLoad, meetsRequirements } from "@repcurve/shared";
import type { Equipment, Pattern, Profile, TrainingHistory } from "@repcurve/shared";
import { describe, expect, it } from "vitest";
import { makeContext } from "./context.js";
import { generateProgram } from "./generate.js";
import { plannable } from "./pool.js";
import { ladderNeighbour } from "./progression.js";
import { prescriptionsOf } from "./state.js";

const none: Equipment = { dumbbells: { kind: "none" }, treadmill: false, mat: true, abRoller: false, pullupBar: false, bench: false, bands: [] };

/** The five home setups the 2026-10-18 catalog audit judged coverage by. */
const SETUPS: Record<string, Equipment> = {
  "no equipment": none,
  "bodyweight and a chair": { ...none, bench: true },
  "one dumbbell": { ...none, bench: true, dumbbells: { kind: "fixed", weights: [25], unit: "lb", pairs: false } },
  "a pair of dumbbells": { ...none, bench: true, dumbbells: { kind: "fixed", weights: [15, 25, 35], unit: "lb", pairs: true } },
  "bands and no anchor": { ...none, bands: ["medium"] },
};

const profile = (trainingHistory: TrainingHistory, minutesPerSession = 30): Profile => ({
  sex: "female", age: 40, heightCm: 165, bodyweightKg: 65, trainingHistory, goal: "both",
  daysPerWeek: 3, minutesPerSession, injuries: [], units: "lb", split: "full_body",
});

/** Strength sessions of the first steady week. */
function week(equipment: Equipment, history: TrainingHistory, minutes = 30) {
  const program = generateProgram({ profile: profile(history, minutes), equipment }, { weeks: 2, createdAt: "test" });
  return program.sessions.filter((s) => s.week === 2 && s.kind === "strength");
}
const exercisesOf = (sessions: ReturnType<typeof week>) => sessions.flatMap((s) => prescriptionsOf(s).map((p) => getExercise(p.exerciseId)));
const patternsOf = (sessions: ReturnType<typeof week>) => new Set<Pattern>(exercisesOf(sessions).map((e) => e.pattern));

describe("plans for each home setup", () => {
  for (const [name, equipment] of Object.entries(SETUPS)) {
    for (const history of ["never", "regular"] as TrainingHistory[]) {
      it(`${name}, ${history === "never" ? "new to training" : "trains regularly"}: short sessions with only what's there`, () => {
        for (const minutes of [20, 30]) {
          const sessions = week(equipment, history, minutes);
          expect(sessions.length).toBeGreaterThan(0);
          for (const s of sessions) {
            expect(s.estimatedMinutes, `${name} ${minutes} min`).toBeLessThanOrEqual(minutes + 1);
            for (const p of prescriptionsOf(s)) {
              const e = getExercise(p.exerciseId);
              expect(meetsRequirements(e.requires, equipment) && canLoad(e.loadType, equipment), `${name}: ${e.id}`).toBe(true);
            }
          }
          // Legs, a hinge and a push every week, whatever the kit.
          const patterns = patternsOf(sessions);
          for (const p of ["squat", "hinge", "horizontal_push"] as Pattern[]) expect(patterns.has(p), `${name} ${minutes} min: ${p}`).toBe(true);
        }
      });
    }
  }

  it("presses overhead with no equipment at all, from the easiest pike push-up a chair allows", () => {
    expect(patternsOf(week(SETUPS["no equipment"]!, "never")).has("vertical_push")).toBe(true);
    const chair = exercisesOf(week(SETUPS["bodyweight and a chair"]!, "never")).map((e) => e.id);
    expect(chair).toContain("hands_elevated_pike_push_up");
    const trained = exercisesOf(week(SETUPS["bodyweight and a chair"]!, "regular")).map((e) => e.id);
    expect(trained).toContain("pike_push_up");
  });

  it("says plainly when nothing at home can train pulling, and what cheaply fixes it", () => {
    const explanation = (equipment: Equipment) => generateProgram({ profile: profile("never"), equipment }, { weeks: 2, createdAt: "test" }).explanation.join(" ");
    expect(explanation(SETUPS["no equipment"]!)).toMatch(/long resistance band \(rows sitting down, no anchor needed\)/);
    expect(explanation(SETUPS["bands and no anchor"]!)).not.toMatch(/bodyweight alone can't/);
    expect(explanation(SETUPS["one dumbbell"]!)).not.toMatch(/bodyweight alone can't/);
  });

  it("rows with bands and nothing to anchor them to", () => {
    const ids = exercisesOf(week(SETUPS["bands and no anchor"]!, "never")).map((e) => e.id);
    expect(ids).toContain("seated_band_row");
    expect(ids.some((id) => getExercise(id).family === "vpush" && getExercise(id).loadType === "band")).toBe(true);
  });

  it("trains every major movement with one dumbbell, using one-arm versions of the paired lifts", () => {
    const one = SETUPS["one dumbbell"]!;
    const eligible = plannable(makeContext(profile("never"), one).pool).map((e) => e.id);
    for (const id of ["single_arm_dumbbell_floor_press", "single_arm_db_overhead_press", "single_arm_dumbbell_curl", "single_arm_dumbbell_lateral_raise", "one_arm_db_row", "goblet_squat"]) {
      expect(eligible, id).toContain(id);
    }
    const ids = exercisesOf([...week(one, "never"), ...week(one, "regular")]).map((e) => e.id);
    expect(ids).toContain("single_arm_dumbbell_floor_press");
    expect(ids).toContain("single_arm_db_overhead_press");
  });

  it("keeps planning the two-handed lifts for someone with a pair; one-arm versions are swaps", () => {
    const pair = SETUPS["a pair of dumbbells"]!;
    const ctx = makeContext(profile("regular"), pair);
    const eligible = plannable(ctx.pool);
    expect(eligible.filter((e) => e.withoutPairs)).toEqual([]);
    expect(ctx.pool.exercises.map((e) => e.id)).toContain("single_arm_dumbbell_curl");
    for (const history of ["never", "regular"] as TrainingHistory[]) {
      expect(exercisesOf(week(pair, history)).filter((e) => e.withoutPairs).map((e) => e.id)).toEqual([]);
    }
  });

  it("plans stand-ins (band curls, pike push-ups) only when nothing heavier does the job", () => {
    const pair = plannable(makeContext(profile("regular"), { ...SETUPS["a pair of dumbbells"]!, bands: ["medium"], loopBands: true }).pool).filter((e) => e.light);
    expect(pair.map((e) => e.id)).toEqual([]);
    const bandsOnly = plannable(makeContext(profile("regular"), SETUPS["bands and no anchor"]!).pool).map((e) => e.id);
    for (const id of ["band_curl", "band_overhead_press", "band_lateral_raise", "band_pull_apart", "seated_band_row"]) expect(bandsOnly, id).toContain(id);
  });

  it("only plans the bodyweight good morning when nothing loads the hinge", () => {
    const planned = (equipment: Equipment) => plannable(makeContext(profile("never"), equipment).pool).some((e) => e.id === "bodyweight_good_morning");
    expect(planned(SETUPS["no equipment"]!)).toBe(true);
    expect(planned(SETUPS["a pair of dumbbells"]!)).toBe(false);
    expect(planned(SETUPS["bands and no anchor"]!)).toBe(false);
    // Still there to swap to.
    expect(makeContext(profile("never"), SETUPS["a pair of dumbbells"]!).pool.exercises.map((e) => e.id)).toContain("bodyweight_good_morning");
  });
});

describe("bodyweight progressions lead on to the harder versions", () => {
  const ctx = makeContext(profile("regular"), SETUPS["bodyweight and a chair"]!);
  const up = (id: string) => ladderNeighbour(getExercise(id), ctx, 1)?.id ?? null;

  it("goes from two legs to one: bridges and calf raises", () => {
    expect(up("glute_bridge")).toBe("single_leg_glute_bridge");
    expect(up("bodyweight_standing_calf_raise")).toBe("single_leg_bodyweight_calf_raise");
  });

  it("goes from split squats to Bulgarian split squats, and through the pike push-ups", () => {
    expect(up("bw_split_squat")).toBe("bw_bulgarian_split_squat");
    expect(up("hands_elevated_pike_push_up")).toBe("pike_push_up");
    expect(up("pike_push_up")).toBe("elevated_pike_push_up");
  });

  it("skips a rung the equipment can't do", () => {
    const floorOnly = makeContext(profile("regular"), SETUPS["no equipment"]!);
    // No chair for the rear foot: the split squat is as far as that ladder goes.
    expect(ladderNeighbour(getExercise("bw_split_squat"), floorOnly, 1)).toBeNull();
    expect(ladderNeighbour(getExercise("pike_push_up"), floorOnly, -1)).toBeNull();
  });
});
