/**
 * Mobility: stretches held for time and slow, controlled drills, put together into short routines.
 * Separate from the exercise library on purpose: nothing here is loaded, progressed by weight or
 * counted toward weekly sets. A routine may borrow a light strength exercise from the library
 * (a glute bridge), by its library id. General guidance, not medical advice or rehabilitation.
 */
import type { EquipmentItem, Injury } from "@repcurve/shared";
import type { Source } from "./catalog.js";
import type { HowTo } from "./howto.js";

export interface Drill {
  id: string;
  name: string;
  /** "hold": a position held for time. "reps": slow, controlled reps at your own pace. */
  kind: "hold" | "reps";
  /** What it works on, for lists: "Front of the hip". */
  area: string;
  /** One side, then the other. */
  sided: boolean;
  /** Which side is which for a one-sided drill: "{Side} knee down" reads "Left knee down". */
  sideLabel?: string;
  /** What a rep drill counts: "circles each way", "switches". Missing means "reps". */
  count?: string;
  /** Seconds one count takes at an unhurried pace, for a session's estimated length. */
  countSec?: number;
  /** OR of ANDs, as for exercises. Empty means nothing is needed. */
  requires: EquipmentItem[][];
  /** Areas it tends to bother even done gently: it's swapped for `gentler`, or left out. */
  avoidWith: Injury[];
  /** A drill for the same job that spares the `avoidWith` areas. */
  gentler?: string;
  /** How to do it when an area is sensitive but the drill is still fine. */
  ease?: Partial<Record<Injury, string>>;
  /** Who should leave it out, shown with the how-to. */
  skipIf?: string;
  /** The one line shown while doing it. */
  cue: string;
  howTo: HowTo;
}

const HOLD = "Hold and breathe slowly. Switch sides when the timer says.";
const FOREARMS = "Rest on your forearms or fists instead of flat hands.";

export const DRILLS: Drill[] = [
  // ---------------- Hips ----------------
  {
    id: "hip_circles",
    name: "Hip circles on all fours",
    kind: "reps",
    area: "Hips, all directions",
    sided: true,
    sideLabel: "{Side} leg",
    count: "circles each way",
    countSec: 8,
    requires: [],
    avoidWith: [],
    ease: { wrist: FOREARMS, knee: "Put a folded towel or cushion under the knee you're kneeling on." },
    cue: "Draw the biggest slow circle you can with your knee while the rest of you stays still.",
    howTo: {
      setup: "Kneel on all fours on a mat, rug or carpet, hands under your shoulders and knees under your hips. Keep your back flat and your stomach lightly braced.",
      steps: [
        "Lift one knee a little off the floor, keeping it bent.",
        "Draw the biggest circle you can with that knee: forward toward your chest, out to the side, back behind you, then down and in.",
        "Take about four seconds a circle. After your forward circles, do the same number backwards.",
        "Do all your circles with one leg, then switch sides.",
      ],
      cues: ["Only the hip moves: your back and the rest of you stay still", "Slow enough that you could stop anywhere in the circle", "Arms straight, weight even on both hands"],
      mistakes: ["Rocking your body or twisting your back to make the circle bigger", "Rushing: small and controlled beats big and sloppy", "Holding your breath"],
    },
  },
  {
    id: "ninety_ninety",
    name: "90/90 hip switches",
    kind: "reps",
    area: "Hip rotation",
    sided: false,
    count: "switches",
    countSec: 5,
    requires: [],
    avoidWith: ["knee"],
    gentler: "lying_knee_drops",
    ease: {
      low_back: "Stay leaning back on your hands so your lower back can relax.",
      wrist: "Rest on your fists or fingertips, or sit on a cushion so your hands carry less.",
    },
    cue: "Sit tall and let both knees fall slowly from one side to the other.",
    howTo: {
      setup: "Sit on the floor with your knees bent and your feet flat, set wider than your hips. Lean back a little on your hands.",
      steps: [
        "Let both knees fall slowly to one side until they rest on the floor, or as near as they comfortably go.",
        "Sit as tall as you can for one breath.",
        "Lift your knees back up through the middle and lower them to the other side. That's two switches.",
        "Keep your feet where they are and let them roll as your knees move.",
      ],
      cues: ["Both sit bones stay as close to the floor as you can keep them", "Chest tall, shoulders relaxed", "A stretch around the hips, nothing sharp in the knees"],
      mistakes: ["Flopping the knees down fast", "Rounding forward to get the knees lower", "Pushing through a pinch in the hip or knee: make the movement smaller instead"],
    },
  },
  {
    id: "lying_knee_drops",
    name: "Lying knee drops",
    kind: "reps",
    area: "Hip rotation",
    sided: false,
    count: "switches",
    countSec: 5,
    requires: [],
    avoidWith: [],
    cue: "Feet wide, knees fall slowly side to side while your shoulders stay down.",
    howTo: {
      setup: "Lie on your back on a mat, rug or carpet with your knees bent and your feet flat, set wider than your hips. Rest your arms out to the sides.",
      steps: [
        "Let both knees fall slowly to one side, as far as they comfortably go.",
        "Pause for one breath.",
        "Bring them back up through the middle and over to the other side. That's two switches.",
      ],
      cues: ["Both shoulders stay on the floor", "Feet stay planted and roll onto their edges", "Easy breathing the whole time"],
      mistakes: ["Letting the knees drop fast", "Lifting a shoulder to get further", "Forcing the knees to the floor"],
    },
  },
  {
    id: "hip_flexor_stretch",
    name: "Half-kneeling hip-flexor stretch",
    kind: "hold",
    area: "Front of the hip",
    sided: true,
    sideLabel: "{Side} knee down",
    requires: [],
    avoidWith: ["knee"],
    gentler: "standing_hip_flexor_stretch",
    ease: { low_back: "Keep your tailbone tucked the whole time and move your hips forward less." },
    cue: "Tuck your tailbone under, squeeze the buttock of the kneeling leg, then ease your hips forward.",
    howTo: {
      setup: "Kneel on one knee on a mat, rug or folded towel, with the other foot flat in front and that knee bent to a right angle. Hold a chair or wall for balance if you like.",
      steps: [
        "Stand tall through your body and tuck your tailbone under, as if tucking a tail between your legs.",
        "Squeeze the buttock on the kneeling side.",
        "Keeping that tuck, ease your hips forward a little until you feel a stretch at the front of the hip of the kneeling leg.",
        HOLD,
      ],
      cues: ["The stretch is at the front of the hip and top of the thigh on the kneeling side", "Ribs stay stacked over your hips", "A firm stretch you can breathe through, not pain"],
      mistakes: ["Arching your lower back and leaning back instead of tucking under", "Lunging far forward: the tuck matters more than the distance", "Bouncing"],
    },
  },
  {
    id: "standing_hip_flexor_stretch",
    name: "Standing hip-flexor stretch",
    kind: "hold",
    area: "Front of the hip",
    sided: true,
    sideLabel: "{Side} leg back",
    requires: [],
    avoidWith: [],
    ease: { low_back: "Keep your tailbone tucked the whole time and move your hips forward less." },
    cue: "Back heel up, tailbone tucked, squeeze the back leg's buttock and ease your hips forward.",
    howTo: {
      setup: "Stand in a long stride with one foot forward and the other back, feet hip-width apart like train tracks. Hold a wall or chair for balance. The back heel can come off the floor.",
      steps: [
        "Bend the front knee a little and keep the back leg long.",
        "Tuck your tailbone under and squeeze the buttock of the back leg.",
        "Ease your hips forward until you feel a stretch at the front of the back leg's hip.",
        HOLD,
      ],
      cues: ["Stretch at the front of the hip of the back leg", "Body upright, ribs over hips", "Weight shared between both feet"],
      mistakes: ["Arching your lower back", "Letting the back hip swing open to the side", "Bouncing"],
    },
  },
  {
    id: "figure_four",
    name: "Figure-four stretch",
    kind: "hold",
    area: "Back and outside of the hip",
    sided: true,
    sideLabel: "{Side} ankle crossed over",
    requires: [],
    avoidWith: [],
    ease: { knee: "Pull in less and keep the crossed knee where it's comfortable: the stretch belongs in the hip, never the knee." },
    cue: "Ankle over the other knee, then draw both legs toward you until the hip of the crossed leg stretches.",
    howTo: {
      setup: "Lie on your back on a mat, rug or carpet with both knees bent and feet flat. Cross one ankle over the other knee, so the crossed knee points out to the side.",
      steps: [
        "Lift the foot that's on the floor and reach through to hold behind that thigh with both hands.",
        "Draw both legs gently toward your chest until you feel a stretch in the buttock and outer hip of the crossed leg.",
        "Keep your head and shoulders resting on the floor.",
        HOLD,
      ],
      cues: ["Stretch deep in the buttock of the crossed leg", "Tailbone stays down on the floor", "Shoulders and neck relaxed"],
      mistakes: ["Pulling on the knee of the crossed leg", "Lifting your head or hips off the floor", "Pushing into pain in the knee: back off, or keep the bottom foot on the floor"],
    },
  },
  {
    id: "adductor_rock_back",
    name: "Adductor rock-back",
    kind: "reps",
    area: "Inner thigh",
    sided: true,
    sideLabel: "{Side} leg out",
    count: "rocks",
    countSec: 5,
    requires: [],
    avoidWith: [],
    ease: { wrist: FOREARMS, knee: "Put a folded towel or cushion under the knee you're kneeling on." },
    cue: "One leg straight out to the side, then sit your hips back toward your heel and return.",
    howTo: {
      setup: "Kneel on all fours on a mat, rug or carpet. Straighten one leg out to the side with its foot flat on the floor and toes pointing forward. The other knee stays under its hip.",
      steps: [
        "Keeping your back flat, sit your hips slowly back toward the heel of the kneeling leg.",
        "Go until you feel a stretch along the inner thigh of the straight leg.",
        "Pause for a second, then rock forward to the start.",
        "Do all your rocks on one side, then switch sides.",
      ],
      cues: ["Stretch along the inner thigh of the straight leg", "Back stays flat, not rounded", "Slow in both directions"],
      mistakes: ["Rounding your back to sit further", "Letting the straight leg's foot roll onto its inner edge", "Bouncing at the back of the movement"],
    },
  },
  {
    id: "deep_squat_hold",
    name: "Supported deep squat",
    kind: "hold",
    area: "Hips, inner thighs and ankles",
    sided: false,
    requires: [],
    avoidWith: ["knee"],
    ease: { low_back: "Stay a little higher and keep your chest up rather than letting your back round." },
    cue: "Hold something sturdy, sink as low as is comfortable with your heels down, and breathe.",
    howTo: {
      setup: "Stand facing something sturdy you can hold at about waist height: a door frame, a heavy table or a kitchen counter. Set your feet a little wider than your hips, toes turned out slightly.",
      steps: [
        "Holding on, sink down between your heels as low as is comfortable, keeping your heels on the floor.",
        "Let your hips relax downward and keep your chest up. Your hands are for balance, not for hanging.",
        "Gently press your knees out over your toes.",
        "Hold and breathe slowly, then use your hands to help you stand.",
      ],
      cues: ["Weight across the whole foot, heels down", "A stretch in the hips, inner thighs and ankles", "Chest lifted, long back"],
      mistakes: ["Heels lifting: stay higher, or put a rolled towel under them", "Knees collapsing inward", "Dropping down fast or bouncing at the bottom"],
    },
  },
  {
    id: "cossack_squat",
    name: "Side-to-side squat",
    kind: "reps",
    area: "Inner thigh and hip, under load",
    sided: false,
    count: "each side",
    countSec: 8,
    requires: [],
    avoidWith: ["knee"],
    gentler: "adductor_rock_back",
    cue: "Wide stance, sit toward one heel with the other leg straight, then glide across to the other side.",
    howTo: {
      setup: "Stand with your feet about twice shoulder-width apart, toes turned out slightly. Hold your hands in front of your chest, or hold a sturdy support for balance.",
      steps: [
        "Shift your weight over one foot and sit down toward that heel, bending that knee and keeping the heel on the floor.",
        "Let the other leg straighten, with its foot flat or its toes lifting.",
        "Go as low as is comfortable with your chest up, then push back to the middle.",
        "Do the same to the other side. That's one each side.",
      ],
      cues: ["Bending knee tracks over its toes", "A stretch along the inner thigh of the straight leg", "Chest up, heel of the bending leg down"],
      mistakes: ["Heel of the bending leg lifting", "Knee collapsing inward", "Going lower than you can control: depth comes with practice"],
    },
  },

  // ---------------- Spine, chest and legs ----------------
  {
    id: "cat_cow",
    name: "Cat-cow",
    kind: "reps",
    area: "Whole spine",
    sided: false,
    count: "rounds",
    countSec: 6,
    requires: [],
    avoidWith: [],
    ease: { wrist: FOREARMS, knee: "Put a folded towel or cushion under your knees.", low_back: "Keep the movement small and stay short of either end." },
    cue: "Round your whole back up, then let it sink and lift your chest, slowly.",
    howTo: {
      setup: "Kneel on all fours on a mat, rug or carpet, hands under your shoulders and knees under your hips.",
      steps: [
        "Breathe out and round your back up toward the ceiling, tucking your chin and tailbone.",
        "Breathe in and let your stomach sink, lifting your chest and tailbone.",
        "Move slowly from one to the other, one part of your spine at a time. That's one round.",
      ],
      cues: ["Movement spread along the whole spine", "Arms stay straight", "Your breath sets the pace"],
      mistakes: ["Rushing", "Bending the elbows instead of moving the spine", "Forcing the end of either direction"],
    },
  },
  {
    id: "open_book",
    name: "Open book",
    kind: "reps",
    area: "Upper back rotation",
    sided: true,
    sideLabel: "{Side} arm on top",
    countSec: 7,
    requires: [],
    avoidWith: [],
    ease: { shoulder: "Open only as far as the shoulder is comfortable, and bend the elbow if that's easier." },
    cue: "Knees stay stacked while the top arm opens across to the other side and your chest follows.",
    howTo: {
      setup: "Lie on your side on a mat, rug or carpet with your hips and knees bent to right angles, knees stacked. Rest your head on a cushion or your lower arm. Reach both arms straight out in front of your chest, palms together.",
      steps: [
        "Keeping your knees together and on the floor, lift the top arm up and over toward the floor behind you, like opening a book.",
        "Let your chest turn to follow the arm, and watch your hand as it goes.",
        "Pause for one breath where it stops comfortably.",
        "Close the book by bringing the arm back. Do all your reps on one side, then switch sides.",
      ],
      cues: ["Rotation through the upper back, between the shoulder blades", "Knees stay stacked and still", "Breathe out as you open"],
      mistakes: ["Letting the top knee slide back so your hips roll with you", "Forcing your hand to the floor", "Moving quickly"],
    },
  },
  {
    id: "chest_stretch",
    name: "Doorway chest stretch",
    kind: "hold",
    area: "Chest and front of the shoulder",
    sided: true,
    sideLabel: "{Side} arm",
    requires: [],
    avoidWith: [],
    ease: { shoulder: "Set your elbow lower than your shoulder and turn away less: stop well short of any pinch." },
    cue: "Forearm on the door frame, then turn your body away until the front of your chest stretches.",
    howTo: {
      setup: "Stand in a doorway or beside the end of a wall. Place one forearm against the frame with the elbow bent to a right angle and level with your shoulder.",
      steps: [
        "Step the foot on that side forward through the doorway.",
        "Keeping the forearm on the frame, turn your chest gently away from that arm until you feel a stretch across the front of the chest and shoulder.",
        "Keep your shoulder down, away from your ear.",
        HOLD,
      ],
      cues: ["Stretch across the chest, not a pinch in the shoulder joint", "Ribs down, no arching of the back", "Neck relaxed"],
      mistakes: ["Shrugging the shoulder up", "Leaning your whole weight into it", "Pushing through pain or tingling in the arm"],
    },
  },
  {
    id: "lying_hamstring_stretch",
    name: "Lying hamstring stretch",
    kind: "hold",
    area: "Back of the thigh",
    sided: true,
    sideLabel: "{Side} leg up",
    requires: [],
    avoidWith: [],
    ease: { low_back: "Keep the other knee bent with its foot flat on the floor." },
    skipIf: "Leave this one out if it brings on pain high in the back of the thigh or deep in the buttock, where the hamstring meets the sit bone. Stretching can aggravate a sore tendon there.",
    cue: "One leg up, hands behind the thigh, then straighten the knee until the back of the thigh stretches.",
    howTo: {
      setup: "Lie on your back on a mat, rug or carpet with both knees bent and feet flat. Lift one leg and hold behind its thigh with both hands, or loop a towel or belt around the foot.",
      steps: [
        "Keeping your hips on the floor, slowly straighten the lifted knee until you feel a stretch along the back of the thigh.",
        "The knee can stay a little bent: a stretch in the middle of the thigh matters more than a straight leg.",
        "Keep the other foot on the floor and your head and shoulders down.",
        HOLD,
      ],
      cues: ["Stretch in the middle of the back of the thigh", "Hips and lower back stay on the floor", "Shoulders and neck relaxed"],
      mistakes: ["Yanking the leg toward you", "Lifting your hips or head", "Chasing a stretch behind the knee by locking it straight"],
    },
  },
  {
    id: "lying_twist",
    name: "Lying twist",
    kind: "hold",
    area: "Middle of the back and outer hip",
    sided: true,
    sideLabel: "Knees to the {side}",
    requires: [],
    avoidWith: [],
    ease: { low_back: "Rest your knees on a cushion so they don't drop as far, and keep the twist small." },
    cue: "Both knees rest to one side while both shoulders stay down.",
    howTo: {
      setup: "Lie on your back on a mat, rug or carpet with your knees bent and feet flat. Stretch your arms out to the sides, palms up.",
      steps: [
        "Let both knees fall together to one side and rest there, on the floor or on a cushion.",
        "Keep both shoulders on the floor, and turn your head the other way if that's comfortable.",
        "Let the weight of your legs do the work: don't push them down.",
        HOLD,
      ],
      cues: ["A gentle twist through the middle of the back and outer hip", "Both shoulder blades stay down", "Long, slow breaths"],
      mistakes: ["Forcing the knees to the floor", "Letting the opposite shoulder lift", "Holding your breath"],
    },
  },
  {
    id: "calf_stretch",
    name: "Wall calf stretch",
    kind: "hold",
    area: "Calf",
    sided: true,
    sideLabel: "{Side} leg back",
    requires: [],
    avoidWith: [],
    cue: "Hands on the wall, back heel down and knee straight, then lean your hips forward.",
    howTo: {
      setup: "Stand facing a wall with your hands on it at chest height. Step one foot back about a stride, with the toes of both feet pointing straight at the wall.",
      steps: [
        "Press the back heel into the floor and keep that knee straight.",
        "Bend the front knee and lean your hips toward the wall until you feel a stretch in the calf of the back leg.",
        "Keep your body in one line from the back heel to your head.",
        HOLD,
      ],
      cues: ["Stretch in the upper calf of the back leg", "Back heel stays down", "Back foot points straight ahead"],
      mistakes: ["Back foot turning out", "Heel lifting", "Bending at the waist instead of leaning your whole body"],
    },
  },
];

const drillById = new Map(DRILLS.map((d) => [d.id, d]));

/** The drill with this id, or undefined if mobility no longer has it. */
export function findDrill(id: string): Drill | undefined {
  return drillById.get(id);
}

/** A drill's label for one side: "Left knee down". */
export function sideLabel(drill: Pick<Drill, "sideLabel">, side: "left" | "right"): string {
  const title = side === "left" ? "Left" : "Right";
  return (drill.sideLabel ?? "{Side} side").replace("{Side}", title).replace("{side}", side);
}

/**
 * Light strength exercises routines borrow from the library, with the one line shown while doing
 * them and, for one-sided ones, which side is which. Their how-to is the library's own.
 */
export const BORROWED: Record<string, { cue: string; sideLabel?: string }> = {
  glute_bridge: { cue: "Drive through your heels to lift your hips, squeeze for a second at the top, then lower slowly." },
  single_leg_glute_bridge: { cue: "One foot planted: lift your hips level, squeeze for a second at the top, then lower slowly.", sideLabel: "{Side} foot down" },
  side_lying_hip_abduction: { cue: "Top leg lifts a little behind you with the toes pointing forward, then lowers slowly.", sideLabel: "{Side} leg on top" },
};

/** One line of a routine: a drill, or a light strength exercise from the library, and how much of it. */
export interface RoutineItem {
  /** Drill or library exercise ids, best first: the first one the person can do is used. */
  options: string[];
  /** Sets (each side, for one-sided work). */
  sets: number;
  /** Seconds for a hold; reps (or counts) otherwise. */
  amount: number;
}

export interface RoutineLevel {
  name: string;
  /** What changes at this level, in a few words. */
  note: string;
  items: RoutineItem[];
}

export interface Routine {
  id: string;
  /** Raised whenever the drills or amounts change, so a saved session says what it was built from. */
  version: number;
  name: string;
  /** A word for it in passing: "Start hips session". */
  short: string;
  /** "block": a run of sessions over some weeks, with a review at the end. "quick": a one-off, any time. */
  kind: "block" | "quick";
  /** One line under the name. */
  summary: string;
  /** When it suits, in a sentence. */
  when: string;
  /** Easiest first. A quick session has one level. */
  levels: RoutineLevel[];
  /** Blocks only: sessions a week, and how many weeks. */
  perWeek?: number;
  weeks?: number;
}

const item = (options: string | string[], sets: number, amount: number): RoutineItem => ({ options: typeof options === "string" ? [options] : options, sets, amount });

export const ROUTINES: Routine[] = [
  {
    id: "hips",
    version: 1,
    name: "Hips: mobility and strength",
    short: "Hips",
    kind: "block",
    summary: "Six weeks of regular practice for your hips: held stretches for flexibility, slow drills for control and a little strength work.",
    when: "Three sessions a week, after a workout or on a day off.",
    perWeek: 3,
    weeks: 6,
    levels: [
      {
        name: "Find the positions",
        note: "30-second holds and a few slow reps of each drill.",
        items: [
          item("hip_circles", 1, 4),
          item("ninety_ninety", 1, 8),
          item("hip_flexor_stretch", 2, 30),
          item("figure_four", 2, 30),
          item("adductor_rock_back", 1, 8),
          item("glute_bridge", 2, 10),
        ],
      },
      {
        name: "Longer holds",
        note: "45-second holds, for more total time in each stretch, and side-lying leg raises for the outside of the hip.",
        items: [
          item("hip_circles", 1, 5),
          item("ninety_ninety", 1, 10),
          item("hip_flexor_stretch", 2, 45),
          item("figure_four", 2, 45),
          item("adductor_rock_back", 1, 8),
          item("side_lying_hip_abduction", 2, 10),
        ],
      },
      {
        name: "Strength at the end of your range",
        note: "The same holds, plus squats that practise using your range.",
        items: [
          item("hip_circles", 1, 5),
          item("ninety_ninety", 1, 10),
          item("hip_flexor_stretch", 2, 45),
          item("figure_four", 2, 45),
          item("cossack_squat", 1, 6),
          item("deep_squat_hold", 2, 30),
          item("single_leg_glute_bridge", 2, 8),
        ],
      },
    ],
  },
  {
    id: "morning",
    version: 1,
    name: "Morning mobility",
    short: "Morning",
    kind: "quick",
    summary: "Slow, easy movement for your back and hips.",
    when: "First thing, or any time you feel stiff.",
    levels: [
      {
        name: "Morning mobility",
        note: "",
        items: [item("cat_cow", 1, 8), item("open_book", 1, 6), item("lying_knee_drops", 1, 8), item("hip_circles", 1, 4), item("deep_squat_hold", 1, 30)],
      },
    ],
  },
  {
    id: "desk",
    version: 1,
    name: "Desk-day reset",
    short: "Desk-day",
    kind: "quick",
    summary: "For the hips, chest and upper back after a long day of sitting.",
    when: "After work, or as a break in the middle of the day.",
    levels: [
      {
        name: "Desk-day reset",
        note: "",
        items: [item("hip_flexor_stretch", 1, 45), item("figure_four", 1, 45), item("open_book", 1, 6), item("chest_stretch", 1, 30), item("glute_bridge", 1, 12)],
      },
    ],
  },
  {
    id: "winddown",
    version: 1,
    name: "Wind-down stretch",
    short: "Wind-down",
    kind: "quick",
    summary: "Calm, whole-body stretching with longer holds.",
    when: "In the evening, or after a workout. Better after lifting than right before it.",
    levels: [
      {
        name: "Wind-down stretch",
        note: "",
        items: [
          item("hip_flexor_stretch", 1, 45),
          item("figure_four", 1, 45),
          item("lying_hamstring_stretch", 1, 45),
          item("lying_twist", 1, 45),
          item("chest_stretch", 1, 30),
          item("calf_stretch", 1, 30),
        ],
      },
    ],
  },
];

const routineById = new Map(ROUTINES.map((r) => [r.id, r]));

/** The routine with this id, or undefined if mobility no longer has it. */
export function findRoutine(id: string): Routine | undefined {
  return routineById.get(id);
}

/** Sessions in a block from start to review. */
export function blockSessions(r: Routine): number {
  return (r.perWeek ?? 0) * (r.weeks ?? 0);
}

/** One thing mobility work does or doesn't do, with the sources (see MOBILITY_SOURCES) it rests on. */
export interface MobilityFact {
  text: string;
  sources: string[];
}

/**
 * What to expect from stretching and mobility work, said plainly: what studies support, what they
 * don't, what isn't settled, and when to take care. docs/EVIDENCE.md section 16 has the numbers
 * and says how each source was read.
 */
export const MOBILITY_FACTS: { does: MobilityFact[]; doesnt: MobilityFact[]; unsure: MobilityFact[]; care: MobilityFact[] } = {
  does: [
    { text: "Stretching regularly for several weeks improves flexibility. People who start out stiffer tend to gain more.", sources: ["M01", "M02"] },
    {
      text: "Holding a stretch for about 30 seconds and repeating it is enough. In younger adults 60-second holds did no better, though in one trial of people over 65 they did. What adds up is the total time a muscle gets each week.",
      sources: ["M03", "M04", "M05", "M02"],
    },
    { text: "A firm pull or mild discomfort is the right amount. Pushing into pain hasn't been shown to work better.", sources: ["M06", "M01", "M02"] },
    {
      text: "Lifting through a full range of motion improves flexibility too, about as much as stretching in studies so far. Where your workouts already take a joint through its range, extra stretching is optional.",
      sources: ["M07", "M08"],
    },
  ],
  doesnt: [
    { text: "It hasn't been shown to lower your overall risk of injury.", sources: ["M09", "M10"] },
    { text: "It doesn't meaningfully reduce next-day soreness or speed up recovery.", sources: ["M11", "M12", "M10"] },
    { text: "It doesn't change your posture.", sources: ["M13", "M10"] },
    { text: "One session doesn't last. The extra range after a single session is small and fades within about half an hour: lasting change takes weeks of regular sessions.", sources: ["M14"] },
    { text: "It isn't permanent. Some of the range goes within a few weeks of stopping, though usually not all of it.", sources: ["M15"] },
    {
      text: "Long holds aren't a warm-up for heavy lifting. A minute or more per muscle right before it can take a little off your strength for a short while, so these sessions go after a workout or on another day. Short stretches inside a warm-up are fine.",
      sources: ["M16", "M14", "M10"],
    },
  ],
  unsure: [
    {
      text: "How often is best. An expert panel recommends stretching daily for the most range, while the two largest analyses found that the number of days a week made no difference, and three days matched five in one small trial. These sessions give each stretch a few minutes a week: enough to work in studies, not the most you could do.",
      sources: ["M10", "M01", "M02", "M17"],
    },
    {
      text: "Slow mobility drills, such as hip circles and 90/90 switches. They practise moving a joint through its range under control, but whether they add range over weeks has barely been studied. Held stretches have the stronger evidence.",
      sources: ["M01"],
    },
    {
      text: "Whether more range changes how you move. In the one study that tested it, more hip flexibility didn't carry over to squats and lunges by itself. Using new range in a movement looks like its own practice, which is what the last level of the hips block is for.",
      sources: ["M18"],
    },
  ],
  care: [
    {
      text: "Leave out a drill for any area that's recently injured or swollen, or that gives sharp, pinching or joint pain, numbness or tingling. Get it checked if it keeps happening.",
      sources: ["M19"],
    },
    { text: "Ease into each stretch and hold it still. Don't bounce.", sources: ["M20"] },
    { text: "If your joints are already very flexible (hypermobile), or you have a joint condition, ask a clinician before stretching to the end of your range.", sources: ["M21"] },
  ],
};

/**
 * The papers and guidance pages behind MOBILITY_FACTS. Kept apart from the exercise catalog's
 * SOURCES, which are generated. `finding` is what the source reports; `limit` is how far it goes.
 */
export const MOBILITY_SOURCES: Source[] = [
  {
    id: "M01",
    year: 2024,
    authors: "Konrad et al.",
    title: "Chronic effects of stretching on range of motion with consideration of potential moderating variables: A systematic review with meta-analysis",
    journal: "Journal of Sport and Health Science 13(2):186-194",
    doi: "10.1016/j.jshs.2023.06.002",
    url: "https://pubmed.ncbi.nlm.nih.gov/37301370/",
    finding: "Across 77 studies of at least two weeks, stretch training increased range of motion. Static and PNF stretching gained more than ballistic or dynamic stretching; volume, intensity and frequency made no clear difference.",
    limit: "Comparisons between studies of healthy people. The authors call the pooled effect moderate.",
  },
  {
    id: "M02",
    year: 2025,
    authors: "Ingram et al.",
    title: "Optimising the Dose of Static Stretching to Improve Flexibility: A Systematic Review, Meta-analysis and Multivariate Meta-regression",
    journal: "Sports Medicine 55(3):597-617",
    doi: "10.1007/s40279-024-02143-9",
    url: "https://pubmed.ncbi.nlm.nih.gov/39614059/",
    finding: "Across 189 studies, static stretching improved flexibility, more so in adults who began with poor flexibility. Gains levelled off as stretching time rose, and intensity, weekly frequency and programme length made no difference.",
    limit: "Mostly young adults. Where the gains level off is an estimate from comparing studies.",
  },
  {
    id: "M03",
    year: 1994,
    authors: "Bandy and Irion",
    title: "The effect of time on static stretch on the flexibility of the hamstring muscles",
    journal: "Physical Therapy 74(9):845-850",
    doi: "10.1093/ptj/74.9.845",
    url: "https://pubmed.ncbi.nlm.nih.gov/8066111/",
    finding: "In 57 adults with tight hamstrings, 30-second and 60-second holds improved flexibility more than 15-second holds or none, and did not differ from each other.",
    limit: "One muscle group, in adults aged 21 to 37.",
  },
  {
    id: "M04",
    year: 1997,
    authors: "Bandy, Irion and Briggler",
    title: "The effect of time and frequency of static stretching on flexibility of the hamstring muscles",
    journal: "Physical Therapy 77(10):1090-1096",
    doi: "10.1093/ptj/77.10.1090",
    url: "https://pubmed.ncbi.nlm.nih.gov/9327823/",
    finding: "In 93 adults stretching five days a week for six weeks, 60-second holds did no better than 30-second holds, and three times a day no better than once.",
    limit: "Hamstrings only, in adults aged 21 to 39.",
  },
  {
    id: "M05",
    year: 2001,
    authors: "Feland et al.",
    title: "The effect of duration of stretching of the hamstring muscle group for increasing range of motion in people aged 65 years or older",
    journal: "Physical Therapy 81(5):1110-1117",
    url: "https://pubmed.ncbi.nlm.nih.gov/11319936/",
    finding: "In 62 people aged 65 to 97, 60-second holds improved range of motion faster than 30-second or 15-second holds.",
    limit: "The one trial here where longer holds did better, and in much older adults.",
  },
  {
    id: "M06",
    year: 2017,
    authors: "Muanjai et al.",
    title: "The acute benefits and risks of passive stretching to the point of pain",
    journal: "European Journal of Applied Physiology 117(6):1217-1226",
    doi: "10.1007/s00421-017-3608-y",
    url: "https://link.springer.com/doi/10.1007/s00421-017-3608-y",
    finding: "In 22 active women, stretching to the point of pain had no advantage over stretching to the point of discomfort.",
    limit: "One session, one muscle group. Small trials of intensity point both ways; the large analyses found it made no difference.",
  },
  {
    id: "M07",
    year: 2023,
    authors: "Alizadeh et al.",
    title: "Resistance Training Induces Improvements in Range of Motion: A Systematic Review and Meta-Analysis",
    journal: "Sports Medicine 53(3):707-722",
    doi: "10.1007/s40279-022-01804-x",
    url: "https://pubmed.ncbi.nlm.nih.gov/36622555/",
    finding: "Across 55 studies, resistance training with external loads increased range of motion, with no significant difference from stretch training. Bodyweight-only training did not show the gain.",
    limit: "No significant difference is not proof that the two are equal. It is also why the bodyweight strength work in these sessions isn't counted on for flexibility.",
  },
  {
    id: "M08",
    year: 2021,
    authors: "Afonso et al.",
    title: "Strength Training versus Stretching for Improving Range of Motion: A Systematic Review and Meta-Analysis",
    journal: "Healthcare 9(4):427",
    doi: "10.3390/healthcare9040427",
    url: "https://pubmed.ncbi.nlm.nih.gov/33917036/",
    finding: "Eleven trials comparing the two directly found no difference in the range of motion gained.",
    limit: "Few, small and varied trials: a moderate difference either way can't be ruled out.",
  },
  {
    id: "M09",
    year: 2014,
    authors: "Lauersen, Bertelsen and Andersen",
    title: "The effectiveness of exercise interventions to prevent sports injuries: a systematic review and meta-analysis of randomised controlled trials",
    journal: "British Journal of Sports Medicine 48(11):871-877",
    doi: "10.1136/bjsports-2013-092538",
    url: "https://pubmed.ncbi.nlm.nih.gov/24100287/",
    finding: "In 25 trials with 26,610 people, stretching showed no protective effect on sports injuries, while strength training cut them to less than a third.",
    limit: "All injuries together. Whether stretching lowers muscle strains in particular is still argued over.",
  },
  {
    id: "M10",
    year: 2025,
    authors: "Warneke et al.",
    title: "Practical recommendations on stretching exercise: A Delphi consensus statement of international research experts",
    journal: "Journal of Sport and Health Science 14:101067",
    doi: "10.1016/j.jshs.2025.101067",
    url: "https://pubmed.ncbi.nlm.nih.gov/40513717/",
    finding: "Twenty researchers agreed that stretching builds range of motion, and that it does not work as general injury prevention, improve posture or speed recovery after exercise. For the most range they recommend stretching daily, and they advise against static stretching right before maximal or explosive efforts unless it is short and part of a dynamic warm-up.",
    limit: "Expert agreement built on existing reviews, not new data.",
  },
  {
    id: "M11",
    year: 2011,
    authors: "Herbert, de Noronha and Kamper",
    title: "Stretching to prevent or reduce muscle soreness after exercise",
    journal: "Cochrane Database of Systematic Reviews (7):CD004577",
    doi: "10.1002/14651858.CD004577.pub3",
    url: "https://www.cochrane.org/CD004577/MUSKEL_stretching-to-prevent-or-reduce-muscle-soreness-after-exercise",
    finding: "In 12 trials, stretching before or after exercise changed next-day soreness by about one point or less on a 100-point scale.",
    limit: "One large trial found slightly less bothersome soreness with stretching; the review judged the effect too small to matter.",
  },
  {
    id: "M12",
    year: 2021,
    authors: "Afonso et al.",
    title: "The Effectiveness of Post-exercise Stretching in Short-Term and Delayed Recovery of Strength, Range of Motion and Delayed Onset Muscle Soreness: A Systematic Review and Meta-Analysis of Randomized Controlled Trials",
    journal: "Frontiers in Physiology 12:677581",
    doi: "10.3389/fphys.2021.677581",
    url: "https://www.frontiersin.org/articles/10.3389/fphys.2021.677581/full",
    finding: "Eleven trials found no effect of stretching after exercise on soreness one to three days later, or on how fast strength came back.",
    limit: "Small trials, mostly of young men. The authors rate their confidence in the evidence as very low.",
  },
  {
    id: "M13",
    year: 2024,
    authors: "Warneke et al.",
    title: "Effects of Stretching or Strengthening Exercise on Spinal and Lumbopelvic Posture: A Systematic Review with Meta-Analysis",
    journal: "Sports Medicine - Open",
    doi: "10.1186/s40798-024-00733-5",
    url: "https://pubmed.ncbi.nlm.nih.gov/38834878/",
    finding: "Across 23 studies, stretching did not change posture, after one session or after weeks of it.",
    limit: "Posture of the spine and pelvis only.",
  },
  {
    id: "M14",
    year: 2016,
    authors: "Behm, Blazevich, Kay and McHugh",
    title: "Acute effects of muscle stretching on physical performance, range of motion, and injury incidence in healthy active individuals: a systematic review",
    journal: "Applied Physiology, Nutrition, and Metabolism 41(1):1-11",
    doi: "10.1139/apnm-2015-0235",
    url: "https://cdnsciencepub.com/doi/10.1139/apnm-2015-0235",
    finding: "One bout of stretching improved range of motion for typically under 30 minutes. Static holds of a minute or more per muscle lowered performance tested straight afterwards by about 5%, and shorter holds by about 1%.",
    limit: "No clear effect was seen when dynamic activity followed the stretching.",
  },
  {
    id: "M15",
    year: 2025,
    authors: "Konrad et al.",
    title: "Detraining Effects Following Chronic Stretching Training on Range of Motion: A Systematic Review and Meta-Analysis",
    journal: "Sports Medicine - Open 11:141",
    doi: "10.1186/s40798-025-00935-5",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC12638565/",
    finding: "In 13 studies, range of motion dropped a little in the two to six weeks after people stopped stretching, but stayed above where they began.",
    limit: "Single trials range from losing everything in four weeks to keeping most of it.",
  },
  {
    id: "M16",
    year: 2012,
    authors: "Kay and Blazevich",
    title: "Effect of acute static stretch on maximal muscle performance: a systematic review",
    journal: "Medicine & Science in Sports & Exercise 44(1):154-164",
    url: "https://pubmed.ncbi.nlm.nih.gov/21659901/",
    finding: "Across 106 articles, static stretching of under 45 seconds in total did not meaningfully lower strength, power or speed straight afterwards. A minute or more was likely to.",
    limit: "Measured within minutes of stretching, usually with no warm-up in between.",
  },
  {
    id: "M17",
    year: 2009,
    authors: "Marques et al.",
    title: "Effect of frequency of static stretching on flexibility, hamstring tightness and electromyographic activity",
    journal: "Brazilian Journal of Medical and Biological Research 42(10):949-953",
    url: "https://www.scielo.br/j/bjmbr/a/HVYYgp6qkJWw3wfzRjy96yh/?lang=en",
    finding: "In 31 adults, stretching three times a week improved flexibility more than once a week, and as much as five times a week.",
    limit: "One small trial of the hamstrings.",
  },
  {
    id: "M18",
    year: 2013,
    authors: "Moreside and McGill",
    title: "Improvements in hip flexibility do not transfer to mobility in functional movement patterns",
    journal: "Journal of Strength and Conditioning Research 27(10):2635-2643",
    url: "https://search.pedro.org.au/search-results/record-detail/37166",
    finding: "After six weeks that improved hip range of motion in young men, they used no more of it in squats, lunges and other movements.",
    limit: "One small study, read through a database summary.",
  },
  {
    id: "M19",
    year: 2026,
    authors: "American Heart Association",
    title: "Flexibility Exercise (Stretching)",
    journal: "heart.org guidance, read November 2026",
    url: "https://www.heart.org/en/healthy-living/fitness/fitness-basics/flexibility-exercise-stretching",
    finding: "A mild pulling feeling during a stretch is normal. Sharp or stabbing pain, or pain in a joint, means stop.",
    limit: "Professional guidance, not a trial. No trial-based list of who shouldn't stretch exists for healthy adults.",
  },
  {
    id: "M20",
    year: 2026,
    authors: "American Academy of Orthopaedic Surgeons",
    title: "Warm Up, Cool Down and Be Flexible",
    journal: "OrthoInfo guidance, read November 2026",
    url: "https://orthoinfo.aaos.org/en/staying-healthy/warm-up-cool-down-and-be-flexible",
    finding: "Don't bounce in a stretch: bouncy stretching can cause injury.",
    limit: "Professional guidance, not a trial.",
  },
  {
    id: "M21",
    year: 2026,
    authors: "The Ehlers-Danlos Society",
    title: "Physical Therapy",
    journal: "ehlers-danlos.com guidance, read November 2026",
    url: "https://www.ehlers-danlos.com/physical-therapy/",
    finding: "Lists repeated or excessive stretching among the things that can add to joint instability in hypermobile people.",
    limit: "A patient organisation's guidance for one condition, not a trial.",
  },
];
