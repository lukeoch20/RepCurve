import type { HowTo } from "./howto.js";

const SWITCH = "Do all your reps on one side, then switch sides. That's one set.";

export const HOW_TO_FREE: Record<string, HowTo> = {
  // ---------------- Core ----------------
  bird_dog: {
    setup: "Kneel on all fours on a mat, rug or carpet with your hands under your shoulders and knees under your hips. Keep your back flat and your neck in line, looking at the floor.",
    steps: [
      "Brace your stomach without arching or rounding your back.",
      "Reach one arm forward and the opposite leg back until both are level with your body.",
      "Hold for a second or two, hips level.",
      "Bring them back down under control, then do the other arm and leg. That's one rep.",
    ],
    cues: ["Imagine a cup of water balanced on your lower back", "Reach long rather than high", "Slow and steady beats quick"],
    mistakes: ["Hips twisting open as the leg lifts", "Arching the lower back to lift the leg higher", "Rushing from side to side"],
  },
  side_lying_hip_adduction: {
    setup: "Lie on your side on a mat, rug or carpet with your bottom leg straight. Bend your top leg and put that foot flat on the floor in front of your bottom knee, or rest the top knee on a cushion. Prop your head on your hand or arm.",
    steps: [
      "Point the toes of your bottom foot forward.",
      "Lift the bottom leg up off the floor as high as you can, using your inner thigh.",
      "Pause for a moment at the top.",
      "Lower slowly until the leg nearly touches the floor.",
      SWITCH,
    ],
    cues: ["Small, controlled lift", "Bottom leg stays straight", "Body stays stacked on its side"],
    mistakes: ["Rolling onto your back", "Swinging the leg up", "Letting the leg drop between reps"],
  },
  bodyweight_good_morning: {
    setup: "Stand tall with feet hip-width apart and a soft bend in your knees. Cross your hands over your chest, or rest your fingertips lightly behind your head.",
    steps: [
      "Brace your stomach and keep your back flat.",
      "Push your hips back, letting your chest tip forward, until you feel a stretch in the back of your thighs.",
      "Stop when your back can't stay flat, usually with your chest close to level with the floor.",
      "Drive your hips forward to stand back up tall.",
    ],
    cues: ["Hips move back, not down", "Knees stay softly bent", "Flat back from head to hips"],
    mistakes: ["Rounding the back to go lower", "Bending the knees into a squat", "Pulling on your head with your hands"],
  },
  hands_elevated_pike_push_up: {
    setup: "Put your hands shoulder-width apart on a stable step, sturdy chair seat against a wall, or low bench that can't slide. Walk your feet in toward it and lift your hips high, so your body makes an upside-down V.",
    steps: [
      "Brace your stomach and keep your hips high.",
      "Bend your elbows to lower the top of your head toward the edge of the support, between your hands.",
      "Go as low as you can control, elbows angled back rather than straight out.",
      "Press back up until your arms are straight.",
    ],
    cues: ["Head moves toward the support, slightly ahead of your hands", "Hips stay high the whole time", "Walk your feet closer to make it harder"],
    mistakes: ["A chair or step that can slide or tip", "Dropping the hips into a push-up", "Elbows flaring straight out"],
  },
  side_plank: {
    setup: "Lie on your side on a mat, rug or carpet with your elbow directly under your shoulder and your forearm flat on the floor. Stack your legs straight, or bend both knees to 90° for an easier version.",
    steps: [
      "Brace your stomach and lift your hips until your body is straight from head to feet (or head to knees if they're bent).",
      "Hold that line for the set time, breathing steadily.",
      "Lower your hips gently back to the floor.",
      SWITCH,
    ],
    cues: ["Elbow stacked under the shoulder", "Hips pushed slightly forward, in line with your shoulders", "Bent knees = easier, straight legs = harder"],
    mistakes: ["Hips sagging toward the floor", "Hips drifting back behind the line of your body", "Shoulder shrugging up toward your ear", "Holding your breath"],
  },
  reverse_crunch: {
    setup: "Lie on your back on the floor with your arms by your sides, palms down. Lift your legs so your knees are bent at about 90° over your hips.",
    steps: [
      "Breathe out and brace your stomach.",
      "Curl your pelvis up off the floor, bringing your knees toward your chest.",
      "Pause briefly when your hips are just off the floor.",
      "Lower your hips slowly until your knees are back over your hips.",
    ],
    cues: ["Roll the pelvis up, don't just swing the legs", "Small, slow movement", "Arms rest lightly; they don't push"],
    mistakes: ["Swinging the legs for momentum", "Dropping the hips back down fast", "Pressing hard through the arms to lift"],
  },
  lying_leg_raise: {
    setup: "Lie on your back on a mat, rug or carpet with your legs straight and your arms by your sides, palms down. Lift your legs straight up so your feet are over your hips.",
    steps: [
      "Breathe out, brace your stomach and press your lower back flat into the floor.",
      "Keeping your legs straight and together, lower your feet slowly toward the floor.",
      "Stop just before your heels touch, or sooner if your lower back starts to lift off the floor.",
      "Raise your legs back up until your feet are over your hips.",
    ],
    cues: ["Lower back stays pressed into the floor the whole time", "Slow on the way down", "Bend your knees a little to make it easier"],
    mistakes: ["Lower back arching off the floor as the legs come down", "Dropping the legs fast or bouncing them off the floor", "Pushing hard through the arms to lift"],
  },
  pallof_press: {
    setup: "Anchor a band securely at chest height: a door anchor in a closed door that opens away from you, or a sturdy post. Or set a cable to chest height with a single handle. Stand side-on to the anchor, feet shoulder-width apart, holding the handle with both hands at the middle of your chest. Step away until the band or cable is under tension.",
    steps: [
      "Brace your stomach and squeeze your glutes.",
      "Press the handle straight out from your chest until your arms are straight.",
      "Hold for a second or two, resisting the pull back toward the anchor.",
      "Bring the handle slowly back to your chest.",
      SWITCH,
    ],
    cues: ["Hands stay in line with the middle of your chest", "Hips and shoulders stay square to the front", "Step farther from the anchor to make it harder"],
    mistakes: ["Twisting toward the anchor as you press", "Leaning away from the anchor to cheat", "Letting the band snap your arms back", "Trusting an anchor you haven't tested: give it a gentle pull first"],
  },
  suitcase_carry: {
    setup: "Clear a straight walkway with nothing to trip on. Put one dumbbell by your side, bend your knees with a flat back and pick it up in one hand. Stand tall with it hanging at your side.",
    steps: [
      "Brace your stomach, stand tall and set your shoulders down and back.",
      "Walk with short, steady steps for the set time or distance, staying upright.",
      "At the end of the walkway, turn around with small steps and keep going.",
      "Bend your knees to put the dumbbell down under control, then pick it up with the other hand.",
      SWITCH,
    ],
    cues: ["Stand tall, as if a string is pulling your head up", "Shoulders level, no lean either way", "Firm grip, arm hanging long"],
    mistakes: ["Leaning away from or toward the dumbbell", "Shrugging the loaded shoulder or letting it drop", "Rushing: walk at a normal, controlled pace"],
  },
  cable_crunch: {
    setup: "Attach a rope to a cable set at its highest point. Hold one end of the rope in each hand and kneel facing the stack, about an arm's length away, on a mat or folded towel if the floor is hard. Bring your hands to the sides of your head.",
    steps: [
      "Sit your hips back slightly so your torso leans forward, and keep your hips there.",
      "Breathe out and curl your ribs down toward your hips, rounding your back.",
      "Go until your elbows are near your thighs.",
      "Uncurl slowly back to the start, feeling a stretch through your stomach.",
    ],
    cues: ["Hips stay still; only your spine curls", "Hands stay fixed by your head", "Think ribs to hips"],
    mistakes: ["Sitting back onto your heels to pull the weight down", "Pulling with the arms", "Letting the stack crash down between reps"],
  },

  // ---------------- Isolation ----------------
  side_lying_hip_abduction: {
    setup: "Lie on your side on a mat, rug or carpet with your legs straight and stacked; bend the bottom knee for balance if you like. Rest your head on your lower arm and place your top hand on the floor in front of you.",
    steps: [
      "Point your top toes forward, not up at the ceiling.",
      "Lift the top leg, taking it slightly behind the line of your body.",
      "Pause briefly at the top, then lower slowly without letting it rest.",
      SWITCH,
    ],
    cues: ["Feel it at the outside of the hip, toward the back pocket", "Heel leads slightly, toes forward", "Hips stacked, not rolling back"],
    mistakes: ["Rolling the hips backward and turning the toes up", "Swinging the leg forward", "Lifting so high that your waist does the work"],
  },
  band_hip_abduction: {
    setup: "Loop a resistance band around both ankles, or just above your knees for an easier version. Stand side-on to a wall with one hand on it for balance, feet hip-width apart.",
    steps: [
      "Stand tall on the leg closest to the wall, knee soft.",
      "Lift the outside leg out to the side, toes pointing forward.",
      "Pause briefly, then lower slowly, keeping some tension in the band.",
      SWITCH,
    ],
    cues: ["Torso stays upright", "Toes forward, not turned out", "Small, controlled lift"],
    mistakes: ["Leaning away from the wall to lift the leg higher", "Turning the toes up toward the ceiling", "Letting the band snap the leg back in"],
  },
  ez_bar_curl: {
    setup: "Load the EZ bar evenly and fit collars. Stand tall with feet hip-width apart, holding the bar on the angled grips, palms facing forward, arms straight.",
    steps: [
      "Keep your elbows pinned to your sides.",
      "Curl the bar up toward your shoulders.",
      "Squeeze at the top, then lower slowly to straight arms.",
    ],
    cues: ["Only the forearms move", "Wrists stay straight", "Full straightening at the bottom"],
    mistakes: ["Swinging the body", "Elbows drifting forward", "Half reps"],
  },

  // ---------------- Horizontal push ----------------
  barbell_bench_press: {
    setup: "Set the rack safeties just below the height of your chest when you're lying down, or have a spotter stand behind you. Load the bar evenly and fit collars. Lie back with your eyes under the bar and feet flat on the floor, then grip it a little wider than shoulder-width, thumbs wrapped around.",
    steps: [
      "Squeeze your shoulder blades together and down, and plant your feet.",
      "Lift the bar out of the hooks and bring it over your shoulders with straight arms.",
      "Breathe in, brace, and lower the bar under control to your mid-chest, elbows about 45° from your body.",
      "Touch lightly, then press the bar up and slightly back until your arms are straight over your shoulders.",
      "After your last rep, move the bar back until it touches the uprights, then lower it into the hooks.",
    ],
    cues: ["Wrists stacked over elbows", "Upper back tight, feet planted", "Bottom stays on the bench"],
    mistakes: ["Lifting without safeties set or a spotter", "Thumbless grip, which lets the bar roll out of your hands", "Bouncing the bar off your chest", "Elbows flared out to 90°"],
  },

  // ---------------- Vertical push ----------------
  barbell_overhead_press: {
    setup: "Set the bar in a rack at upper-chest height, load it evenly and fit collars. Grip it just outside shoulder-width, step in so it rests on the front of your shoulders, and stand up to lift it out. Take one or two steps back, feet hip-width apart.",
    steps: [
      "Squeeze your glutes and brace your stomach, elbows slightly in front of the bar.",
      "Press the bar straight up, moving your head back slightly to let it pass your face.",
      "Once it passes your forehead, bring your head forward so the bar ends over the middle of your feet, arms straight.",
      "Lower it under control to the front of your shoulders.",
      "After your last rep, walk forward and set the bar back in the hooks.",
    ],
    cues: ["Bar travels in a straight line", "Ribs down, no leaning back", "Forearms vertical under the bar"],
    mistakes: ["Arching the lower back", "Pressing the bar forward around your face", "Using leg drive to cheat"],
  },

  // ---------------- Squat ----------------
  barbell_back_squat: {
    setup: "Set the bar in the rack at about mid-chest height and the safeties just below the bottom of your squat. Load it evenly and fit collars. Step under and rest the bar on the meaty top of your upper back, not on your neck, hands just outside your shoulders.",
    steps: [
      "Stand up to lift the bar off the hooks, then take 2–3 small steps back.",
      "Set your feet about shoulder-width apart, toes turned out slightly.",
      "Breathe in and brace your stomach hard.",
      "Sit down between your heels, knees following your toes, chest up.",
      "Go as deep as you can with a flat back and heels down, then drive up to standing.",
      "After your last rep, walk forward until the bar touches the uprights, then lower it into the hooks.",
    ],
    cues: ["Weight across the whole foot", "Knees follow the line of your toes", "Bar stays over the middle of your foot"],
    mistakes: ["Squatting without the safeties set", "Heels lifting or knees caving in", "Chest dropping so the squat turns into a bend-over", "Walking out too far from the rack"],
  },
  barbell_front_squat: {
    setup: "Set the bar in the rack at about shoulder height and the safeties just below the bottom of your squat. Load it evenly and fit collars. Step in so the bar sits on the front of your shoulders, close to your throat. Use your fingertips under the bar with elbows high, or cross your arms over it with hands on opposite shoulders.",
    steps: [
      "Stand up to lift the bar off the hooks and take 2–3 small steps back.",
      "Set your feet shoulder-width apart, toes turned out slightly, and brace your stomach.",
      "Sit straight down between your heels, keeping your elbows up and torso upright.",
      "Go as deep as you can with heels down, then drive up to standing.",
      "After your last rep, walk forward and set the bar back in the hooks.",
    ],
    cues: ["Elbows high the whole time", "The bar rests on your shoulders, not in your hands", "If a rep fails, let the bar down onto the safeties"],
    mistakes: ["Elbows dropping so the bar rolls forward", "Gripping hard and straining the wrists", "Squatting without the safeties set"],
  },

  // ---------------- Hinge ----------------
  barbell_hip_thrust: {
    setup: "Push a bench against a wall so it can't slide, then sit on the floor with your upper back (just below the shoulder blades) against its long edge. Put a pad on the loaded bar, roll it over your legs until it sits in the crease of your hips, and hold it there with both hands. Feet flat, hip-width apart.",
    steps: [
      "Tuck your chin slightly and brace your stomach.",
      "Drive through your heels to lift your hips until your thighs are level with your torso.",
      "Squeeze your glutes at the top for a second.",
      "Lower under control until your bottom nearly touches the floor.",
      "After your last rep, sit down and roll the bar back down your legs.",
    ],
    cues: ["Shins vertical at the top", "Eyes look forward, not up at the ceiling", "Upper back pivots on the bench edge"],
    mistakes: ["Arching the lower back to finish the rep", "Letting go of the bar so it rolls", "Feet too close or too far"],
  },
  barbell_romanian_deadlift: {
    setup: "Set the bar in a rack at mid-thigh height, or deadlift it up from the floor with a flat back. Stand tall with feet hip-width apart, holding the bar just outside your thighs with palms facing you, arms straight.",
    steps: [
      "Unlock your knees slightly and keep them there.",
      "Push your hips back as if closing a car door with your bottom, letting the bar slide down the front of your thighs.",
      "Stop when you feel a strong stretch in the backs of your thighs, usually around knee to mid-shin height, with your back still flat.",
      "Drive your hips forward to stand tall and squeeze your glutes at the top.",
      "After your last rep, set the bar back in the rack, or lower it to the floor with a flat back.",
    ],
    cues: ["Bar stays touching your legs", "Flat back from head to hips", "The movement is at the hips, not the knees"],
    mistakes: ["Rounding the back to reach lower", "Bending the knees into a squat", "Bar drifting away from your legs", "Leaning back at the top"],
  },
  trap_bar_deadlift: {
    setup: "Load the trap bar evenly and fit collars. Step inside it so the handles line up with the middle of your feet, feet hip-width apart. If your bar has raised handles, using them makes it easier.",
    steps: [
      "Push your hips back and bend your knees to grip the middle of each handle, arms straight.",
      "Lift your chest so your back is flat, and pull your shoulders down to take the slack out of the bar.",
      "Breathe in, brace your stomach and push the floor away to stand up tall.",
      "Lower the bar under control by pushing your hips back and bending your knees.",
      "Let it settle on the floor, then reset your back and brace before the next rep.",
    ],
    cues: ["Push the floor away", "Hips and shoulders rise together", "Stand tall at the top, no leaning back"],
    mistakes: ["Rounding the back", "Hips shooting up first", "Gripping off-centre so the bar tips", "Dropping the bar instead of lowering it"],
  },
  barbell_deadlift: {
    setup: "Load the bar evenly and fit collars, with clear space around you. Stand with feet hip-width apart and the bar over the middle of your feet, a few centimetres from your shins.",
    steps: [
      "Hinge down and grip the bar just outside your legs, palms facing you, arms straight.",
      "Bend your knees until your shins touch the bar, then lift your chest so your back is flat.",
      "Pull your shoulders down to take the slack out of the bar, breathe in and brace hard.",
      "Push the floor away and keep the bar against your legs until you're standing tall.",
      "Lower it by pushing your hips back, bending your knees once it passes them. Let it settle on the floor and reset before the next rep.",
    ],
    cues: ["Bar stays over the middle of your foot", "Hips and shoulders rise together", "Finish by squeezing your glutes, not leaning back"],
    mistakes: ["Rounding the back", "Bar drifting forward away from your legs", "Jerking the bar off the floor", "Bouncing reps instead of resetting each one"],
  },
  back_extension_45: {
    setup: "Adjust the 45° back-extension pad so its top edge sits just below your hip bones, leaving you free to bend at the hips. Hook your heels under the foot rollers, legs straight, and cross your arms over your chest.",
    steps: [
      "Start with your body in a straight line from head to heels.",
      "Hinge at the hips to lower your torso toward the floor, keeping your back flat.",
      "Go until you feel a strong stretch in the backs of your thighs.",
      "Squeeze your glutes to lift back up until your body is a straight line again.",
    ],
    cues: ["The movement comes from the hips", "Stop at a straight line at the top", "Hold a plate or dumbbell to your chest to make it harder"],
    mistakes: ["Over-arching the lower back at the top", "Pad set too high so it blocks the hinge", "Swinging up with momentum"],
  },
};
