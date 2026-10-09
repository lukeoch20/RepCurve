/**
 * How to perform each exercise: setup, steps, what to feel for, and the usual mistakes.
 * Plain language for people training alone at home. General guidance, not medical advice.
 */
export interface HowTo {
  /** Getting into position, including what to hold and where. */
  setup: string;
  /** One rep, in order. */
  steps: string[];
  /** What good form feels like. */
  cues: string[];
  /** Common mistakes to avoid. */
  mistakes: string[];
}

const SWITCH = "Do all your reps on one side, then switch sides. That's one set.";

export const HOW_TO: Record<string, HowTo> = {
  // ---------------- Squat ----------------
  goblet_squat: {
    setup: "Stand with feet about shoulder-width apart, toes turned out slightly. Hold one dumbbell upright against your chest with both hands cupping the top end.",
    steps: [
      "Breathe in and brace your stomach as if about to be poked.",
      "Sit down between your heels, letting your knees travel forward over your toes.",
      "Go as low as you can while keeping your chest up and heels on the floor; elbows end up between your knees.",
      "Push the floor away to stand back up, breathing out near the top.",
    ],
    cues: ["Weight spread across the whole foot", "Knees follow the line of your toes", "Dumbbell stays touching your chest"],
    mistakes: ["Heels lifting off the floor", "Knees caving inward", "Rounding the back to get lower"],
  },
  db_front_squat: {
    setup: "Stand with feet shoulder-width apart. Hold a dumbbell in each hand and rest one end of each on the front of your shoulders, elbows pointing forward.",
    steps: [
      "Brace your stomach and keep your elbows high.",
      "Sit down between your heels, keeping your chest tall.",
      "Lower until your thighs are about level with the floor, or as deep as you can with heels down.",
      "Drive through the whole foot to stand up.",
    ],
    cues: ["Elbows stay up so the dumbbells don't roll forward", "Upright torso", "Knees track over toes"],
    mistakes: ["Elbows dropping and the chest folding forward", "Bouncing out of the bottom", "Heels lifting"],
  },
  db_reverse_lunge: {
    setup: "Stand tall with feet hip-width apart, a dumbbell in each hand at your sides.",
    steps: [
      "Take a long step back with one foot, landing on the ball of that foot.",
      "Lower straight down until your back knee nearly touches the floor; most of your weight stays on the front foot.",
      "Push through the front heel to bring the back foot forward and stand tall.",
      SWITCH,
    ],
    cues: ["Front shin roughly upright", "Hips square to the front", "Slight forward lean of the torso is fine"],
    mistakes: ["Stepping back too short so the front knee shoots far forward", "Pushing off mainly with the back leg", "Wobbling: slow down, or do it with no dumbbells and one hand on a wall until it feels steady"],
  },
  db_bulgarian_split_squat: {
    setup: "Stand about two feet in front of a bench or sturdy chair, facing away from it. Rest the top of one foot on it behind you. Hold a dumbbell in each hand.",
    steps: [
      "Keep most of your weight on the front foot.",
      "Lower straight down until your front thigh is about level with the floor and the back knee is close to the ground.",
      "Drive through the front heel to stand back up.",
      SWITCH,
    ],
    cues: ["Front shin close to vertical or slightly forward", "Torso tall or leaning slightly forward", "Back leg is just for balance"],
    mistakes: ["Front foot too close to the bench, cramping the knee", "Pushing off the back foot", "Letting the front knee cave inward"],
  },
  bodyweight_squat: {
    setup: "Stand with feet shoulder-width apart, toes turned out slightly, arms out in front for balance.",
    steps: [
      "Breathe in and brace your stomach.",
      "Sit your hips down and back between your heels.",
      "Go as low as you comfortably can with your heels down and chest up.",
      "Stand back up by pushing the floor away.",
    ],
    cues: ["Weight across the whole foot", "Knees follow the toes", "Control the way down"],
    mistakes: ["Heels lifting", "Knees caving in", "Dropping fast and bouncing"],
  },
  bw_split_squat: {
    setup: "Take a long stride: one foot forward, the other back on the ball of the foot, both feet hip-width apart like train tracks. Hands on hips or holding a wall for balance.",
    steps: [
      "Lower straight down by bending both knees until the back knee nearly touches the floor.",
      "Keep most of your weight on the front foot.",
      "Push through the front heel to rise back up, staying in the split stance.",
      SWITCH,
    ],
    cues: ["Torso tall", "Front knee over the middle of the foot", "Straight up and down, like an elevator"],
    mistakes: ["Feet in a straight line (tightrope), which makes balancing hard", "Leaning onto the back leg", "Rushing the descent"],
  },
  bw_reverse_lunge: {
    setup: "Stand tall with feet hip-width apart, hands on hips.",
    steps: [
      "Step one foot back and lower until the back knee nearly touches the floor.",
      "Keep your weight on the front foot.",
      "Push through the front heel to return to standing.",
      SWITCH,
    ],
    cues: ["Long step back", "Front shin roughly upright", "Stand all the way up between reps"],
    mistakes: ["Short steps that push the front knee far forward", "Slamming the back knee down", "Twisting the hips"],
  },
  bw_bulgarian_split_squat: {
    setup: "Stand about two feet in front of a bench or sturdy chair, facing away. Rest the top of one foot on it behind you. Hands on hips.",
    steps: [
      "Lower straight down until your front thigh is about level with the floor.",
      "Keep most of your weight on the front foot.",
      "Drive through the front heel to stand back up.",
      SWITCH,
    ],
    cues: ["Front shin close to vertical", "Slow on the way down", "Back leg only balances"],
    mistakes: ["Front foot too close to the bench", "Pushing with the back leg", "Knee caving inward"],
  },

  // ---------------- Hinge ----------------
  db_rdl: {
    setup: "Stand with feet hip-width apart, a dumbbell in each hand in front of your thighs, palms facing you.",
    steps: [
      "Unlock your knees slightly and keep them there.",
      "Push your hips back as if closing a car door with your bottom, letting the dumbbells slide down the front of your legs.",
      "Stop when you feel a strong stretch in the backs of your thighs, usually around mid-shin, with your back still flat.",
      "Drive your hips forward to stand tall and squeeze your glutes at the top.",
    ],
    cues: ["Flat back from head to hips", "Dumbbells stay close to your legs", "The movement is at the hips, not the knees"],
    mistakes: ["Rounding the back to reach lower", "Bending the knees into a squat", "Leaning back at the top"],
  },
  db_staggered_rdl: {
    setup: "Stand with one foot slightly behind the other, back foot up on its toes for balance; most weight on the front leg. A dumbbell in each hand in front of your thighs.",
    steps: [
      "Soften the front knee.",
      "Push your hips back and lower the dumbbells along the front leg with a flat back.",
      "Stop at a strong stretch in the back of the front thigh.",
      "Drive the hips forward to stand tall.",
      SWITCH,
    ],
    cues: ["Front leg does the work, back foot just balances", "Hips stay level", "Dumbbells close to the leg"],
    mistakes: ["Putting weight on the back foot", "Rounding the back", "Twisting the hips open"],
  },
  db_single_leg_rdl: {
    setup: "Stand on one leg with a slight bend in the knee, holding a dumbbell in the opposite hand. Use a wall or chair with your free hand if you need balance.",
    steps: [
      "Hinge forward at the hips as the free leg reaches straight back behind you.",
      "Lower the dumbbell toward the floor along the standing leg, back flat.",
      "Stop when your torso and back leg are close to level with the floor, or at a strong hamstring stretch.",
      "Squeeze the glute of the standing leg to return upright.",
      SWITCH,
    ],
    cues: ["Body moves like a seesaw, head to back heel in one line", "Hips square to the floor", "Slow and controlled"],
    mistakes: ["Opening the hip so the back leg turns out", "Rounding the back", "Rushing and losing balance; holding a support is fine"],
  },
  glute_bridge: {
    setup: "Lie on your back with knees bent, feet flat and hip-width apart, heels about a hand's length from your bottom. Arms by your sides.",
    steps: [
      "Breathe out and gently tuck your pelvis so your lower back flattens.",
      "Drive through your heels to lift your hips until your body is straight from shoulders to knees.",
      "Squeeze your glutes hard for a second at the top.",
      "Lower slowly back down.",
    ],
    cues: ["Push through the heels", "Ribs down", "Feel it in the glutes, not the lower back"],
    mistakes: ["Arching the lower back at the top", "Feet too far away, which shifts work to the hamstrings", "Bouncing off the floor"],
  },
  single_leg_glute_bridge: {
    setup: "Lie on your back, knees bent, feet flat. Lift one foot and hug that knee toward your chest or hold the leg straight up.",
    steps: [
      "Drive through the heel of the planted foot to lift your hips.",
      "Rise until your body is straight from shoulder to knee, hips level.",
      "Squeeze the glute at the top for a second.",
      "Lower slowly.",
      SWITCH,
    ],
    cues: ["Hips stay level, not tilting to one side", "Heel pressure", "Ribs down"],
    mistakes: ["Arching the lower back", "Letting one hip drop", "Pushing off the raised leg's momentum"],
  },
  single_leg_hip_thrust: {
    setup: "Sit on the floor with your upper back against the edge of a couch or sturdy chair. One foot planted, the other lifted.",
    steps: [
      "Tuck your chin slightly and brace.",
      "Drive through the planted heel to lift your hips until your thigh and torso form a straight line.",
      "Squeeze the glute at the top.",
      "Lower under control until your bottom nearly touches the floor.",
      SWITCH,
    ],
    cues: ["Upper back pivots on the couch edge", "Shin roughly vertical at the top", "Hips level"],
    mistakes: ["Arching the lower back to get higher", "Furniture sliding: brace it against a wall", "Letting the hips rotate"],
  },
  db_glute_bridge: {
    setup: "Lie on your back with knees bent and feet flat, hip-width apart. Rest a dumbbell across your hip bones and hold it steady with both hands.",
    steps: [
      "Tuck your pelvis slightly and brace.",
      "Drive through your heels to lift your hips until your body is straight from shoulders to knees.",
      "Squeeze your glutes hard at the top.",
      "Lower slowly.",
    ],
    cues: ["Heels do the pushing", "Ribs down at the top", "Dumbbell stays put on the hips"],
    mistakes: ["Overarching the lower back", "Rushing the reps", "Dumbbell digging in: use a folded towel underneath"],
  },
  db_hip_thrust: {
    setup: "Sit on the floor with your upper back (just below the shoulder blades) against a bench or couch edge. Feet flat, hip-width apart. Rest a dumbbell across your hips, held with both hands.",
    steps: [
      "Tuck your chin and brace your stomach.",
      "Drive through your heels to lift your hips until your thighs are level with your torso.",
      "Squeeze your glutes at the top for a second.",
      "Lower under control.",
    ],
    cues: ["Shins vertical at the top", "Eyes look forward, not up at the ceiling", "Ribs stay down"],
    mistakes: ["Arching the lower back to finish the rep", "Bench or couch sliding: brace it against a wall", "Feet too close or too far"],
  },

  // ---------------- Horizontal push ----------------
  incline_push_up: {
    setup: "Place your hands slightly wider than your shoulders on a sturdy counter, table edge or the back of a couch. Walk your feet back until your body is a straight line.",
    steps: [
      "Brace your stomach and squeeze your glutes.",
      "Bend your elbows to lower your chest toward the surface, elbows angled back about 45°.",
      "Touch or nearly touch with your chest.",
      "Push the surface away to straighten your arms.",
    ],
    cues: ["Body moves as one plank", "Elbows angled back, not flared straight out", "Lower surface = harder"],
    mistakes: ["Hips sagging or piking up", "Half reps", "Using something that can slide or tip"],
  },
  knee_push_up: {
    setup: "Kneel on a mat, rug or folded towel with hands slightly wider than your shoulders. Walk your hands forward until your body is straight from knees to head.",
    steps: [
      "Brace your stomach.",
      "Lower your chest toward the floor, elbows angled back about 45°.",
      "Go until your chest is a few centimetres from the floor.",
      "Push back up to straight arms.",
    ],
    cues: ["Straight line from knees to head", "Chest leads, not the chin", "Full range each rep"],
    mistakes: ["Bending at the hips", "Elbows flaring straight out", "Dropping the head"],
  },
  push_up: {
    setup: "Hands on the floor slightly wider than your shoulders, legs straight behind you on your toes. Body in one straight line from head to heels.",
    steps: [
      "Brace your stomach and squeeze your glutes.",
      "Lower your chest toward the floor, elbows angled back about 45°.",
      "Go until your chest nearly touches the floor.",
      "Push the floor away to straight arms.",
    ],
    cues: ["Rigid plank throughout", "Hands under or just outside your shoulders", "Full range of motion"],
    mistakes: ["Hips sagging", "Elbows flaring out to the sides", "Only going halfway down"],
  },
  feet_elevated_push_up: {
    setup: "Feet on a bench, step or sturdy chair, hands on the floor slightly wider than your shoulders. Body straight from head to heels.",
    steps: [
      "Brace your stomach and squeeze your glutes.",
      "Lower your chest toward the floor, elbows angled back about 45°.",
      "Go until your chest or chin nearly touches the floor.",
      "Push back up to straight arms.",
    ],
    cues: ["Higher feet = harder and more shoulder work", "Plank stays rigid", "Controlled descent"],
    mistakes: ["Hips sagging", "Piking hips up to make it easier", "Chair or step sliding"],
  },
  db_floor_press: {
    setup: "Lie on your back with knees bent and feet flat. Hold a dumbbell in each hand above your chest, arms straight, palms facing your feet or each other.",
    steps: [
      "Lower the dumbbells by bending your elbows, upper arms about 45° from your body.",
      "Let your upper arms touch the floor lightly; pause briefly.",
      "Press the dumbbells back up over your chest.",
    ],
    cues: ["Wrists stacked over elbows", "Gentle touch, no bouncing off the floor", "Shoulder blades pulled down and back"],
    mistakes: ["Elbows flaring straight out", "Slamming the elbows down", "Dumbbells drifting toward your face"],
  },
  db_bench_press: {
    setup: "Lie on your back on a flat bench with feet flat on the floor (a chair or step isn't safe for this; use the floor press instead). Hold a dumbbell in each hand above your chest, arms straight.",
    steps: [
      "Squeeze your shoulder blades together and down.",
      "Lower the dumbbells to the sides of your chest, elbows about 45° from your body.",
      "Go until you feel a gentle stretch across the chest.",
      "Press back up until your arms are straight.",
    ],
    cues: ["Feet planted", "Wrists over elbows", "Controlled lowering"],
    mistakes: ["Elbows flared to 90°", "Lifting hips off the bench", "Using a bench that wobbles"],
  },

  // ---------------- Vertical push ----------------
  db_overhead_press: {
    setup: "Stand with feet hip-width apart. Hold a dumbbell in each hand at shoulder height, palms facing forward or toward each other.",
    steps: [
      "Squeeze your glutes and brace your stomach.",
      "Press the dumbbells straight up until your arms are fully extended overhead.",
      "Lower them back to shoulder height under control.",
    ],
    cues: ["Ribs down, no leaning back", "Biceps end up near your ears", "Wrists stacked over elbows"],
    mistakes: ["Arching the lower back", "Pushing the dumbbells forward instead of up", "Using leg drive to cheat"],
  },
  single_arm_db_overhead_press: {
    setup: "Stand with feet hip-width apart. Hold one dumbbell at shoulder height; the other hand on your hip or out to the side.",
    steps: [
      "Brace your stomach and squeeze your glutes.",
      "Press the dumbbell straight up until your arm is fully extended.",
      "Lower back to the shoulder under control.",
      SWITCH,
    ],
    cues: ["Torso stays upright, no leaning away", "Ribs down", "Smooth, steady press"],
    mistakes: ["Side-bending to push the weight up", "Arching the back", "Letting the elbow flare far out"],
  },
  pike_push_up: {
    setup: "Start in a push-up position, then walk your feet in and lift your hips high so your body makes an upside-down V. Hands shoulder-width apart.",
    steps: [
      "Bend your elbows to lower the top of your head toward the floor, in front of your hands.",
      "Go until your head nearly touches the floor.",
      "Push back up to straight arms.",
    ],
    cues: ["Hips stay high", "Head goes forward of the hands, making a triangle", "Elbows angle back, not out"],
    mistakes: ["Dropping the hips into a regular push-up", "Elbows flaring wide", "Letting the head hit the floor"],
  },
  elevated_pike_push_up: {
    setup: "Place your feet on a bench or sturdy chair and walk your hands back until your hips are high and your torso is close to vertical. Hands shoulder-width apart.",
    steps: [
      "Lower the top of your head toward the floor in front of your hands.",
      "Stop just before your head touches.",
      "Press back up to straight arms.",
    ],
    cues: ["Hips stacked high over the shoulders", "Controlled lowering", "Head forms a triangle with your hands"],
    mistakes: ["Rushing the descent", "Chair sliding: brace it against a wall", "Elbows flaring out"],
  },

  // ---------------- Row ----------------
  one_arm_db_row: {
    setup: "Place one hand and the same-side knee on a bench or chair, or brace one hand on your knee in a split stance. Hold a dumbbell in the other hand, arm hanging straight. Back flat.",
    steps: [
      "Pull the dumbbell up toward your hip, elbow brushing past your side.",
      "Squeeze your shoulder blade toward your spine at the top.",
      "Lower slowly until your arm is straight again.",
      SWITCH,
    ],
    cues: ["Pull to the hip, not the chest", "Back stays flat and still", "Shoulder down away from your ear"],
    mistakes: ["Twisting the torso to heave the weight", "Shrugging the shoulder", "Short, jerky reps"],
  },
  db_bent_over_row: {
    setup: "Hold a dumbbell in each hand. Soften your knees and hinge forward at the hips until your torso is about 45° or lower, back flat, arms hanging.",
    steps: [
      "Brace your stomach.",
      "Pull both dumbbells toward your lower ribs, elbows close to your body.",
      "Squeeze your shoulder blades together at the top.",
      "Lower slowly until your arms are straight.",
    ],
    cues: ["Flat back the whole set", "Torso angle stays the same", "Elbows drive back"],
    mistakes: ["Standing up more with each rep", "Rounding the back", "Jerking the weight up"],
  },
  db_renegade_row: {
    setup: "Get into a push-up position with each hand gripping a dumbbell on the floor (hex dumbbells are steadiest). Feet wider than hip-width for balance.",
    steps: [
      "Brace your stomach and squeeze your glutes.",
      "Pull one dumbbell up toward your hip while pushing the other into the floor.",
      "Lower it back down with control.",
      "Row with the other arm. Alternate arms; one row on each side counts as one rep.",
    ],
    cues: ["Hips stay level and square to the floor", "Wider feet = more stable", "Slow and deliberate"],
    mistakes: ["Hips rocking or rotating", "Using round dumbbells that roll", "Sagging hips"],
  },
  towel_door_row: {
    setup: "Use a solid door that opens away from you, so pulling only presses it shut. Close it (lock it if you can), loop a towel around the handle on your side and hold one end in each hand. Test with a gentle lean before you trust it. Feet close to the door, lean back with straight arms.",
    steps: [
      "Keep your body straight from head to heels.",
      "Pull your chest toward your hands, squeezing your shoulder blades together.",
      "Lower back slowly until your arms are straight.",
    ],
    cues: ["Walk your feet closer to the door to make it harder", "Body stays rigid", "Elbows pull back past your sides"],
    mistakes: ["Using a door that opens toward you, which can swing open as you pull", "Towel slipping off a lever handle: wrap it twice and test first", "Letting go suddenly: always lower under control"],
  },
  band_row: {
    setup: "Sit on the floor with legs straight. Loop a resistance band around your feet (or anchor it to a post at chest height and stand). Hold one end in each hand, arms straight.",
    steps: [
      "Sit tall and brace.",
      "Pull your hands toward your lower ribs, elbows close to your body.",
      "Squeeze your shoulder blades together.",
      "Return slowly until your arms are straight.",
    ],
    cues: ["Tall posture, no leaning back", "Shoulders down", "Control the band on the way back"],
    mistakes: ["Rocking backward to pull", "Shrugging", "Letting the band snap back"],
  },

  // ---------------- Vertical pull ----------------
  negative_pull_up: {
    setup: "Stand on a sturdy chair or jump so your chin is above the bar, hands gripping it slightly wider than your shoulders.",
    steps: [
      "Start at the top with your chin over the bar and your chest close to it.",
      "Lower yourself slowly over 3 to 5 seconds until your arms are straight.",
      "Step back up to the top and repeat.",
    ],
    cues: ["Control the whole way down", "Shoulders stay engaged, not relaxed at the bottom", "Body steady, legs together"],
    mistakes: ["Dropping fast", "Jumping from an unstable surface", "Relaxing completely and hanging on the joints at the bottom"],
  },
  chin_up: {
    setup: "Hang from the bar with your palms facing you, hands about shoulder-width apart, arms straight.",
    steps: [
      "Pull your shoulders down away from your ears.",
      "Pull yourself up until your chin clears the bar.",
      "Lower slowly to straight arms.",
    ],
    cues: ["Chest toward the bar", "Legs still, no kicking", "Full hang between reps"],
    mistakes: ["Swinging or kicking", "Half reps", "Craning the neck to get the chin over"],
  },
  pull_up: {
    setup: "Hang from the bar with your palms facing away, hands slightly wider than your shoulders, arms straight.",
    steps: [
      "Pull your shoulders down and back.",
      "Pull yourself up until your chin clears the bar.",
      "Lower under control to straight arms.",
    ],
    cues: ["Lead with the chest", "Elbows drive down toward your ribs", "Body steady"],
    mistakes: ["Kipping or swinging", "Not reaching straight arms at the bottom", "Shrugging up to the ears"],
  },

  // ---------------- Core ----------------
  dead_bug: {
    setup: "Lie on your back with your arms pointing straight up and your knees bent at 90° above your hips.",
    steps: [
      "Press your lower back gently into the floor and keep it there.",
      "Slowly extend one arm overhead and the opposite leg out straight, just above the floor.",
      "Return to the start and repeat on the other side. Each side counts as one rep.",
    ],
    cues: ["Lower back stays flat on the floor", "Breathe out as you extend", "Slow is harder and better"],
    mistakes: ["Lower back arching off the floor", "Moving too fast", "Holding your breath"],
  },
  plank: {
    setup: "Forearms on the floor, elbows under your shoulders, legs straight behind you on your toes.",
    steps: [
      "Squeeze your glutes and brace your stomach.",
      "Hold a straight line from head to heels.",
      "Breathe steadily for the whole hold.",
    ],
    cues: ["Pull your elbows toward your toes to feel your abs work", "Neck neutral, eyes on the floor", "Quality over time"],
    mistakes: ["Hips sagging", "Hips piked high", "Holding your breath"],
  },
  hollow_hold: {
    setup: "Lie on your back with arms overhead and legs straight.",
    steps: [
      "Press your lower back into the floor.",
      "Lift your shoulders, arms and legs a few centimetres off the floor so your body forms a shallow banana shape.",
      "Hold while breathing steadily.",
    ],
    cues: ["Lower back glued to the floor", "Too hard? Bend your knees or bring your arms by your sides", "Chin slightly tucked"],
    mistakes: ["Lower back lifting", "Legs too low to control", "Holding your breath"],
  },
  kneeling_ab_rollout: {
    setup: "Kneel on a mat, rug or folded towel holding the ab roller handles, roller on the floor under your shoulders.",
    steps: [
      "Brace your stomach and tuck your pelvis slightly.",
      "Roll forward slowly, letting your hips and arms extend together.",
      "Go only as far as you can keep your lower back from sagging.",
      "Pull back to the start using your abs.",
    ],
    cues: ["Slight rounding of the upper back is fine", "Hips move with your shoulders", "Short range done well beats long range done badly"],
    mistakes: ["Lower back sagging at the far point", "Leading with the hips on the way back", "Going farther than you can control"],
  },
  standing_ab_rollout: {
    setup: "Stand with feet hip-width apart, bend down and place the ab roller on the floor in front of your feet.",
    steps: [
      "Brace hard and keep a slight round in your upper back.",
      "Roll forward slowly as far as you can control.",
      "Pull back to standing using your abs.",
    ],
    cues: ["Stop short of any lower-back sag", "Slow and controlled", "Upper back slightly rounded, like a shallow hollow"],
    mistakes: ["Trying it before full kneeling rollouts feel easy: it's very advanced", "Collapsing at the bottom", "Going to full extension too soon"],
  },
  hanging_knee_raise: {
    setup: "Hang from a pull-up bar with your arms straight and your shoulders pulled slightly down.",
    steps: [
      "Brace your stomach.",
      "Lift your knees toward your chest by curling your pelvis up.",
      "Lower your legs slowly without swinging.",
    ],
    cues: ["Curl the pelvis, don't just lift the thighs", "Control the lowering", "Pause briefly at the bottom to stop the swing"],
    mistakes: ["Swinging for momentum", "Only lifting the knees to hip height", "Dropping the legs"],
  },

  // ---------------- Isolation ----------------
  db_lateral_raise: {
    setup: "Stand tall with a light dumbbell in each hand at your sides, palms facing in, elbows slightly bent.",
    steps: [
      "Raise your arms out to the sides until they're about shoulder height.",
      "Pause briefly at the top.",
      "Lower slowly back to your sides.",
    ],
    cues: ["Lead with the elbows", "Shoulders stay down, no shrugging", "Light weight, strict form"],
    mistakes: ["Swinging the body", "Raising above shoulder height with a shrug", "Using a weight that's too heavy"],
  },
  db_curl: {
    setup: "Stand tall with a dumbbell in each hand at your sides, palms facing forward.",
    steps: [
      "Keep your elbows pinned to your sides.",
      "Curl the dumbbells up toward your shoulders.",
      "Squeeze at the top, then lower slowly to straight arms.",
    ],
    cues: ["Only the forearms move", "Full straightening at the bottom", "Slow lowering"],
    mistakes: ["Swinging the body", "Elbows drifting forward", "Half reps"],
  },
  db_overhead_triceps_extension: {
    setup: "Stand or sit tall holding one dumbbell with both hands under the top end, arms straight overhead.",
    steps: [
      "Keep your upper arms close to your head.",
      "Bend your elbows to lower the dumbbell behind your head.",
      "Straighten your arms to lift it back overhead.",
    ],
    cues: ["Elbows point forward and stay close", "Ribs down, no arching", "Feel the stretch at the bottom"],
    mistakes: ["Elbows flaring wide", "Arching the lower back", "Hitting the back of your head: go slower"],
  },
  db_calf_raise: {
    setup: "Stand on the edge of a step with the balls of your feet on it and heels hanging off, or flat on the floor if you have no step. Hold a dumbbell in one hand and steady yourself on a wall or rail with the other.",
    steps: [
      "Lower your heels until you feel a stretch in your calves (below the step, if you're on one).",
      "Rise up onto your toes as high as you can.",
      "Pause at the top, then lower slowly.",
    ],
    cues: ["Full stretch at the bottom, full squeeze at the top", "Knees straight but not locked", "Slow on the way down"],
    mistakes: ["Bouncing", "Short range", "Rolling onto the outside of the foot"],
  },
};

/** How to do an exercise, if the library has a guide for it. */
export function getHowTo(id: string): HowTo | undefined {
  return HOW_TO[id];
}
