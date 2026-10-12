import type { HowTo } from "./howto.js";

const SWITCH = "Do all your reps on one side, then switch sides. That's one set.";

export const HOW_TO_GYM: Record<string, HowTo> = {
  // ---------------- Horizontal push ----------------
  machine_chest_press: {
    setup: "Set the seat height so the handles line up with the middle of your chest. Put the pin in a light weight on the stack. Sit with your back flat against the pad and feet flat on the floor.",
    steps: [
      "Grip the handles, squeeze your shoulder blades together and down, and brace your stomach. If there's a foot lever, use it to bring the handles forward to start.",
      "Push the handles forward until your arms are nearly straight, without locking your elbows hard.",
      "Bring them back slowly until you feel a gentle stretch across the chest, elbows about 45° from your body.",
      "Stop just before the weight plates touch, then press again.",
    ],
    cues: ["Back and head stay on the pad", "Wrists straight, stacked behind the handles", "Smooth push, slow return"],
    mistakes: ["Seat too low or too high, so the handles end up at your neck or stomach", "Letting the plates crash down between reps", "Shoulders rolling forward off the pad at the end of the push"],
  },
  cable_chest_fly: {
    setup: "Set both pulleys of a dual cable station to about shoulder height and clip a D-handle to each. Put the pin in the same light weight on both stacks. Hold a handle in each hand and step forward into a split stance until the weights lift slightly off the stacks.",
    steps: [
      "Start with your arms out to the sides, elbows softly bent and palms facing forward.",
      "Keep that elbow bend fixed and bring your hands together in front of your chest in a wide hug.",
      "Squeeze your chest for a second with your hands just touching.",
      "Let your arms open slowly back out until you feel a gentle stretch across the chest, keeping the weights from touching down.",
    ],
    cues: ["Elbows stay softly bent, like hugging a big tree", "Chest stays up and proud", "Arms move in an arc, not a push"],
    mistakes: ["Bending and straightening the elbows so it turns into a press", "Opening too far, past a comfortable stretch", "Letting the cables snap back and the plates bang down"],
  },

  // ---------------- Vertical push ----------------
  machine_shoulder_press: {
    setup: "Set the seat height so the handles start at about shoulder height or just above. Put the pin in a light weight on the stack. Sit with your back flat against the pad and feet flat on the floor.",
    steps: [
      "Grip the handles and brace your stomach.",
      "Press the handles up until your arms are nearly straight overhead.",
      "Lower them slowly back to about shoulder height.",
      "Stop just before the plates touch, then press again.",
    ],
    cues: ["Back stays against the pad", "Ribs down, no arching", "Wrists stacked over elbows"],
    mistakes: ["Seat so low that the handles start well below your shoulders", "Arching the lower back to finish the rep", "Letting the plates crash down between reps"],
  },

  // ---------------- Isolation (shoulders) ----------------
  cable_lateral_raise: {
    setup: "Set a single cable pulley to its lowest position and clip on a D-handle. Put the pin in the lightest weight. Stand side-on to the machine and hold the handle in the hand furthest from it, so the cable runs across the front of your body. Steady yourself on the machine with your other hand.",
    steps: [
      "Start with your working arm hanging down in front of your hips, elbow slightly bent.",
      "Raise your arm out to the side until it's about shoulder height, leading with the elbow.",
      "Pause briefly, then lower slowly until the weight is just above the stack.",
      SWITCH,
    ],
    cues: ["Shoulders stay down, no shrugging", "Body stays still and upright", "Light weight, steady tension the whole time"],
    mistakes: ["Leaning away from the machine to heave the weight up", "Raising above shoulder height with a shrug", "Letting the plates clang down at the bottom"],
  },
  reverse_pec_deck: {
    setup: "Sit facing the pad with your chest against it. Set the seat height so the handles are level with your shoulders, and set the handles to the front (rear-delt) position. Put the pin in a light weight on the stack.",
    steps: [
      "Grip the handles with your arms straight out in front of you, elbows softly bent.",
      "Sweep your arms out and back in a wide arc until your hands are roughly in line with your body.",
      "Pause for a second and squeeze the backs of your shoulders.",
      "Bring your arms back slowly, stopping just before the plates touch.",
    ],
    cues: ["Chest stays on the pad", "Lead with the backs of your hands", "Shoulders stay down away from your ears"],
    mistakes: ["Pulling the chest off the pad to use your back", "Shrugging up toward your ears", "Using too much weight so the arms bend and jerk"],
  },

  // ---------------- Isolation (triceps) ----------------
  cable_triceps_pressdown: {
    setup: "Set a cable pulley to its highest position and clip on a straight bar or rope. Put the pin in a light weight. Stand close to the machine, feet hip-width apart, and grip the attachment with your elbows bent at your sides.",
    steps: [
      "Lean forward very slightly and brace your stomach.",
      "Keeping your elbows pinned to your sides, push the attachment down until your arms are straight. With a rope, spread the ends apart at the bottom.",
      "Squeeze the backs of your arms for a second.",
      "Let your forearms rise slowly back up to just above 90°, keeping the weight off the stack.",
    ],
    cues: ["Only the forearms move", "Elbows stay glued to your sides", "Slow on the way up"],
    mistakes: ["Elbows drifting forward and the shoulders joining in", "Leaning your bodyweight over the attachment to push it down", "Letting the cable yank your hands up and the plates bang"],
  },
  cable_overhead_triceps_extension: {
    setup: "Set a cable pulley to about chest or head height and clip on a rope. Put the pin in a light weight. Hold one end of the rope in each hand, turn to face away from the stack and step forward into a split stance with your hands behind your head and elbows pointing forward.",
    steps: [
      "Lean forward slightly and brace your stomach.",
      "Keeping your upper arms close to your head, straighten your arms forward and up until they're fully extended.",
      "Bend your elbows slowly to let the rope come back behind your head.",
      "Stop at a comfortable stretch, keeping the weight from touching down.",
    ],
    cues: ["Elbows stay in close and point forward", "Ribs down, no arching", "Feel the stretch at the bottom"],
    mistakes: ["Elbows flaring wide", "Arching the lower back", "Letting the rope pull your arms back fast"],
  },

  // ---------------- Vertical pull ----------------
  lat_pulldown: {
    setup: "Clip a wide bar to the top pulley. Sit facing the machine and set the thigh pads so they hold your legs snugly with feet flat. Put the pin in a light weight. Stand up to grab the bar slightly wider than your shoulders, palms facing away, then sit back down under the pads.",
    steps: [
      "Lean back slightly and pull your shoulders down away from your ears.",
      "Pull the bar down to your upper chest, driving your elbows down toward your ribs.",
      "Squeeze your shoulder blades together briefly.",
      "Let the bar rise slowly until your arms are straight, keeping the plates from touching.",
    ],
    cues: ["Chest up toward the bar", "Elbows drive down and back", "Torso stays still, no rocking"],
    mistakes: ["Pulling the bar behind your neck", "Rocking back a long way to swing the weight down", "Letting the bar fly up so the plates slam"],
  },
  assisted_pull_up_machine: {
    setup: "Choose the assistance with the pin: more weight on the stack means more help, so start with plenty. Climb the steps, grip the top handles (wide or close, palms facing away or in), then carefully kneel or stand on the platform, depending on the machine.",
    steps: [
      "Start with your arms straight and your shoulders pulled down away from your ears.",
      "Pull yourself up until your chin clears the handles, chest leading.",
      "Lower slowly to straight arms.",
      "When you're done, step back onto the steps from the top position before letting go.",
    ],
    cues: ["Less weight on the stack = harder; reduce the help over time", "Elbows drive down toward your ribs", "Body steady, no kicking"],
    mistakes: ["Stepping off the platform at the bottom so it shoots up", "Bouncing off the platform at the bottom of each rep", "Keeping the same assistance forever instead of slowly reducing it"],
  },

  // ---------------- Row ----------------
  seated_cable_row: {
    setup: "Clip a close-grip (V) handle to the low cable at the seated row station. Put the pin in a light weight. Sit with your feet on the footplates, knees softly bent, and grab the handle. Sit up tall with your arms straight.",
    steps: [
      "Brace your stomach and keep your chest up.",
      "Pull the handle toward your belly button, elbows close to your body.",
      "Squeeze your shoulder blades together at the end.",
      "Let your arms straighten slowly, keeping the weight off the stack.",
    ],
    cues: ["Torso stays tall and still", "Elbows drive back past your sides", "Shoulders down, away from your ears"],
    mistakes: ["Rocking back and forth to heave the weight", "Rounding your back as your arms go forward", "Letting the handle pull you forward and the plates bang"],
  },
  chest_supported_machine_row: {
    setup: "Set the seat height and chest pad so the handles are about level with your lower chest and you can just reach them with straight arms. Put the pin in a light weight, or load equal plates on each side. Sit with your chest firmly against the pad.",
    steps: [
      "Grip the handles and pull your shoulders down away from your ears.",
      "Pull the handles back, driving your elbows past your sides.",
      "Squeeze your shoulder blades together for a second.",
      "Let your arms straighten slowly, stopping before the weight touches down.",
    ],
    cues: ["Chest stays on the pad", "Pull with the elbows, not the hands", "Smooth pull, slow return"],
    mistakes: ["Lifting the chest off the pad to jerk the weight", "Shrugging the shoulders up", "Letting the weight crash down between reps"],
  },

  // ---------------- Isolation (biceps) ----------------
  machine_preacher_curl: {
    setup: "Set the seat height so your armpits sit snugly over the top of the arm pad and your elbows line up with the machine's pivot. Put the pin in a light weight. Grip the handles, palms facing up.",
    steps: [
      "Keep the backs of your upper arms flat on the pad.",
      "Curl the handles up toward your shoulders.",
      "Squeeze at the top, then lower slowly.",
      "Stop just short of locking your elbows at the bottom, keeping the weight off the stack.",
    ],
    cues: ["Only the forearms move", "Upper arms stay pressed into the pad", "Slow lowering"],
    mistakes: ["Seat too low, so your elbows sit away from the pivot", "Letting the weight drop fast at the bottom", "Lifting your bottom or leaning back to cheat the weight up"],
  },

  // ---------------- Squat ----------------
  leg_press: {
    setup: "Set the back pad so you can bend your knees comfortably without your lower back lifting. Load equal plates on each side, or set the pin on a stacked machine; start light. Sit with your back flat on the pad and feet shoulder-width apart in the middle of the platform.",
    steps: [
      "Press the platform up slightly and release the safety catches or stops.",
      "Lower the platform slowly by bending your knees toward your chest.",
      "Stop before your lower back or hips start to peel off the pad.",
      "Push through your whole foot until your legs are nearly straight, without locking your knees hard.",
      "After your last rep, re-engage the safety catches before you take your feet off.",
    ],
    cues: ["Lower back stays on the pad", "Knees follow the line of your toes", "Heels stay on the platform"],
    mistakes: ["Snapping the knees straight at the top", "Going so deep that your lower back rounds off the pad", "Letting the sled slam into the stops"],
  },
  hack_squat_machine: {
    setup: "Load equal plates on each side; start light. Step onto the platform with your back flat against the back pad and your shoulders under the shoulder pads. Feet shoulder-width apart in the middle of the platform, toes turned out slightly.",
    steps: [
      "Push up slightly to take the weight and release the safety handles.",
      "Brace your stomach and bend your knees to lower yourself slowly.",
      "Go as deep as you can while your heels stay down and your back stays on the pad.",
      "Push through your whole foot to stand back up without locking your knees hard.",
      "After your last rep, re-engage the safety handles before stepping out.",
    ],
    cues: ["Back and hips stay against the pad", "Knees follow the line of your toes", "Control the way down"],
    mistakes: ["Forgetting to put the safety handles back on before stepping out", "Heels lifting off the platform", "Bouncing out of the bottom"],
  },
  smith_machine_squat: {
    setup: "Set the safety stops just below the lowest point of your squat, and the bar hooks at about shoulder height. Load equal plates on each side; start light. Step under the bar so it rests across your upper back, not your neck, then place your feet shoulder-width apart and slightly in front of the bar.",
    steps: [
      "Stand up to lift the bar and twist it to unhook it.",
      "Brace your stomach and sit your hips down and back between your heels.",
      "Go as low as you can with your heels down and back flat, staying above the safety stops.",
      "Push through your whole foot to stand back up.",
      "After your last rep, twist the bar to hook it back on.",
    ],
    cues: ["Bar stays on your upper back", "Knees follow the line of your toes", "Chest up, weight across the whole foot"],
    mistakes: ["Skipping the safety stops", "Feet directly under the bar, which pushes the knees far forward", "Rounding the back at the bottom"],
  },

  // ---------------- Isolation (legs) ----------------
  leg_extension: {
    setup: "Set the back pad so your knees line up with the machine's pivot (often marked with a coloured dot). Set the ankle pad so it sits on your lower shins, just above your ankles. Put the pin in a light weight. Sit back and hold the side handles.",
    steps: [
      "Brace your stomach and keep your back against the pad.",
      "Straighten your legs until they're nearly straight.",
      "Squeeze the fronts of your thighs for a second.",
      "Lower slowly, stopping before the plates touch.",
    ],
    cues: ["Knees stay lined up with the pivot", "Bottom stays on the seat", "Slow on the way down"],
    mistakes: ["Back pad set wrong, so your knees are in front of or behind the pivot", "Kicking the weight up with momentum", "Letting the weight drop and the plates bang"],
  },
  machine_hip_thrust: {
    setup: "Set the back pad so it sits just below your shoulder blades, and fasten the belt or lower the pad across your hips. Put the pin in a light weight, or load equal plates. Plant your feet flat, hip-width apart, so your shins are about vertical at the top.",
    steps: [
      "Tuck your chin slightly and brace your stomach.",
      "Drive through your heels to lift your hips until your thighs are level with your torso.",
      "Squeeze your glutes for a second at the top.",
      "Lower under control, stopping before the weight touches down.",
    ],
    cues: ["Upper back pivots on the pad", "Ribs stay down", "Push through the heels"],
    mistakes: ["Arching the lower back to finish the rep", "Feet too close or too far away", "Dropping the weight so it crashes down"],
  },
  seated_leg_curl: {
    setup: "Set the back pad so your knees line up with the machine's pivot. Set the lower pad so it sits behind your legs just above your heels, then lower the thigh pad until it's snug on top of your thighs. Put the pin in a light weight.",
    steps: [
      "Sit back and hold the side handles.",
      "Curl your heels down and under you as far as you comfortably can.",
      "Squeeze the backs of your thighs for a second.",
      "Let your legs straighten slowly, stopping before the plates touch.",
    ],
    cues: ["Knees stay lined up with the pivot", "Thighs stay pinned under the pad", "Slow on the way back"],
    mistakes: ["Thigh pad left loose so your legs lift", "Swinging the weight with quick, short reps", "Letting the weight snap your legs straight"],
  },
  lying_leg_curl: {
    setup: "Set the ankle pad so it sits just above your heels. Put the pin in a light weight. Lie face down with your knees just off the edge of the pad so they line up with the machine's pivot, and hold the handles.",
    steps: [
      "Press your hips gently into the pad.",
      "Curl your heels up toward your bottom as far as you comfortably can.",
      "Squeeze the backs of your thighs for a second.",
      "Lower slowly, stopping before the plates touch.",
    ],
    cues: ["Hips stay down on the pad", "Knees stay just off the pad edge", "Slow on the way down"],
    mistakes: ["Hips lifting off the pad to cheat the weight up", "Knees on the pad instead of just off the edge", "Letting the weight drop and the plates bang"],
  },

  // ---------------- Calves ----------------
  standing_machine_calf_raise: {
    setup: "Set the shoulder pads so you have to bend your knees slightly to get under them. Put the pin in a light weight. Stand with your shoulders under the pads and the balls of your feet on the edge of the platform, heels hanging off.",
    steps: [
      "Straighten your legs to take the weight, keeping your knees straight but not locked.",
      "Lower your heels slowly until you feel a stretch in your calves.",
      "Rise up onto your toes as high as you can.",
      "Pause at the top, then lower slowly.",
    ],
    cues: ["Full stretch at the bottom, full squeeze at the top", "Knees stay straight; the ankles do the work", "Slow on the way down"],
    mistakes: ["Bouncing at the bottom", "Bending the knees to push the weight up", "Feet slipping off the edge: keep the balls of your feet firmly on it"],
  },
  seated_machine_calf_raise: {
    setup: "Sit with the balls of your feet on the platform edge, heels hanging off. Set the knee pad so it's snug on top of your thighs just above your knees. Put the pin in a light weight, or load equal plates.",
    steps: [
      "Push up onto your toes slightly and release the safety lever.",
      "Lower your heels slowly until you feel a stretch in your calves.",
      "Rise up onto your toes as high as you can and pause.",
      "After your last rep, push up and re-engage the safety lever.",
    ],
    cues: ["Full stretch at the bottom, full squeeze at the top", "Slow and steady", "Pressure through the big toe"],
    mistakes: ["Bouncing at the bottom", "Short, quick reps", "Taking your feet off before the safety lever is back on"],
  },

  // ---------------- Hips ----------------
  hip_abduction_machine: {
    setup: "Set the leg pads to the narrowest start position. Put the pin in a light weight. Sit with your back against the pad and place your legs so the pads rest on the outside of your knees. Hold the side handles.",
    steps: [
      "Brace your stomach and sit tall.",
      "Push your knees apart as far as you comfortably can.",
      "Pause for a second and squeeze the sides of your hips.",
      "Bring your legs back together slowly, stopping before the plates touch.",
    ],
    cues: ["Back stays on the pad", "Push with the outside of the knees", "Slow on the way back"],
    mistakes: ["Rocking the body to swing the pads apart", "Letting the weight snap your legs back together", "Short, jerky reps"],
  },
  hip_adduction_machine: {
    setup: "Set the leg pads to a start width that gives a comfortable stretch in your inner thighs, not a strain. Put the pin in a light weight. Sit with your back against the pad and the pads on the inside of your knees. Hold the side handles.",
    steps: [
      "Brace your stomach and sit tall.",
      "Squeeze your legs together until the pads nearly meet.",
      "Pause for a second.",
      "Let your legs open slowly back to the start width, stopping before the plates touch.",
    ],
    cues: ["Back stays on the pad", "Squeeze with the inner thighs", "Slow on the way out"],
    mistakes: ["Starting too wide and straining the groin", "Letting the weight pull your legs open fast", "Rocking the body to help"],
  },
};
