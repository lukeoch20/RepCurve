import type { EquipmentItem, Exercise, Sex } from "@repcurve/shared";

/**
 * Starting load as a fraction of bodyweight, per dumbbell, for a novice who
 * has never benchmarked the movement. Deliberately conservative: the first
 * session's AMRAP set corrects it. Intermediate/advanced users get a multiplier.
 * [verify] against population data once we have logs.
 */
export const STARTING_LOAD_RATIO: Record<string, Record<Sex, number>> = {
  goblet_squat: { male: 0.2, female: 0.15 },
  db_front_squat: { male: 0.15, female: 0.1 },
  db_reverse_lunge: { male: 0.12, female: 0.08 },
  db_bulgarian_split_squat: { male: 0.1, female: 0.07 },
  db_rdl: { male: 0.2, female: 0.15 },
  db_staggered_rdl: { male: 0.15, female: 0.12 },
  db_single_leg_rdl: { male: 0.12, female: 0.1 },
  db_glute_bridge: { male: 0.25, female: 0.2 },
  db_hip_thrust: { male: 0.3, female: 0.25 },
  db_floor_press: { male: 0.15, female: 0.1 },
  db_bench_press: { male: 0.17, female: 0.11 },
  db_overhead_press: { male: 0.1, female: 0.07 },
  single_arm_db_overhead_press: { male: 0.12, female: 0.08 },
  one_arm_db_row: { male: 0.2, female: 0.14 },
  db_bent_over_row: { male: 0.15, female: 0.11 },
  db_renegade_row: { male: 0.12, female: 0.09 },
  db_lateral_raise: { male: 0.05, female: 0.035 },
  db_curl: { male: 0.08, female: 0.055 },
  db_overhead_triceps_extension: { male: 0.12, female: 0.08 },
  db_calf_raise: { male: 0.2, female: 0.15 },
};

const DB: EquipmentItem[][] = [["dumbbells"]];
const DB_BENCH: EquipmentItem[][] = [["dumbbells", "bench"]];
const BW: EquipmentItem[][] = [[]];

export const EXERCISES: Exercise[] = [
  // ---------------- Squat: dumbbell ladder ----------------
  {
    id: "goblet_squat", name: "Goblet squat", pattern: "squat",
    primary: ["quads", "glutes"], secondary: ["core"],
    requires: DB, loadType: "single_dumbbell", ladder: "squat_db", ladderLevel: 1,
    unilateral: false, repTimeSec: 3, avoidWith: [],
    cue: "Hold one dumbbell at your chest, sit between your heels, chest up.",
  },
  {
    id: "db_front_squat", name: "Dumbbell front squat", pattern: "squat",
    primary: ["quads", "glutes"], secondary: ["core"],
    requires: DB, loadType: "dumbbell_pair", ladder: "squat_db", ladderLevel: 2,
    unilateral: false, repTimeSec: 3, avoidWith: [],
    cue: "Dumbbells resting on your shoulders, elbows up.",
  },
  {
    id: "db_reverse_lunge", name: "Dumbbell reverse lunge", pattern: "squat",
    primary: ["quads", "glutes"], secondary: ["hamstrings", "core"],
    requires: DB, loadType: "dumbbell_pair", ladder: "squat_db", ladderLevel: 3,
    unilateral: true, repTimeSec: 3, avoidWith: ["knee"],
    cue: "Step back, drop the back knee toward the floor, drive up through the front heel.",
  },
  {
    id: "db_bulgarian_split_squat", name: "Dumbbell Bulgarian split squat", pattern: "squat",
    primary: ["quads", "glutes"], secondary: ["hamstrings", "core"],
    requires: DB_BENCH, loadType: "dumbbell_pair", ladder: "squat_db", ladderLevel: 4,
    unilateral: true, repTimeSec: 3, avoidWith: ["knee"],
    cue: "Rear foot on the bench, front shin vertical.",
  },
  // ---------------- Squat: bodyweight ladder ----------------
  {
    id: "bodyweight_squat", name: "Bodyweight squat", pattern: "squat",
    primary: ["quads", "glutes"], secondary: [],
    requires: BW, loadType: "bodyweight", ladder: "squat_bw", ladderLevel: 1,
    unilateral: false, repTimeSec: 2.5, avoidWith: [], bodyweightFraction: 0.8,
  },
  {
    id: "bw_split_squat", name: "Split squat", pattern: "squat",
    primary: ["quads", "glutes"], secondary: ["hamstrings"],
    requires: BW, loadType: "bodyweight", ladder: "squat_bw", ladderLevel: 2,
    unilateral: true, repTimeSec: 2.5, avoidWith: ["knee"], bodyweightFraction: 0.8,
  },
  {
    id: "bw_reverse_lunge", name: "Reverse lunge", pattern: "squat",
    primary: ["quads", "glutes"], secondary: ["hamstrings"],
    requires: BW, loadType: "bodyweight", ladder: "squat_bw", ladderLevel: 3,
    unilateral: true, repTimeSec: 3, avoidWith: ["knee"], bodyweightFraction: 0.8,
  },
  {
    id: "bw_bulgarian_split_squat", name: "Bulgarian split squat", pattern: "squat",
    primary: ["quads", "glutes"], secondary: ["hamstrings"],
    requires: [["bench"]], loadType: "bodyweight", ladder: "squat_bw", ladderLevel: 4,
    unilateral: true, repTimeSec: 3, avoidWith: ["knee"], bodyweightFraction: 0.85,
  },
  // ---------------- Hinge: dumbbell ladder ----------------
  {
    id: "db_rdl", name: "Dumbbell Romanian deadlift", pattern: "hinge",
    primary: ["hamstrings", "glutes"], secondary: ["back", "core"],
    requires: DB, loadType: "dumbbell_pair", ladder: "hinge_db", ladderLevel: 1,
    unilateral: false, repTimeSec: 3, avoidWith: ["low_back"],
    cue: "Soft knees, push your hips back, dumbbells slide down your thighs, flat back.",
  },
  {
    id: "db_staggered_rdl", name: "Staggered-stance dumbbell RDL", pattern: "hinge",
    primary: ["hamstrings", "glutes"], secondary: ["back", "core"],
    requires: DB, loadType: "dumbbell_pair", ladder: "hinge_db", ladderLevel: 2,
    unilateral: true, repTimeSec: 3, avoidWith: ["low_back"],
  },
  {
    id: "db_single_leg_rdl", name: "Single-leg dumbbell RDL", pattern: "hinge",
    primary: ["hamstrings", "glutes"], secondary: ["back", "core"],
    requires: DB, loadType: "single_dumbbell", ladder: "hinge_db", ladderLevel: 3,
    unilateral: true, repTimeSec: 3.5, avoidWith: ["low_back"],
  },
  // ---------------- Hinge: bodyweight / bridge ladder ----------------
  {
    id: "glute_bridge", name: "Glute bridge", pattern: "hinge",
    primary: ["glutes", "hamstrings"], secondary: ["core"],
    requires: BW, loadType: "bodyweight", ladder: "hinge_bw", ladderLevel: 1,
    unilateral: false, repTimeSec: 2.5, avoidWith: [], bodyweightFraction: 0.4,
  },
  {
    id: "single_leg_glute_bridge", name: "Single-leg glute bridge", pattern: "hinge",
    primary: ["glutes", "hamstrings"], secondary: ["core"],
    requires: BW, loadType: "bodyweight", ladder: "hinge_bw", ladderLevel: 2,
    unilateral: true, repTimeSec: 2.5, avoidWith: [], bodyweightFraction: 0.45,
  },
  {
    id: "single_leg_hip_thrust", name: "Single-leg hip thrust", pattern: "hinge",
    primary: ["glutes", "hamstrings"], secondary: ["core"],
    requires: [["bench"]], loadType: "bodyweight", ladder: "hinge_bw", ladderLevel: 3,
    unilateral: true, repTimeSec: 2.5, avoidWith: [], bodyweightFraction: 0.55,
    cue: "Upper back against a couch or sturdy chair, one foot planted, drive the hips up.",
  },
  // ---------------- Hinge: loaded bridge ladder (kind to backs) ----------------
  {
    id: "db_glute_bridge", name: "Dumbbell glute bridge", pattern: "hinge",
    primary: ["glutes", "hamstrings"], secondary: ["core"],
    requires: DB, loadType: "single_dumbbell", ladder: "bridge_db", ladderLevel: 1,
    unilateral: false, repTimeSec: 2.5, avoidWith: [],
    cue: "Dumbbell across your hips, drive through your heels, squeeze at the top.",
  },
  {
    id: "db_hip_thrust", name: "Dumbbell hip thrust", pattern: "hinge",
    primary: ["glutes", "hamstrings"], secondary: ["core"],
    requires: DB_BENCH, loadType: "single_dumbbell", ladder: "bridge_db", ladderLevel: 2,
    unilateral: false, repTimeSec: 2.5, avoidWith: [],
    cue: "Upper back on the bench or couch edge, dumbbell across your hips, chin tucked.",
  },
  // ---------------- Horizontal push: bodyweight ladder ----------------
  {
    id: "incline_push_up", name: "Incline push-up", pattern: "horizontal_push",
    primary: ["chest", "triceps"], secondary: ["shoulders", "core"],
    requires: BW, loadType: "bodyweight", ladder: "hpush_bw", ladderLevel: 1,
    unilateral: false, repTimeSec: 2, avoidWith: ["wrist"], bodyweightFraction: 0.45,
    cue: "Hands on a counter or the back of a couch.",
  },
  {
    id: "knee_push_up", name: "Knee push-up", pattern: "horizontal_push",
    primary: ["chest", "triceps"], secondary: ["shoulders", "core"],
    requires: BW, loadType: "bodyweight", ladder: "hpush_bw", ladderLevel: 2,
    unilateral: false, repTimeSec: 2, avoidWith: ["wrist"], bodyweightFraction: 0.5,
  },
  {
    id: "push_up", name: "Push-up", pattern: "horizontal_push",
    primary: ["chest", "triceps"], secondary: ["shoulders", "core"],
    requires: BW, loadType: "bodyweight", ladder: "hpush_bw", ladderLevel: 3,
    unilateral: false, repTimeSec: 2, avoidWith: ["wrist"], bodyweightFraction: 0.64,
  },
  {
    id: "feet_elevated_push_up", name: "Feet-elevated push-up", pattern: "horizontal_push",
    primary: ["chest", "triceps"], secondary: ["shoulders", "core"],
    requires: [["bench"]], loadType: "bodyweight", ladder: "hpush_bw", ladderLevel: 4,
    unilateral: false, repTimeSec: 2, avoidWith: ["wrist"], bodyweightFraction: 0.75,
  },
  // ---------------- Horizontal push: dumbbell ladder ----------------
  {
    id: "db_floor_press", name: "Dumbbell floor press", pattern: "horizontal_push",
    primary: ["chest", "triceps"], secondary: ["shoulders"],
    requires: DB, loadType: "dumbbell_pair", ladder: "hpush_db", ladderLevel: 1,
    unilateral: false, repTimeSec: 2.5, avoidWith: [],
    cue: "Lying on the floor, elbows touch down lightly each rep.",
  },
  {
    id: "db_bench_press", name: "Dumbbell bench press", pattern: "horizontal_push",
    primary: ["chest", "triceps"], secondary: ["shoulders"],
    requires: DB_BENCH, loadType: "dumbbell_pair", ladder: "hpush_db", ladderLevel: 2,
    unilateral: false, repTimeSec: 2.5, avoidWith: [],
  },
  // ---------------- Vertical push ----------------
  {
    id: "db_overhead_press", name: "Dumbbell overhead press", pattern: "vertical_push",
    primary: ["shoulders", "triceps"], secondary: ["core"],
    requires: DB, loadType: "dumbbell_pair", ladder: "vpush_db", ladderLevel: 1,
    unilateral: false, repTimeSec: 2.5, avoidWith: ["shoulder"],
  },
  {
    id: "single_arm_db_overhead_press", name: "Single-arm dumbbell overhead press", pattern: "vertical_push",
    primary: ["shoulders", "triceps"], secondary: ["core"],
    requires: DB, loadType: "single_dumbbell", ladder: "vpush_db", ladderLevel: 2,
    unilateral: true, repTimeSec: 2.5, avoidWith: ["shoulder"],
  },
  {
    id: "pike_push_up", name: "Pike push-up", pattern: "vertical_push",
    primary: ["shoulders", "triceps"], secondary: ["chest", "core"],
    requires: BW, loadType: "bodyweight", ladder: "vpush_bw", ladderLevel: 1,
    unilateral: false, repTimeSec: 2.5, avoidWith: ["shoulder", "wrist"], bodyweightFraction: 0.55,
  },
  {
    id: "elevated_pike_push_up", name: "Feet-elevated pike push-up", pattern: "vertical_push",
    primary: ["shoulders", "triceps"], secondary: ["chest", "core"],
    requires: [["bench"]], loadType: "bodyweight", ladder: "vpush_bw", ladderLevel: 2,
    unilateral: false, repTimeSec: 2.5, avoidWith: ["shoulder", "wrist"], bodyweightFraction: 0.65,
  },
  // ---------------- Row ----------------
  {
    id: "one_arm_db_row", name: "One-arm dumbbell row", pattern: "row",
    primary: ["back", "biceps"], secondary: ["shoulders", "core"],
    requires: DB, loadType: "single_dumbbell", ladder: "row_db", ladderLevel: 1,
    unilateral: true, repTimeSec: 2.5, avoidWith: [],
    cue: "Free hand braced on a bench, chair or your knee. Pull to your hip.",
  },
  {
    id: "db_bent_over_row", name: "Dumbbell bent-over row", pattern: "row",
    primary: ["back", "biceps"], secondary: ["shoulders", "core"],
    requires: DB, loadType: "dumbbell_pair", ladder: "row_db", ladderLevel: 2,
    unilateral: false, repTimeSec: 2.5, avoidWith: ["low_back"],
  },
  {
    id: "db_renegade_row", name: "Renegade row", pattern: "row",
    primary: ["back", "biceps"], secondary: ["core", "shoulders"],
    requires: DB, loadType: "dumbbell_pair", ladder: "row_db", ladderLevel: 3,
    unilateral: true, repTimeSec: 2.5, avoidWith: ["wrist", "low_back"],
  },
  {
    id: "towel_door_row", name: "Towel door row", pattern: "row",
    primary: ["back", "biceps"], secondary: ["shoulders", "core"],
    requires: BW, loadType: "bodyweight", ladder: "row_bw", ladderLevel: 1,
    unilateral: false, repTimeSec: 2.5, avoidWith: [], bodyweightFraction: 0.5,
    cue: "Towel looped around a door handle (door closed, handle side), lean back with straight arms, row your chest to your hands. Walk your feet forward to make it harder.",
  },
  {
    id: "band_row", name: "Band row", pattern: "row",
    primary: ["back", "biceps"], secondary: ["shoulders"],
    requires: [["bands"]], loadType: "band", ladder: "row_band", ladderLevel: 1,
    unilateral: false, repTimeSec: 2, avoidWith: [],
    cue: "Band anchored around a post or under your feet, seated.",
  },
  // ---------------- Vertical pull ----------------
  {
    id: "negative_pull_up", name: "Negative pull-up", pattern: "vertical_pull",
    primary: ["back", "biceps"], secondary: ["shoulders", "core"],
    requires: [["pullup_bar"]], loadType: "bodyweight", ladder: "vpull_bar", ladderLevel: 1,
    unilateral: false, repTimeSec: 5, avoidWith: ["shoulder"], bodyweightFraction: 1,
    cue: "Jump or step to the top, lower yourself over 3–5 seconds.",
  },
  {
    id: "chin_up", name: "Chin-up", pattern: "vertical_pull",
    primary: ["back", "biceps"], secondary: ["shoulders", "core"],
    requires: [["pullup_bar"]], loadType: "bodyweight", ladder: "vpull_bar", ladderLevel: 2,
    unilateral: false, repTimeSec: 3, avoidWith: ["shoulder"], bodyweightFraction: 1,
  },
  {
    id: "pull_up", name: "Pull-up", pattern: "vertical_pull",
    primary: ["back", "biceps"], secondary: ["shoulders", "core"],
    requires: [["pullup_bar"]], loadType: "bodyweight", ladder: "vpull_bar", ladderLevel: 3,
    unilateral: false, repTimeSec: 3, avoidWith: ["shoulder"], bodyweightFraction: 1,
  },
  // ---------------- Core ----------------
  {
    id: "dead_bug", name: "Dead bug", pattern: "core",
    primary: ["core"], secondary: [],
    requires: BW, loadType: "bodyweight", ladder: "core_floor", ladderLevel: 1,
    unilateral: false, repTimeSec: 3, avoidWith: [],
  },
  {
    id: "plank", name: "Plank", pattern: "core",
    primary: ["core"], secondary: ["shoulders"],
    requires: BW, loadType: "time", ladder: "core_floor", ladderLevel: 2,
    unilateral: false, repTimeSec: 1, avoidWith: [],
  },
  {
    id: "hollow_hold", name: "Hollow hold", pattern: "core",
    primary: ["core"], secondary: [],
    requires: BW, loadType: "time", ladder: "core_floor", ladderLevel: 3,
    unilateral: false, repTimeSec: 1, avoidWith: ["low_back"],
  },
  {
    id: "kneeling_ab_rollout", name: "Kneeling ab-roller rollout", pattern: "core",
    primary: ["core"], secondary: ["back", "shoulders"],
    requires: [["ab_roller"]], loadType: "bodyweight", ladder: "core_roller", ladderLevel: 1,
    unilateral: false, repTimeSec: 4, avoidWith: ["low_back"],
    cue: "Roll out only as far as you can keep your lower back from sagging.",
  },
  {
    id: "standing_ab_rollout", name: "Standing ab-roller rollout", pattern: "core",
    primary: ["core"], secondary: ["back", "shoulders"],
    requires: [["ab_roller"]], loadType: "bodyweight", ladder: "core_roller", ladderLevel: 2,
    unilateral: false, repTimeSec: 5, avoidWith: ["low_back"],
  },
  {
    id: "hanging_knee_raise", name: "Hanging knee raise", pattern: "core",
    primary: ["core"], secondary: ["back"],
    requires: [["pullup_bar"]], loadType: "bodyweight", ladder: "core_hang", ladderLevel: 1,
    unilateral: false, repTimeSec: 2.5, avoidWith: ["shoulder"],
  },
  // ---------------- Isolation (third superset / longer sessions) ----------------
  {
    id: "db_lateral_raise", name: "Dumbbell lateral raise", pattern: "isolation",
    primary: ["shoulders"], secondary: [],
    requires: DB, loadType: "dumbbell_pair", ladder: "iso_shoulders", ladderLevel: 1,
    unilateral: false, repTimeSec: 2.5, avoidWith: ["shoulder"],
  },
  {
    id: "db_curl", name: "Dumbbell curl", pattern: "isolation",
    primary: ["biceps"], secondary: [],
    requires: DB, loadType: "dumbbell_pair", ladder: "iso_biceps", ladderLevel: 1,
    unilateral: false, repTimeSec: 2.5, avoidWith: [],
  },
  {
    id: "db_overhead_triceps_extension", name: "Dumbbell overhead triceps extension", pattern: "isolation",
    primary: ["triceps"], secondary: [],
    requires: DB, loadType: "single_dumbbell", ladder: "iso_triceps", ladderLevel: 1,
    unilateral: false, repTimeSec: 2.5, avoidWith: ["shoulder"],
  },
  {
    id: "db_calf_raise", name: "Dumbbell calf raise", pattern: "isolation",
    primary: ["calves"], secondary: [],
    requires: DB, loadType: "single_dumbbell", ladder: "iso_calves", ladderLevel: 1,
    unilateral: false, repTimeSec: 2, avoidWith: [],
  },
];

const byId = new Map(EXERCISES.map((e) => [e.id, e]));

/** The exercise with this id, or undefined if the library no longer has it. */
export function findExercise(id: string): Exercise | undefined {
  return byId.get(id);
}

export function getExercise(id: string): Exercise {
  const e = byId.get(id);
  if (!e) throw new Error(`Unknown exercise: ${id}`);
  return e;
}

export function ladderExercises(ladder: string): Exercise[] {
  return EXERCISES.filter((e) => e.ladder === ladder).sort((a, b) => a.ladderLevel - b.ladderLevel);
}
