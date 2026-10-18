import type { EquipmentItem, Exercise, Injury, LoadType, Muscle, Pattern, Sex, Tier } from "@repcurve/shared";
import { CATALOG, type CatalogEntry } from "./catalog.js";

/**
 * Starting load as a fraction of bodyweight for a novice who has never benchmarked the movement.
 * Per dumbbell for dumbbell pairs, the whole bar for barbells, the stack setting for machines and
 * cables. Deliberately conservative: the first session's benchmark set corrects it, and a load below
 * the empty bar or the lightest stack plate rounds up to it. Intermediate/advanced users get a multiplier.
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
  // Added with the 2026 evidence review.
  incline_dumbbell_bench_press: { male: 0.14, female: 0.09 },
  dumbbell_reverse_fly: { male: 0.04, female: 0.03 },
  chest_supported_dumbbell_row: { male: 0.15, female: 0.1 },
  dumbbell_hammer_curl: { male: 0.08, female: 0.055 },
  dumbbell_step_up: { male: 0.08, female: 0.06 },
  seated_dumbbell_calf_raise: { male: 0.1, female: 0.07 },
  barbell_bench_press: { male: 0.4, female: 0.28 },
  barbell_overhead_press: { male: 0.3, female: 0.2 },
  ez_bar_curl: { male: 0.17, female: 0.12 },
  barbell_back_squat: { male: 0.5, female: 0.35 },
  barbell_front_squat: { male: 0.4, female: 0.3 },
  barbell_hip_thrust: { male: 0.5, female: 0.4 },
  barbell_romanian_deadlift: { male: 0.45, female: 0.35 },
  trap_bar_deadlift: { male: 0.6, female: 0.45 },
  barbell_deadlift: { male: 0.6, female: 0.45 },
  machine_chest_press: { male: 0.3, female: 0.18 },
  cable_chest_fly: { male: 0.06, female: 0.04 },
  machine_shoulder_press: { male: 0.2, female: 0.12 },
  cable_lateral_raise: { male: 0.03, female: 0.02 },
  reverse_pec_deck: { male: 0.12, female: 0.08 },
  cable_triceps_pressdown: { male: 0.15, female: 0.1 },
  cable_overhead_triceps_extension: { male: 0.1, female: 0.07 },
  lat_pulldown: { male: 0.4, female: 0.25 },
  seated_cable_row: { male: 0.35, female: 0.22 },
  chest_supported_machine_row: { male: 0.25, female: 0.15 },
  machine_preacher_curl: { male: 0.1, female: 0.06 },
  leg_press: { male: 0.5, female: 0.35 },
  hack_squat_machine: { male: 0.2, female: 0.12 },
  smith_machine_squat: { male: 0.4, female: 0.28 },
  leg_extension: { male: 0.25, female: 0.18 },
  machine_hip_thrust: { male: 0.4, female: 0.3 },
  seated_leg_curl: { male: 0.2, female: 0.14 },
  lying_leg_curl: { male: 0.15, female: 0.1 },
  standing_machine_calf_raise: { male: 0.4, female: 0.3 },
  seated_machine_calf_raise: { male: 0.2, female: 0.14 },
  hip_abduction_machine: { male: 0.25, female: 0.2 },
  hip_adduction_machine: { male: 0.25, female: 0.2 },
  cable_crunch: { male: 0.25, female: 0.17 },
};

/**
 * What the catalog's equipment words mean in the app. Surroundings most homes and gyms have
 * (floor space, a wall, a counter to hold, the attachments that come with a cable station) are
 * always available. The towel-and-door setup is never offered: the review retired it.
 */
const ITEM: Record<string, EquipmentItem | "always" | "never"> = {
  floor_space: "always", wall: "always", standing_space: "always", balance_support: "always",
  stable_hand_support: "always", stable_elevated_hand_support: "always", clear_walkway: "always",
  clear_floor: "always", compatible_floor: "always", smooth_floor: "always", clear_lifting_area: "always",
  bar_pad: "always", handle: "always", handles: "always", pressdown_attachment: "always",
  extension_attachment: "always", pulldown_attachment: "always", row_attachment: "always", rope_attachment: "always",
  stable_chair: "bench", stable_step: "bench", stable_access_platform: "bench", stable_rear_foot_support: "bench",
  stable_shoulder_support: "bench", stable_foot_platform: "bench",
  dumbbell: "dumbbells", dumbbells: "dumbbells", nonrolling_dumbbells: "dumbbells",
  flat_bench: "flat_bench", adjustable_bench: "adjustable_bench",
  resistance_band: "bands", assistance_band: "bands", loop_band: "bands",
  rated_row_anchor: "band_anchor", rated_high_anchor: "band_anchor", rated_chest_height_anchor: "band_anchor",
  suspension_trainer: "suspension", rated_suspension_anchor: "suspension",
  sliders: "sliders", towels: "sliders",
  pull_up_bar: "pullup_bar", ab_roller: "ab_roller",
  barbell: "barbell", plates: "barbell", rack: "rack", squat_rack: "rack", safeties: "rack",
  bench_press_rack: "rack", bench_safeties_or_spotter: "rack", trap_bar: "trap_bar", ez_bar: "ez_bar",
  cable_station: "cables", dual_cable_station: "cables", seated_row_station: "cables",
  chest_press_machine: "machine:chest_press", shoulder_press_machine: "machine:shoulder_press",
  reverse_fly_machine: "machine:reverse_fly", lat_pulldown_machine: "machine:lat_pulldown",
  supported_row_machine: "machine:supported_row", assisted_pull_up_machine: "machine:assisted_pull_up",
  preacher_curl_machine: "machine:preacher_curl", leg_press_machine: "machine:leg_press",
  hack_squat_machine: "machine:hack_squat", smith_machine: "machine:smith",
  leg_extension_machine: "machine:leg_extension", seated_leg_curl_machine: "machine:seated_leg_curl",
  lying_leg_curl_machine: "machine:lying_leg_curl", standing_calf_machine: "machine:standing_calf",
  seated_calf_machine: "machine:seated_calf", hip_thrust_machine: "machine:hip_thrust",
  hip_abduction_machine: "machine:hip_abduction", hip_adduction_machine: "machine:hip_adduction",
  back_extension_bench: "machine:back_extension",
  towel: "never", verified_load_bearing_door_setup: "never",
};

function requiresFrom(c: CatalogEntry): EquipmentItem[][] {
  return c.equipment.map((option) => {
    const items = new Set<EquipmentItem>();
    for (const word of option) {
      const item = ITEM[word];
      if (item === undefined) throw new Error(`Unknown equipment "${word}" on ${c.id}`);
      if (item === "never") return ["never" as EquipmentItem];
      if (item !== "always") items.add(item);
    }
    return [...items];
  });
}

/** Anatomical targets to the muscle groups weekly volume is counted in. Stabilisers never count. */
const GROUP: Record<string, Muscle | null> = {
  pectoralis_major: "chest", anterior_deltoid: "shoulders", lateral_deltoid: "shoulders", posterior_deltoid: "shoulders",
  triceps: "triceps", elbow_flexors: "biceps", latissimus_dorsi: "back", scapular_retractors: "back",
  scapular_depressors: "back", spinal_erectors: "back", quadriceps: "quads", gluteus_maximus: "glutes",
  gluteus_medius: "glutes", gluteus_minimus: "glutes", hamstrings: "hamstrings", gastrocnemius: "calves",
  soleus: "calves", abdominals: "core", rectus_abdominis: "core", lateral_trunk_muscles: "core",
  trunk_muscles: "core", hip_flexors: "core", adductor_magnus: null, hip_adductors: null, grip: null,
  shoulder_girdle: null, supporting_shoulder: null,
};

const groups = (targets: string[]): Muscle[] => {
  const out: Muscle[] = [];
  for (const t of targets) {
    const g = GROUP[t];
    if (g === undefined) throw new Error(`Unknown target "${t}"`);
    if (g && !out.includes(g)) out.push(g);
  }
  return out;
};

const tierOf = (c: CatalogEntry): Tier =>
  !c.selectable || c.priority === "retire" ? "retired" : c.defaultPool ? "default" : c.priority === "advanced" ? "advanced" : "optional";

/** The planner's view of an exercise: how it's slotted, loaded, timed and progressed. */
interface Spec {
  /** Our id, when it predates the catalog (logs and progress are stored under it). */
  id?: string;
  pattern: Pattern;
  family: string;
  load: LoadType;
  ladder: string;
  level?: number;
  rep: number;
  setup?: number;
  avoid?: Injury[];
  bw?: number;
  bar?: number;
  assisted?: boolean;
  cue?: string;
  /** One side at a time even though the catalog counts it in total (or the other way round). */
  unilateral?: boolean;
}

/**
 * Every exercise, in the order ties are broken: on a ladder, the later of two exercises at the
 * same level is preferred (a bench press over a floor press when there's a bench).
 */
const SPECS: [string, Spec][] = [
  // ---------------- Squat ----------------
  ["dumbbell_front_squat", { id: "db_front_squat", pattern: "squat", family: "squat", load: "dumbbell_pair", ladder: "squat_db", rep: 3, cue: "Dumbbells resting on your shoulders, elbows up." }],
  ["goblet_squat", { pattern: "squat", family: "squat", load: "single_dumbbell", ladder: "squat_db", rep: 3, cue: "Hold one dumbbell at your chest, sit between your heels, chest up." }],
  ["sit_to_stand", { pattern: "squat", family: "squat", load: "bodyweight", ladder: "squat_bw", level: 0, rep: 3, setup: 10, bw: 0.7 }],
  ["bodyweight_squat", { pattern: "squat", family: "squat", load: "bodyweight", ladder: "squat_bw", rep: 2.5, bw: 0.8 }],
  ["barbell_back_squat", { pattern: "squat", family: "squat", load: "barbell", ladder: "squat_bb", rep: 3, setup: 60, bar: 20, avoid: ["low_back"] }],
  ["barbell_front_squat", { pattern: "squat", family: "squat", load: "barbell", ladder: "squat_bb_front", rep: 3, setup: 60, bar: 20, avoid: ["low_back"] }],
  ["leg_press", { pattern: "squat", family: "squat", load: "machine", ladder: "squat_machine", rep: 3, setup: 45 }],
  ["hack_squat_machine", { pattern: "squat", family: "squat", load: "machine", ladder: "squat_hack", rep: 3, setup: 45, avoid: ["knee"] }],
  ["smith_machine_squat", { pattern: "squat", family: "squat", load: "machine", ladder: "squat_smith", rep: 3, setup: 45, avoid: ["low_back"] }],
  ["dumbbell_reverse_lunge", { id: "db_reverse_lunge", pattern: "squat", family: "lunge", load: "dumbbell_pair", ladder: "lunge_db", rep: 3, avoid: ["knee"], cue: "Step back, drop the back knee toward the floor, drive up through the front heel." }],
  ["dumbbell_bulgarian_split_squat", { id: "db_bulgarian_split_squat", pattern: "squat", family: "lunge", load: "dumbbell_pair", ladder: "lunge_db_bss", rep: 3, avoid: ["knee"], cue: "Rear foot on the bench, front shin vertical." }],
  ["supported_split_squat", { pattern: "squat", family: "lunge", load: "bodyweight", ladder: "lunge_bw_supported", rep: 3, avoid: ["knee"], bw: 0.75 }],
  ["split_squat", { id: "bw_split_squat", pattern: "squat", family: "lunge", load: "bodyweight", ladder: "lunge_bw", rep: 2.5, avoid: ["knee"], bw: 0.8 }],
  ["reverse_lunge", { id: "bw_reverse_lunge", pattern: "squat", family: "lunge", load: "bodyweight", ladder: "lunge_bw_reverse", rep: 3, avoid: ["knee"], bw: 0.8 }],
  ["bulgarian_split_squat", { id: "bw_bulgarian_split_squat", pattern: "squat", family: "lunge", load: "bodyweight", ladder: "lunge_bw_bss", rep: 3, avoid: ["knee"], bw: 0.85 }],
  ["step_up", { pattern: "squat", family: "lunge", load: "bodyweight", ladder: "stepup_bw", rep: 3, avoid: ["knee"], bw: 0.85 }],
  ["dumbbell_step_up", { pattern: "squat", family: "lunge", load: "dumbbell_pair", ladder: "stepup_db", rep: 3, avoid: ["knee"] }],

  // ---------------- Hinge: Romanian deadlifts, bridges, deadlifts ----------------
  ["dumbbell_romanian_deadlift", { id: "db_rdl", pattern: "hinge", family: "rdl", load: "dumbbell_pair", ladder: "hinge_db", rep: 3, avoid: ["low_back"], cue: "Soft knees, push your hips back, dumbbells slide down your thighs, flat back." }],
  ["staggered_stance_dumbbell_rdl", { id: "db_staggered_rdl", pattern: "hinge", family: "rdl", load: "dumbbell_pair", ladder: "hinge_db_staggered", rep: 3, avoid: ["low_back"] }],
  ["single_leg_dumbbell_rdl", { id: "db_single_leg_rdl", pattern: "hinge", family: "rdl", load: "single_dumbbell", ladder: "hinge_db_single", rep: 3.5, avoid: ["low_back"] }],
  ["band_romanian_deadlift", { pattern: "hinge", family: "rdl", load: "band", ladder: "hinge_band", rep: 3, setup: 10, avoid: ["low_back"] }],
  ["barbell_romanian_deadlift", { pattern: "hinge", family: "rdl", load: "barbell", ladder: "hinge_bb", rep: 3.5, setup: 60, bar: 20, avoid: ["low_back"] }],
  ["glute_bridge", { pattern: "hinge", family: "bridge", load: "bodyweight", ladder: "bridge_bw", rep: 2.5, bw: 0.4 }],
  ["single_leg_glute_bridge", { pattern: "hinge", family: "bridge", load: "bodyweight", ladder: "bridge_bw_single", rep: 2.5, bw: 0.45 }],
  ["bodyweight_hip_thrust", { pattern: "hinge", family: "bridge", load: "bodyweight", ladder: "thrust_bw", rep: 2.5, setup: 10, bw: 0.5 }],
  ["single_leg_hip_thrust", { pattern: "hinge", family: "bridge", load: "bodyweight", ladder: "thrust_bw_single", rep: 2.5, bw: 0.55, cue: "Upper back against a couch or sturdy chair, one foot planted, drive the hips up." }],
  ["dumbbell_glute_bridge", { id: "db_glute_bridge", pattern: "hinge", family: "bridge", load: "single_dumbbell", ladder: "bridge_db", rep: 2.5, cue: "Dumbbell across your hips, drive through your heels, squeeze at the top." }],
  ["dumbbell_hip_thrust", { id: "db_hip_thrust", pattern: "hinge", family: "bridge", load: "single_dumbbell", ladder: "bridge_db", rep: 2.5, cue: "Upper back on the bench or couch edge, dumbbell across your hips, chin tucked." }],
  ["barbell_hip_thrust", { pattern: "hinge", family: "bridge", load: "barbell", ladder: "bridge_bb", rep: 3, setup: 60, bar: 20 }],
  ["machine_hip_thrust", { pattern: "hinge", family: "bridge", load: "machine", ladder: "bridge_machine", rep: 3, setup: 45 }],
  ["trap_bar_deadlift", { pattern: "hinge", family: "deadlift", load: "barbell", ladder: "deadlift_trap", rep: 3.5, setup: 60, bar: 25, avoid: ["low_back"] }],
  ["barbell_deadlift", { pattern: "hinge", family: "deadlift", load: "barbell", ladder: "deadlift_bb", rep: 4, setup: 60, bar: 20, avoid: ["low_back"] }],
  ["45_degree_back_extension", { id: "back_extension_45", pattern: "hinge", family: "back_extension", load: "bodyweight", ladder: "back_extension", rep: 2.5, setup: 30, avoid: ["low_back"], bw: 0.5 }],

  // ---------------- Horizontal push ----------------
  ["wall_push_up", { pattern: "horizontal_push", family: "hpush", load: "bodyweight", ladder: "hpush_bw", level: 0, rep: 2, bw: 0.25 }],
  ["incline_push_up", { pattern: "horizontal_push", family: "hpush", load: "bodyweight", ladder: "hpush_bw", level: 1, rep: 2, avoid: ["wrist"], bw: 0.45, cue: "Hands on a counter or the back of a couch." }],
  ["push_up", { pattern: "horizontal_push", family: "hpush", load: "bodyweight", ladder: "hpush_bw", level: 2, rep: 2, avoid: ["wrist"], bw: 0.64 }],
  ["knee_push_up", { pattern: "horizontal_push", family: "hpush", load: "bodyweight", ladder: "hpush_knee", rep: 2, avoid: ["wrist"], bw: 0.5 }],
  ["feet_elevated_push_up", { pattern: "horizontal_push", family: "hpush", load: "bodyweight", ladder: "hpush_feet_up", rep: 2, avoid: ["wrist"], bw: 0.75 }],
  ["dumbbell_floor_press", { id: "db_floor_press", pattern: "horizontal_push", family: "hpush", load: "dumbbell_pair", ladder: "hpush_db", rep: 2.5, cue: "Lying on the floor, elbows touch down lightly each rep." }],
  ["dumbbell_bench_press", { id: "db_bench_press", pattern: "horizontal_push", family: "hpush", load: "dumbbell_pair", ladder: "hpush_db", rep: 2.5, setup: 15 }],
  ["incline_dumbbell_bench_press", { pattern: "horizontal_push", family: "hpush", load: "dumbbell_pair", ladder: "hpush_db_incline", rep: 3, setup: 30 }],
  ["barbell_bench_press", { pattern: "horizontal_push", family: "hpush", load: "barbell", ladder: "hpush_bb", rep: 3, setup: 60, bar: 20 }],
  ["machine_chest_press", { pattern: "horizontal_push", family: "hpush", load: "machine", ladder: "hpush_machine", rep: 2.5, setup: 30 }],
  ["cable_chest_fly", { pattern: "isolation", family: "chest_fly", load: "cable", ladder: "fly_cable", rep: 3, setup: 40, avoid: ["shoulder"] }],

  // ---------------- Vertical push ----------------
  ["dumbbell_overhead_press", { id: "db_overhead_press", pattern: "vertical_push", family: "vpush", load: "dumbbell_pair", ladder: "vpush_db", rep: 2.5, avoid: ["shoulder"] }],
  ["single_arm_dumbbell_overhead_press", { id: "single_arm_db_overhead_press", pattern: "vertical_push", family: "vpush", load: "single_dumbbell", ladder: "vpush_db_single", rep: 2.5, avoid: ["shoulder"] }],
  ["machine_shoulder_press", { pattern: "vertical_push", family: "vpush", load: "machine", ladder: "vpush_machine", rep: 2.5, setup: 30, avoid: ["shoulder"] }],
  ["barbell_overhead_press", { pattern: "vertical_push", family: "vpush", load: "barbell", ladder: "vpush_bb", rep: 2.5, setup: 60, bar: 20, avoid: ["shoulder", "low_back"] }],
  ["band_overhead_press", { pattern: "vertical_push", family: "vpush", load: "band", ladder: "vpush_band", rep: 2.5, setup: 10, avoid: ["shoulder"] }],
  ["pike_push_up", { pattern: "vertical_push", family: "vpush", load: "bodyweight", ladder: "vpush_bw", level: 1, rep: 2.5, avoid: ["shoulder", "wrist"], bw: 0.55 }],
  ["feet_elevated_pike_push_up", { id: "elevated_pike_push_up", pattern: "vertical_push", family: "vpush", load: "bodyweight", ladder: "vpush_bw", level: 2, rep: 2.5, avoid: ["shoulder", "wrist"], bw: 0.65 }],

  // ---------------- Row ----------------
  ["dumbbell_bent_over_row", { id: "db_bent_over_row", pattern: "row", family: "row", load: "dumbbell_pair", ladder: "row_db", rep: 2.5, avoid: ["low_back"] }],
  ["one_arm_dumbbell_row", { id: "one_arm_db_row", pattern: "row", family: "row", load: "single_dumbbell", ladder: "row_db", rep: 2.5, cue: "Free hand braced on a bench, chair or your knee. Pull to your hip." }],
  ["chest_supported_dumbbell_row", { pattern: "row", family: "row", load: "dumbbell_pair", ladder: "row_db_supported", rep: 2.5, setup: 30 }],
  ["renegade_row", { id: "db_renegade_row", pattern: "row", family: "row", load: "dumbbell_pair", ladder: "row_renegade", rep: 2.5, avoid: ["wrist", "low_back"] }],
  ["band_row", { pattern: "row", family: "row", load: "band", ladder: "row_band", rep: 2, setup: 20, cue: "Band anchored at chest height in a door anchor or around a sturdy post." }],
  ["suspension_row", { pattern: "row", family: "row", load: "bodyweight", ladder: "row_suspension", rep: 2.5, setup: 30, bw: 0.5 }],
  ["seated_cable_row", { pattern: "row", family: "row", load: "cable", ladder: "row_cable", rep: 3, setup: 30 }],
  ["chest_supported_machine_row", { pattern: "row", family: "row", load: "machine", ladder: "row_machine", rep: 3, setup: 45 }],
  ["towel_door_row", { pattern: "row", family: "row", load: "bodyweight", ladder: "row_door", rep: 2.5, bw: 0.5 }],

  // ---------------- Vertical pull ----------------
  ["lat_pulldown", { pattern: "vertical_pull", family: "vpull", load: "machine", ladder: "vpull_machine", rep: 3, setup: 30 }],
  ["assisted_pull_up_machine", { pattern: "vertical_pull", family: "vpull", load: "bodyweight", ladder: "vpull_assisted_machine", rep: 3, setup: 30, avoid: ["shoulder"], assisted: true, bw: 0.6 }],
  ["band_assisted_pull_up", { pattern: "vertical_pull", family: "vpull", load: "band", ladder: "vpull_assisted_band", rep: 3, setup: 30, avoid: ["shoulder"], assisted: true }],
  ["band_lat_pulldown", { pattern: "vertical_pull", family: "vpull", load: "band", ladder: "vpull_band", rep: 2.5, setup: 20 }],
  ["pull_up", { pattern: "vertical_pull", family: "vpull", load: "bodyweight", ladder: "vpull_bar", level: 2, rep: 3, avoid: ["shoulder"], bw: 1 }],
  ["chin_up", { pattern: "vertical_pull", family: "vpull", load: "bodyweight", ladder: "vpull_bar", level: 2, rep: 3, avoid: ["shoulder"], bw: 1 }],
  ["negative_pull_up", { pattern: "vertical_pull", family: "vpull", load: "bodyweight", ladder: "vpull_negative", rep: 5, avoid: ["shoulder"], bw: 1, cue: "Step up to the top from a sturdy chair, lower yourself over 3–5 seconds." }],

  // ---------------- Isolation ----------------
  ["dumbbell_lateral_raise", { id: "db_lateral_raise", pattern: "isolation", family: "lateral_raise", load: "dumbbell_pair", ladder: "lateral_db", rep: 2.5, avoid: ["shoulder"] }],
  ["cable_lateral_raise", { pattern: "isolation", family: "lateral_raise", load: "cable", ladder: "lateral_cable", rep: 2.5, setup: 30, avoid: ["shoulder"] }],
  ["dumbbell_reverse_fly", { pattern: "isolation", family: "rear_delt", load: "dumbbell_pair", ladder: "rear_delt_db", rep: 2.5 }],
  ["reverse_pec_deck", { pattern: "isolation", family: "rear_delt", load: "machine", ladder: "rear_delt_machine", rep: 2.5, setup: 30 }],
  ["dumbbell_curl", { id: "db_curl", pattern: "isolation", family: "biceps", load: "dumbbell_pair", ladder: "curl_db", rep: 2.5 }],
  ["dumbbell_hammer_curl", { pattern: "isolation", family: "biceps", load: "dumbbell_pair", ladder: "curl_hammer", rep: 2.5 }],
  ["band_curl", { pattern: "isolation", family: "biceps", load: "band", ladder: "curl_band", rep: 2, setup: 10 }],
  ["machine_preacher_curl", { pattern: "isolation", family: "biceps", load: "machine", ladder: "curl_machine", rep: 3, setup: 30 }],
  ["ez_bar_curl", { pattern: "isolation", family: "biceps", load: "barbell", ladder: "curl_ez", rep: 2.5, setup: 45, bar: 10, avoid: ["wrist"] }],
  ["dumbbell_overhead_triceps_extension", { id: "db_overhead_triceps_extension", pattern: "isolation", family: "triceps", load: "single_dumbbell", ladder: "triceps_db", rep: 2.5, avoid: ["shoulder"] }],
  ["cable_triceps_pressdown", { pattern: "isolation", family: "triceps", load: "cable", ladder: "triceps_pressdown", rep: 2.5, setup: 30 }],
  ["cable_overhead_triceps_extension", { pattern: "isolation", family: "triceps", load: "cable", ladder: "triceps_cable_overhead", rep: 3, setup: 30, avoid: ["shoulder"] }],
  ["band_triceps_pressdown", { pattern: "isolation", family: "triceps", load: "band", ladder: "triceps_band", rep: 2, setup: 20 }],
  ["leg_extension", { pattern: "isolation", family: "knee_extension", load: "machine", ladder: "leg_extension", rep: 2.5, setup: 30, avoid: ["knee"] }],
  ["hamstring_walkout", { pattern: "isolation", family: "knee_flexion", load: "bodyweight", ladder: "hamstring_bw", level: 1, rep: 5, bw: 0.3 }],
  ["sliding_leg_curl", { pattern: "isolation", family: "knee_flexion", load: "bodyweight", ladder: "hamstring_bw", level: 2, rep: 3, setup: 10, bw: 0.35 }],
  ["seated_leg_curl", { pattern: "isolation", family: "knee_flexion", load: "machine", ladder: "leg_curl_seated", rep: 2.5, setup: 30 }],
  ["lying_leg_curl", { pattern: "isolation", family: "knee_flexion", load: "machine", ladder: "leg_curl_lying", rep: 2.5, setup: 30 }],
  ["dumbbell_calf_raise", { id: "db_calf_raise", pattern: "isolation", family: "calf", load: "single_dumbbell", ladder: "calf_db", rep: 2 }],
  ["bodyweight_standing_calf_raise", { pattern: "isolation", family: "calf", load: "bodyweight", ladder: "calf_bw", rep: 2, bw: 1 }],
  ["single_leg_bodyweight_calf_raise", { pattern: "isolation", family: "calf", load: "bodyweight", ladder: "calf_bw_single", rep: 2, bw: 1 }],
  ["standing_machine_calf_raise", { pattern: "isolation", family: "calf", load: "machine", ladder: "calf_machine", rep: 2.5, setup: 30 }],
  ["seated_machine_calf_raise", { pattern: "isolation", family: "calf", load: "machine", ladder: "calf_machine_seated", rep: 2.5, setup: 30 }],
  ["seated_dumbbell_calf_raise", { pattern: "isolation", family: "calf", load: "single_dumbbell", ladder: "calf_db_seated", rep: 2, setup: 10 }],
  ["side_lying_hip_abduction", { pattern: "isolation", family: "hip_abduction", load: "bodyweight", ladder: "abduction_bw", rep: 2, bw: 0.15 }],
  ["band_hip_abduction", { pattern: "isolation", family: "hip_abduction", load: "band", ladder: "abduction_band", rep: 2, setup: 10 }],
  ["hip_abduction_machine", { pattern: "isolation", family: "hip_abduction", load: "machine", ladder: "abduction_machine", rep: 2.5, setup: 30 }],
  ["hip_adduction_machine", { pattern: "isolation", family: "hip_adduction", load: "machine", ladder: "adduction_machine", rep: 2.5, setup: 30 }],

  // ---------------- Core ----------------
  ["dead_bug", { pattern: "core", family: "anti_extension", load: "bodyweight", ladder: "core_floor", level: 1, rep: 3 }],
  ["plank", { pattern: "core", family: "anti_extension", load: "time", ladder: "core_floor", level: 2, rep: 1 }],
  ["hollow_hold", { pattern: "core", family: "anti_extension", load: "time", ladder: "core_hollow", rep: 1, avoid: ["low_back"] }],
  ["kneeling_ab_roller_rollout", { id: "kneeling_ab_rollout", pattern: "core", family: "anti_extension", load: "bodyweight", ladder: "core_roller", level: 1, rep: 4, avoid: ["low_back"], cue: "Roll out only as far as you can keep your lower back from sagging." }],
  ["standing_ab_roller_rollout", { id: "standing_ab_rollout", pattern: "core", family: "anti_extension", load: "bodyweight", ladder: "core_roller", level: 2, rep: 5, avoid: ["low_back"] }],
  ["side_plank", { pattern: "core", family: "anti_lateral", load: "time", ladder: "core_side", rep: 1 }],
  ["suitcase_carry", { pattern: "core", family: "anti_lateral", load: "time", ladder: "core_carry", rep: 1, cue: "Carry one heavy dumbbell at your side, walking tall without leaning." }],
  ["pallof_press", { pattern: "core", family: "anti_rotation", load: "band", ladder: "core_pallof", rep: 4, setup: 30 }],
  ["reverse_crunch", { pattern: "core", family: "trunk_flexion", load: "bodyweight", ladder: "core_flexion", rep: 2.5 }],
  ["lying_leg_raise", { pattern: "core", family: "trunk_flexion", load: "bodyweight", ladder: "core_flexion", level: 2, rep: 3, avoid: ["low_back"], cue: "Press your lower back into the floor; stop lowering if it arches." }],
  ["hanging_knee_raise", { pattern: "core", family: "trunk_flexion", load: "bodyweight", ladder: "core_hang", rep: 2.5, avoid: ["shoulder"] }],
  ["cable_crunch", { pattern: "core", family: "trunk_flexion", load: "cable", ladder: "core_cable_crunch", rep: 2.5, setup: 30, avoid: ["low_back"] }],
];

const byCatalogId = new Map(CATALOG.map((c) => [c.id, c]));

function build(catalogId: string, s: Spec): Exercise {
  const c = byCatalogId.get(catalogId);
  if (!c) throw new Error(`No catalog entry for ${catalogId}`);
  const e: Exercise = {
    id: s.id ?? catalogId,
    name: c.name,
    pattern: s.pattern,
    family: s.family,
    tier: tierOf(c),
    group: c.group,
    primary: groups(c.prime),
    secondary: groups(c.secondary).filter((m) => !groups(c.prime).includes(m)),
    targets: { prime: c.prime, secondary: c.secondary, stabilizers: c.stabilizers },
    requires: requiresFrom(c),
    loadType: s.load,
    ladder: s.ladder,
    ladderLevel: s.level ?? 1,
    unilateral: s.unilateral ?? c.laterality === "unilateral",
    repTimeSec: s.rep,
    avoidWith: s.avoid ?? [],
    note: c.note,
    evidence: { basis: c.basis, direct: c.direct, context: c.context },
  };
  if (s.bw !== undefined) e.bodyweightFraction = s.bw;
  if (s.cue) e.cue = s.cue;
  if (s.setup) e.setupSec = s.setup;
  if (s.bar !== undefined) e.barKg = s.bar;
  if (s.assisted) e.assisted = true;
  return e;
}

export const EXERCISES: Exercise[] = SPECS.map(([catalogId, spec]) => build(catalogId, spec));

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

/** Browsing groups, in the order the library shows them. */
export const GROUPS = ["Chest", "Shoulders", "Triceps", "Back", "Biceps", "Quads", "Glutes", "Hamstrings", "Calves", "Core", "Hip abductors", "Hip adductors", "Spinal erectors"];
