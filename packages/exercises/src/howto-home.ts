import type { HowTo } from "./howto.js";

const SWITCH = "Do all your reps on one side, then switch sides. That's one set.";

export const HOW_TO_HOME: Record<string, HowTo> = {
  // ---------------- Horizontal push ----------------
  single_arm_dumbbell_floor_press: {
    setup: "Lie on your back on the floor with your knees bent and feet flat. Hold one dumbbell in one hand above your chest, arm straight. Rest your free hand on your stomach or out to the side on the floor.",
    steps: [
      "Brace your stomach so your body doesn't roll toward the dumbbell.",
      "Lower the dumbbell to the side of your chest until your upper arm touches the floor lightly, elbow about 45° from your body.",
      "Pause for a moment with the arm resting, without letting the shoulder relax completely.",
      "Press the dumbbell back up until your arm is straight over your chest.",
      SWITCH,
    ],
    cues: ["Hips and shoulders stay flat on the floor", "Wrist stacked over the elbow", "Same speed down and up on both sides"],
    mistakes: ["Rolling toward the working side", "Bouncing the elbow off the floor", "Flaring the elbow straight out to the side"],
  },
  single_arm_dumbbell_curl: {
    setup: "Stand tall with feet hip-width apart, holding one dumbbell at your side with your palm facing forward. Put your free hand on your hip, or hold a wall or chair for balance.",
    steps: [
      "Keep your upper arm still against your side.",
      "Curl the dumbbell up toward your shoulder, bending only at the elbow.",
      "Squeeze briefly at the top.",
      "Lower slowly until your arm is straight again.",
      SWITCH,
    ],
    cues: ["Elbow stays pinned to your side", "Slow on the way down", "Stand tall, no leaning back"],
    mistakes: ["Swinging the body to lift the weight", "Letting the elbow drift forward", "Dropping the weight on the way down"],
  },
  single_arm_dumbbell_lateral_raise: {
    setup: "Stand side-on to a wall or sturdy chair with feet hip-width apart. Hold the support with your near hand and a dumbbell in your far hand at your side, palm facing in.",
    steps: [
      "Brace your stomach and keep a slight bend in the elbow.",
      "Raise the dumbbell out to the side until your arm is level with your shoulder.",
      "Pause briefly at the top.",
      "Lower slowly back to your side.",
      SWITCH,
    ],
    cues: ["Lead with the elbow, not the hand", "Shoulder stays down, away from your ear", "Light weight, smooth reps"],
    mistakes: ["Shrugging the shoulder up", "Swinging the body to get the weight up", "Lifting above shoulder height"],
  },
  band_lateral_raise: {
    setup: "Stand on the middle of a long band with feet hip-width apart. Hold one end in each hand at your sides, palms facing in. Standing with feet wider makes it harder.",
    steps: [
      "Brace your stomach and keep a slight bend in both elbows.",
      "Raise both arms out to the sides until they're level with your shoulders.",
      "Pause for a moment at the top.",
      "Lower slowly back to your sides, keeping some tension in the band.",
    ],
    cues: ["Lead with the elbows", "Shoulders stay down", "Wider stance = more resistance"],
    mistakes: ["Shrugging the shoulders up", "Letting the band snap the arms down", "Leaning back to finish the rep"],
  },
  band_pull_apart: {
    setup: "Stand tall holding a long band in both hands at chest height, arms straight in front of you and hands about shoulder-width apart. Hands closer together on the band makes it harder.",
    steps: [
      "Set your shoulders down and back.",
      "Pull the band apart by moving your arms out to the sides until the band touches your chest.",
      "Squeeze your shoulder blades together for a moment.",
      "Return slowly to the start, arms still straight.",
    ],
    cues: ["Arms stay straight with soft elbows", "Move from the shoulders", "Chest stays tall"],
    mistakes: ["Bending the elbows to make it easier", "Shrugging up toward the ears", "Arching the lower back"],
  },
  seated_band_row: {
    setup: "Sit on the floor with your legs straight out in front of you. Loop the middle of a long band around the soles of your feet and hold one end in each hand, arms straight, palms facing each other. Sit tall; holding the band nearer your feet makes it harder.",
    steps: [
      "Set your shoulders down and back.",
      "Pull your hands toward your lower ribs, elbows close to your sides.",
      "Squeeze your shoulder blades together at the end.",
      "Let your arms straighten slowly, keeping your chest tall.",
    ],
    cues: ["Sit tall the whole time", "Elbows drive back past your body", "Bend your knees a little if your lower back rounds"],
    mistakes: ["Leaning back to pull", "Shrugging the shoulders", "The band slipping off your feet: wear shoes and loop it around the arches"],
  },
  wall_push_up: {
    setup: "Stand facing a wall, about an arm's length away, feet hip-width apart. Place your hands flat on the wall at shoulder height, slightly wider than your shoulders.",
    steps: [
      "Brace your stomach and squeeze your glutes so your body is one straight line.",
      "Bend your elbows to bring your chest toward the wall, elbows angled back about 45°.",
      "Go until your nose or chest nearly touches the wall.",
      "Push the wall away to straighten your arms.",
    ],
    cues: ["Body moves as one plank from head to heels", "Feet farther from the wall = harder", "Too easy? Move on to a counter or table edge"],
    mistakes: ["Hips sagging or sticking out behind you", "Feet so far back they slip: wear shoes or use a non-slip floor", "Only bending the elbows a little"],
  },
  incline_dumbbell_bench_press: {
    setup: "Set an adjustable bench to a low incline, about 30°, and check it's locked and steady. Note the setting so you can repeat it. Sit with a dumbbell resting on each thigh, then lie back and use your thighs to help bring the dumbbells up above your chest, arms straight.",
    steps: [
      "Plant your feet and squeeze your shoulder blades together and down.",
      "Lower the dumbbells to the sides of your upper chest, elbows about 45° from your body.",
      "Go until you feel a gentle stretch across the chest.",
      "Press back up until your arms are straight over your upper chest.",
    ],
    cues: ["Wrists stacked over elbows", "Upper back and bottom stay on the bench", "Controlled lowering"],
    mistakes: ["Setting the bench too steep, which turns it into a shoulder press", "Elbows flared out to 90°", "Dropping the dumbbells out to the sides at the end: bring them to your chest and sit up with them"],
  },

  // ---------------- Vertical push ----------------
  band_overhead_press: {
    setup: "Check the band for nicks or tears. Stand on the middle of it with feet hip-width apart, the band flat under the middle of your feet. Hold one end in each hand at shoulder height, palms facing forward or toward each other.",
    steps: [
      "Squeeze your glutes and brace your stomach.",
      "Press your hands straight up until your arms are fully extended overhead.",
      "Lower them back to shoulder height slowly, keeping tension in the band.",
    ],
    cues: ["Ribs down, no leaning back", "Wider stance = more tension: note your band and stance so you can repeat them", "Wrists stacked over elbows"],
    mistakes: ["Band sliding out from under your feet: wear shoes and stand on it with your whole foot", "Arching the lower back", "Letting the band snap your hands down"],
  },

  // ---------------- Shoulders ----------------
  dumbbell_reverse_fly: {
    setup: "Hold a light dumbbell in each hand. Either hinge forward at the hips with soft knees until your torso is close to level with the floor, back flat, or lie chest-down on an incline bench if you have one. Let your arms hang straight down, palms facing each other.",
    steps: [
      "Set a slight bend in your elbows and keep it there.",
      "Raise your arms out to the sides until they're about level with your body.",
      "Pause briefly and feel the backs of your shoulders work.",
      "Lower slowly until your arms hang straight down again.",
    ],
    cues: ["Lead with the backs of the hands, arms moving out wide", "Shoulders stay down, away from your ears", "Light weight, strict form"],
    mistakes: ["Standing up a little more with every rep", "Bending the elbows a lot so it becomes a row", "Swinging or jerking the weights up"],
  },

  // ---------------- Arms ----------------
  band_triceps_pressdown: {
    setup: "Anchor the band high: fit a door anchor over the top of a solid door that opens away from you, close it fully (lock it if you can), or loop the band over a sturdy high anchor. Give it a firm test pull. Stand facing it holding the band, elbows by your sides, forearms about level with the floor.",
    steps: [
      "Keep your elbows pinned to your sides.",
      "Push your hands down until your arms are straight.",
      "Squeeze the backs of your arms for a second.",
      "Let your hands rise slowly back to about level with your elbows.",
    ],
    cues: ["Only the forearms move", "Stand tall with a slight forward lean at most", "Control the band on the way up"],
    mistakes: ["Elbows drifting forward and up", "Leaning over to push down with your body weight", "Using an anchor you haven't tested: if it slips, the band snaps back toward you"],
  },
  band_curl: {
    setup: "Check the band for nicks or tears. Stand on the middle of it with feet hip-width apart, the band flat under the middle of your feet. Hold one end in each hand at your sides, palms facing forward.",
    steps: [
      "Keep your elbows pinned to your sides.",
      "Curl your hands up toward your shoulders.",
      "Squeeze at the top, then lower slowly to straight arms.",
    ],
    cues: ["Only the forearms move", "Wider stance = more tension", "Slow lowering against the band"],
    mistakes: ["Band sliding out from under your feet: wear shoes and stand on it with your whole foot", "Swinging the body", "Elbows drifting forward"],
  },
  dumbbell_hammer_curl: {
    setup: "Stand tall with a dumbbell in each hand at your sides, palms facing each other.",
    steps: [
      "Keep your elbows pinned to your sides.",
      "Curl both dumbbells up together toward your shoulders, palms still facing each other.",
      "Squeeze at the top, then lower slowly to straight arms.",
    ],
    cues: ["Thumbs point up the whole time", "Only the forearms move", "Full straightening at the bottom"],
    mistakes: ["Swinging the body to get the weights up", "Elbows drifting forward", "Half reps"],
  },

  // ---------------- Vertical pull ----------------
  band_lat_pulldown: {
    setup: "Anchor the band high: a door anchor over the top of a solid door that opens away from you, closed fully (locked if you can), or a sturdy high anchor. Test it with a firm pull. Kneel on a mat, rug or folded towel, or sit, facing the anchor and far enough back that the band is taut with your arms reaching up and slightly forward.",
    steps: [
      "Hold one end in each hand, brace your stomach and pull your shoulders down away from your ears.",
      "Pull your elbows down to your sides, bringing your hands toward your shoulders.",
      "Squeeze your shoulder blades down and together for a second.",
      "Let your arms rise slowly back to the start.",
    ],
    cues: ["Think of driving your elbows into your back pockets", "Chest up, tall torso", "Move back from the anchor for more tension"],
    mistakes: ["Leaning far back to pull with your body weight", "Shrugging your shoulders up", "Letting the band yank your arms back up"],
  },
  band_assisted_pull_up: {
    setup: "Check the band for nicks or tears. Loop it over the pull-up bar, thread one end through the other and pull it tight so it can't slide. Put a sturdy chair or step under the bar. Stand on it, grip the bar slightly wider than your shoulders, palms facing away, then carefully place one knee or foot in the loop and lower yourself until you hang with straight arms.",
    steps: [
      "Pull your shoulders down and back.",
      "Pull yourself up until your chin clears the bar.",
      "Lower slowly to straight arms.",
      "When the set is done, step back onto the chair or step and take your knee or foot out of the band before you let go of the bar.",
    ],
    cues: ["Thicker band = more help", "Aim to need a thinner band over time", "Lead with the chest, elbows driving down"],
    mistakes: ["Letting go of the bar while still in the band", "Letting the band bounce you up out of the bottom", "Getting in or out in a rush: it's when your foot is most likely to slip"],
  },

  // ---------------- Row ----------------
  suspension_row: {
    setup: "Attach the suspension trainer to a rated anchor: a door anchor over the top of a solid door that closes away from you (lock it if you can), or a secure overhead mount. Face the anchor holding a handle in each hand. Lean back with straight arms until your body is a straight line, and test the anchor with a gentle lean first.",
    steps: [
      "Brace your stomach and squeeze your glutes.",
      "Pull your chest toward your hands, elbows close to your body.",
      "Squeeze your shoulder blades together at the top.",
      "Lower back slowly until your arms are straight.",
    ],
    cues: ["Walk your feet forward to make it harder, back to make it easier", "Body stays rigid from head to heels", "Straps stay taut the whole set"],
    mistakes: ["Hips sagging as you tire", "Using a door that opens toward you, which can swing open", "Letting go or dropping fast: always lower under control"],
  },
  chest_supported_dumbbell_row: {
    setup: "Set an adjustable bench to an incline, about 30–45°, and check it's locked and steady. Put a dumbbell on the floor either side of it. Lie chest-down on the bench with your head just past the top and your feet on the floor, then pick up the dumbbells so they hang straight down, palms facing each other.",
    steps: [
      "Pull both dumbbells up toward your lower ribs, elbows close to your body.",
      "Squeeze your shoulder blades together at the top.",
      "Lower slowly until your arms are straight.",
    ],
    cues: ["Chest stays on the bench the whole time", "Elbows drive back past your sides", "Neck relaxed, eyes looking down"],
    mistakes: ["Lifting your chest off the bench to heave the weight", "Shrugging up toward your ears", "Craning your neck up to look forward"],
  },

  // ---------------- Squat ----------------
  sit_to_stand: {
    setup: "Push a sturdy chair of normal seat height back against a wall so it can't slide. Sit toward the front of the seat with feet flat, hip-width apart and slightly behind your knees. Cross your arms over your chest or reach them forward.",
    steps: [
      "Lean your chest forward over your knees.",
      "Push through your whole foot to stand up tall, without using your hands if you can.",
      "Lower yourself slowly until your bottom lightly touches the seat.",
      "Stand straight back up from there.",
    ],
    cues: ["Nose travels forward over your toes as you rise", "Slow on the way down: touch the seat, don't drop into it", "Using your hands on your thighs is fine to start; aim to need them less"],
    mistakes: ["Dropping heavily into the chair", "Rocking back and forth to swing yourself up", "Knees caving inward"],
  },
  supported_split_squat: {
    setup: "Stand side-on to a wall, counter or sturdy chair and rest the nearest hand on it for balance. Take a long stride: one foot forward, the other back on the ball of the foot, feet hip-width apart like train tracks.",
    steps: [
      "Lower straight down by bending both knees until the back knee nearly touches the floor.",
      "Keep most of your weight on the front foot.",
      "Push through the front heel to rise back up, staying in the split stance.",
      SWITCH,
    ],
    cues: ["The support is for balance, not for pulling yourself up", "Torso tall", "Straight up and down, like an elevator"],
    mistakes: ["Feet in a straight line, which makes balancing hard", "Leaning onto the back leg", "Rushing the descent"],
  },
  step_up: {
    setup: "Use a stable step or the bottom stair, with a wall or rail beside you for one hand. Note how high the step is so you can track it. Stand facing it and place one whole foot flat on the step.",
    steps: [
      "Lean forward slightly and push through the foot on the step to stand up on it.",
      "Bring the other foot up beside it and stand tall.",
      "Step back down slowly with the other foot first, keeping the working foot on the step.",
      "Lightly touch the floor and go again.",
      SWITCH,
    ],
    cues: ["The top leg does the work, the bottom foot just leaves the floor", "Knee follows the line of your toes", "Lower step = easier"],
    mistakes: ["Pushing off hard with the bottom foot", "Using a stool or box that can slide or tip", "Only the toes on the step"],
  },
  dumbbell_step_up: {
    setup: "Use a stable step or the bottom stair. Note how high the step is so you can track it. Hold a dumbbell in each hand at your sides and place one whole foot flat on the step.",
    steps: [
      "Lean forward slightly and push through the foot on the step to stand up on it.",
      "Bring the other foot up beside it and stand tall.",
      "Step back down slowly with the other foot first, keeping the working foot on the step.",
      "Lightly touch the floor and go again.",
      SWITCH,
    ],
    cues: ["Get steady with the bodyweight version first", "The top leg does the work", "Dumbbells hang still at your sides"],
    mistakes: ["Pushing off hard with the bottom foot", "Choosing a step so high you have to lurch up", "Wobbling: use a lower step or lighter dumbbells"],
  },

  // ---------------- Hinge ----------------
  bodyweight_hip_thrust: {
    setup: "Sit on the floor with your upper back (just below the shoulder blades) against the edge of a sturdy couch or bench. Brace it against a wall if it could slide. Feet flat, hip-width apart, arms out to the sides or crossed over your chest.",
    steps: [
      "Tuck your chin slightly and brace your stomach.",
      "Drive through your heels to lift your hips until your thighs are level with your torso.",
      "Squeeze your glutes at the top for a second.",
      "Lower under control until your bottom nearly touches the floor.",
    ],
    cues: ["Upper back pivots on the edge", "Shins roughly vertical at the top", "Ribs stay down"],
    mistakes: ["Arching the lower back to get higher", "Feet too close or too far away", "Rushing the reps"],
  },
  band_romanian_deadlift: {
    setup: "Check the band for nicks or tears. Stand on the middle of it with feet hip-width apart, the band flat under the middle of your feet. Hold one end in each hand in front of your thighs.",
    steps: [
      "Unlock your knees slightly and keep them there.",
      "Push your hips back, letting your hands slide down the front of your legs.",
      "Stop at a strong stretch in the backs of your thighs, with your back still flat.",
      "Drive your hips forward to stand tall and squeeze your glutes at the top.",
    ],
    cues: ["Flat back from head to hips", "Hands stay close to your legs", "The movement is at the hips, not the knees"],
    mistakes: ["Rounding the back to reach lower", "Bending the knees into a squat", "Band sliding out from under your feet: wear shoes and stand on it with your whole foot"],
  },
  hamstring_walkout: {
    setup: "Lie on your back with knees bent, feet flat and hip-width apart, heels close to your bottom. Arms by your sides.",
    steps: [
      "Drive through your heels to lift into a glute bridge.",
      "Keeping your hips up, walk your heels away from you in a few small steps.",
      "Walk them back in the same way.",
      "Lower your hips to the floor. That's one rep.",
    ],
    cues: ["Small steps, hips stay high", "Start with short walkouts and go farther over time", "Ribs down"],
    mistakes: ["Walking out so far your hips drop to the floor", "Arching the lower back", "Pushing on if a hamstring starts to cramp: lower your hips and rest"],
  },
  sliding_leg_curl: {
    setup: "Use sliders, or towels or socks on a smooth floor such as wood or tile. Lie on your back with knees bent and your heels on the sliders, arms by your sides.",
    steps: [
      "Drive through your heels to lift your hips into a bridge.",
      "Keeping your hips up, slowly slide your heels away until your legs are nearly straight.",
      "Curl your heels back toward your bottom, hips still up.",
      "Lower your hips at the end of the set.",
    ],
    cues: ["Hips stay high the whole rep", "Too hard? Slide out slowly, lower your hips, pull your heels back in and bridge up again", "A shorter slide is fine to start"],
    mistakes: ["Hips sagging as the heels slide out", "Arching the lower back", "Using towels on carpet, where they won't slide"],
  },

  // ---------------- Calves ----------------
  bodyweight_standing_calf_raise: {
    setup: "Stand with feet hip-width apart and one hand on a wall for balance. For more range, stand with the balls of your feet on the edge of a stable step and heels hanging off.",
    steps: [
      "Lower your heels until you feel a stretch in your calves (below the step, if you're on one).",
      "Rise up onto your toes as high as you can.",
      "Pause at the top, then lower slowly.",
    ],
    cues: ["Knees straight but not locked", "Full stretch at the bottom, full squeeze at the top", "Slow on the way down"],
    mistakes: ["Bouncing", "Short range", "Rolling onto the outside of the foot"],
  },
  single_leg_bodyweight_calf_raise: {
    setup: "Stand on one foot with a hand on a wall for balance, the other foot hooked behind your ankle or lifted. For more range, stand with the ball of that foot on the edge of a stable step, heel hanging off.",
    steps: [
      "Lower your heel until you feel a stretch in your calf.",
      "Rise up onto your toes as high as you can.",
      "Pause at the top, then lower slowly.",
      SWITCH,
    ],
    cues: ["Knee straight but not locked", "Wall is for balance only, not for pushing up", "Slow on the way down"],
    mistakes: ["Bouncing", "Short range", "Rolling onto the outside of the foot"],
  },
  seated_dumbbell_calf_raise: {
    setup: "Sit on a sturdy chair with feet flat. Rest one dumbbell across the top of one thigh, just above the knee, and keep it there with both hands (a folded towel underneath makes it more comfortable). For more range, put the ball of that foot on a book or step.",
    steps: [
      "Lift that heel as high as you can.",
      "Pause at the top.",
      "Lower slowly until the heel touches down or you feel a stretch in your calf.",
      SWITCH,
    ],
    cues: ["Both hands keep the dumbbell still", "Push through the big toe side of the foot", "Full range, slow lowering"],
    mistakes: ["Dumbbell sliding toward the knee or off the thigh", "Bouncing", "Book or step slipping: use something that stays put"],
  },
};
