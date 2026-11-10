import { ROUTINES, findRoutine, type Routine } from "@repcurve/exercises";
import { describe, expect, it } from "vitest";
import { blockLevel, buildMobilityPlan, mobilityDose, mobilityMinutes, mobilityWorkSec, MOBILITY_READY_SEC, MOBILITY_REST_SEC, MOBILITY_SWITCH_SEC, type MobilityInput } from "./mobility.js";
import { referenceEquipment } from "./testkit.js";

const hips = findRoutine("hips")!;
const base: MobilityInput = { equipment: referenceEquipment, injuries: [] };
const names = (r: Routine, level: number, input: MobilityInput = base) => buildMobilityPlan(r, level, input).items.map((i) => i.id);

describe("a mobility session", () => {
  it("is the routine's drills in order, with nothing changed for someone with no limits", () => {
    const plan = buildMobilityPlan(hips, 0, base);
    expect(plan.items.map((i) => i.id)).toEqual(["hip_circles", "ninety_ninety", "hip_flexor_stretch", "figure_four", "adductor_rock_back", "glute_bridge"]);
    expect(plan.changes).toEqual([]);
    expect(plan.leftOut).toEqual([]);
    expect([plan.routine, plan.version, plan.level, plan.name]).toEqual(["hips", hips.version, 0, hips.name]);
  });

  it("walks a two-sided hold through get ready, left, switch, right, rest and again", () => {
    const one: Routine = { ...hips, levels: [{ name: "x", note: "", items: [{ options: ["hip_flexor_stretch"], sets: 2, amount: 30 }] }] };
    const plan = buildMobilityPlan(one, 0, base);
    expect(plan.steps.map((s) => [s.kind, s.side ?? null, s.seconds, s.set])).toEqual([
      ["ready", null, MOBILITY_READY_SEC, 0],
      ["work", "left", 30, 0],
      ["switch", null, MOBILITY_SWITCH_SEC, 0],
      ["work", "right", 30, 0],
      ["rest", null, MOBILITY_REST_SEC.hold, 1],
      ["work", "left", 30, 1],
      ["switch", null, MOBILITY_SWITCH_SEC, 1],
      ["work", "right", 30, 1],
    ]);
    // Its length is everything in it: both sides, both sets, the changeovers and the rest.
    expect(plan.estimatedSec).toBe(10 + 4 * 30 + 2 * 5 + 10);
    expect(mobilityWorkSec(plan.steps)).toBe(120);
  });

  it("leaves reps untimed, with nothing to count down between sides, and estimates them from their pace", () => {
    const one: Routine = { ...hips, levels: [{ name: "x", note: "", items: [{ options: ["hip_circles"], sets: 1, amount: 4 }, { options: ["glute_bridge"], sets: 2, amount: 10 }] }] };
    const plan = buildMobilityPlan(one, 0, base);
    expect(plan.steps.map((s) => [s.kind, s.side ?? null, s.seconds, s.estSec])).toEqual([
      ["ready", null, 10, 10],
      ["work", "left", null, 32],
      ["work", "right", null, 32],
      ["ready", null, 10, 10],
      ["work", null, null, 25],
      ["rest", null, MOBILITY_REST_SEC.reps, 20],
      ["work", null, null, 25],
    ]);
    expect(plan.items[1]).toMatchObject({ exercise: true, kind: "reps", sided: false, cue: expect.stringMatching(/heels/) });
  });

  it("gives realistic lengths: about 10, 13 and 14 minutes for the hips block, 5 to 10 for the quick ones", () => {
    const minutes = (id: string, level = 0) => mobilityMinutes(buildMobilityPlan(findRoutine(id)!, level, base));
    expect([minutes("hips", 0), minutes("hips", 1), minutes("hips", 2)]).toEqual([10, 13, 14]);
    expect([minutes("morning"), minutes("desk"), minutes("winddown")]).toEqual([5, 7, 10]);
    expect(mobilityMinutes({ estimatedSec: 10 })).toBe(1);
  });

  it("swaps drills that bother an area for the gentler one, or leaves them out, and says so", () => {
    const plan = buildMobilityPlan(hips, 2, { ...base, injuries: ["knee"] });
    expect(plan.items.map((i) => i.id)).toEqual(["hip_circles", "lying_knee_drops", "standing_hip_flexor_stretch", "figure_four", "adductor_rock_back", "single_leg_glute_bridge"]);
    expect(plan.changes).toEqual([
      "Lying knee drops instead of 90/90 hip switches, to go easy on your knees.",
      "Standing hip-flexor stretch instead of half-kneeling hip-flexor stretch, to go easy on your knees.",
      "Adductor rock-back instead of side-to-side squat, to go easy on your knees.",
      "Supported deep squat is left out, to go easy on your knees.",
    ]);
    // The swapped-in drill keeps the amount the routine asked for.
    expect(plan.items[2]).toMatchObject({ sets: 2, amount: 45, sided: true, sideLabel: "{Side} leg back" });
  });

  it("never has the same drill twice, when a gentler stand-in is one the routine has anyway", () => {
    const one: Routine = { ...hips, levels: [{ name: "x", note: "", items: [{ options: ["adductor_rock_back"], sets: 1, amount: 8 }, { options: ["cossack_squat"], sets: 1, amount: 6 }] }] };
    const plan = buildMobilityPlan(one, 0, { ...base, injuries: ["knee"] });
    expect(plan.items.map((i) => i.id)).toEqual(["adductor_rock_back"]);
    expect(plan.items[0]!.amount).toBe(8);
    expect(plan.changes).toEqual(["Side-to-side squat is left out, to go easy on your knees."]);
    // Left out by the person as well: listed once.
    const out = buildMobilityPlan(one, 0, { ...base, injuries: ["knee"], leftOut: ["adductor_rock_back"] });
    expect([out.items, out.leftOut]).toEqual([[], [{ id: "adductor_rock_back", name: "Adductor rock-back" }]]);
  });

  it("says how to do a drill that's still fine with a sore area", () => {
    const plan = buildMobilityPlan(hips, 0, { ...base, injuries: ["wrist", "low_back"] });
    const ease = Object.fromEntries(plan.items.map((i) => [i.id, i.ease]));
    expect(ease["hip_circles"]).toEqual(["Rest on your forearms or fists instead of flat hands."]);
    expect(ease["ninety_ninety"]).toHaveLength(2);
    expect(ease["hip_flexor_stretch"]).toEqual(["Keep your tailbone tucked the whole time and move your hips forward less."]);
    expect(ease["figure_four"]).toEqual([]);
    expect(plan.changes).toEqual([]);
  });

  it("doesn't repeat strength work the week's workouts already train", () => {
    const plan = buildMobilityPlan(hips, 0, { ...base, trainedFamilies: ["bridge", "squat"] });
    expect(plan.items.map((i) => i.id)).not.toContain("glute_bridge");
    expect(plan.changes).toEqual(["Glute bridge is left out: this week's workouts already train that movement."]);
    // Drills aren't strength work: a week of squats doesn't take the squat hold away.
    expect(names(hips, 2, { ...base, trainedFamilies: ["squat", "lunge"] })).toContain("deep_squat_hold");
    expect(names(hips, 1, { ...base, trainedFamilies: ["hip_abduction"] })).not.toContain("side_lying_hip_abduction");
  });

  it("keeps out what the person left out, and lists it so it can come back", () => {
    const plan = buildMobilityPlan(hips, 0, { ...base, leftOut: ["figure_four", "glute_bridge"] });
    expect(plan.items.map((i) => i.id)).toEqual(["hip_circles", "ninety_ninety", "hip_flexor_stretch", "adductor_rock_back"]);
    expect(plan.leftOut).toEqual([{ id: "figure_four", name: "Figure-four stretch" }, { id: "glute_bridge", name: "Glute bridge" }]);
    expect(plan.changes).toEqual([]);
    // Leaving out the gentler stand-in works too.
    const knee = buildMobilityPlan(hips, 0, { ...base, injuries: ["knee"], leftOut: ["lying_knee_drops"] });
    expect(knee.items.map((i) => i.id)).not.toContain("lying_knee_drops");
    expect(knee.leftOut).toEqual([{ id: "lying_knee_drops", name: "Lying knee drops" }]);
    // A swap that was then left out isn't announced.
    expect(knee.changes).toEqual(["Standing hip-flexor stretch instead of half-kneeling hip-flexor stretch, to go easy on your knees."]);
  });

  it("uses the first option the equipment allows, and says when none does", () => {
    const banded: Routine = { ...hips, levels: [{ name: "x", note: "", items: [{ options: ["band_hip_abduction", "side_lying_hip_abduction"], sets: 2, amount: 10 }] }] };
    expect(names(banded, 0)).toEqual(["side_lying_hip_abduction"]);
    expect(names(banded, 0, { ...base, equipment: { ...referenceEquipment, loopBands: true } })).toEqual(["band_hip_abduction"]);
    const only: Routine = { ...hips, levels: [{ name: "x", note: "", items: [{ options: ["band_hip_abduction"], sets: 2, amount: 10 }] }] };
    const plan = buildMobilityPlan(only, 0, base);
    expect(plan.items).toEqual([]);
    expect(plan.steps).toEqual([]);
    expect(plan.changes).toEqual(["Band hip abduction is left out: it needs equipment you don't have here."]);
  });

  it("keeps a level within the routine's", () => {
    expect(buildMobilityPlan(hips, 9, base).level).toBe(2);
    expect(buildMobilityPlan(hips, -3, base).level).toBe(0);
    expect(buildMobilityPlan(findRoutine("desk")!, 2, base).level).toBe(0);
  });

  it("every routine at every level builds for someone protecting every area", () => {
    for (const r of ROUTINES) {
      r.levels.forEach((_, level) => {
        const plan = buildMobilityPlan(r, level, { ...base, injuries: ["knee", "low_back", "shoulder", "wrist"] });
        expect(plan.items.length, `${r.id} ${level}`).toBeGreaterThanOrEqual(3);
        expect(new Set(plan.items.map((i) => i.id)).size, `${r.id} ${level}`).toBe(plan.items.length);
        expect(plan.steps[0]?.kind, `${r.id} ${level}`).toBe("ready");
        // Each step belongs to a drill of the plan, and each drill starts with getting ready.
        plan.items.forEach((_, i) => expect(plan.steps.find((s) => s.item === i)?.kind, `${r.id} ${level} ${i}`).toBe("ready"));
      });
    }
  });
});

describe("mobility doses in words", () => {
  it("covers holds, counted drills and plain reps, one-sided or not", () => {
    const dose = (id: string, level: number, pick: string) => mobilityDose(buildMobilityPlan(findRoutine(id)!, level, base).items.find((i) => i.id === pick)!);
    expect(dose("hips", 0, "hip_flexor_stretch")).toBe("2 × 30 s each side");
    expect(dose("desk", 0, "hip_flexor_stretch")).toBe("45 s each side");
    expect(dose("morning", 0, "deep_squat_hold")).toBe("30 s");
    expect(dose("hips", 0, "hip_circles")).toBe("4 circles each way, each side");
    expect(dose("hips", 0, "ninety_ninety")).toBe("8 switches");
    expect(dose("hips", 2, "cossack_squat")).toBe("6 each side");
    expect(dose("morning", 0, "open_book")).toBe("6 reps each side");
    expect(dose("hips", 0, "glute_bridge")).toBe("2 × 10");
    expect(dose("desk", 0, "glute_bridge")).toBe("12 reps");
    expect(dose("hips", 2, "single_leg_glute_bridge")).toBe("2 × 8 each side");
  });
});

describe("a block's levels", () => {
  it("share its sessions evenly: six at each of three levels", () => {
    expect([0, 5, 6, 11, 12, 17, 18, 40].map((done) => blockLevel(hips, done))).toEqual([0, 0, 1, 1, 2, 2, 2, 2]);
    expect(blockLevel(findRoutine("desk")!, 3)).toBe(0);
  });
});
