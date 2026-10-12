/**
 * The tutorial: short tips that point at a feature the first time it appears, explaining
 * lifting basics and how RepCurve works. Each is shown once, in this order.
 */

export type TipKind = "lifting" | "app";

export interface Tip {
  id: string;
  kind: TipKind;
  title: string;
  body: string;
}

export const TIPS = [
  // Today, before the first session
  {
    id: "today.welcome",
    kind: "app",
    title: "Welcome to RepCurve",
    body: "Tips like this one point out how lifting and the app work, the first time you meet each thing. Tap Got it to move on, or Skip all tips if you know your way around.",
  },
  {
    id: "today.week",
    kind: "app",
    title: "Your week",
    body: "These are this week's sessions, in order. They aren't tied to days of the week: if you miss a day, the next session simply waits for you.",
  },
  {
    id: "today.split",
    kind: "lifting",
    title: "Your split",
    body: "Your lifting days take turns: a push day, then a pull day, and so on, each focused on a few muscles. Change your split any time in Settings, under Edit profile, schedule and equipment.",
  },
  {
    id: "today.benchmark",
    kind: "lifting",
    title: "You don't need to know your strength",
    body: "The first time you do an exercise, its first set is a test: as many good reps as you can, stopping with about two left. RepCurve picks your working weight from that.",
  },
  {
    id: "today.superset",
    kind: "lifting",
    title: "Supersets: exercises in pairs",
    body: "A1 and A2 are a pair. Do a set of A1, switch straight to A2, then rest and go back to A1 for the next set. One muscle rests while the other works, so a full workout fits in less time.",
  },
  {
    id: "today.dose",
    kind: "lifting",
    title: "Sets and reps",
    body: "2 × 10 means 2 sets of 10 reps. A rep is one full movement, down and back up. A set is a run of reps without stopping. \"Each\" means the weight of each dumbbell.",
  },
  {
    id: "today.howto",
    kind: "app",
    title: "Not sure how to do one?",
    body: "Tap any underlined exercise for step-by-step instructions, what you should feel, and the common mistakes to avoid.",
  },
  {
    id: "today.time",
    kind: "app",
    title: "Short on time, or have extra?",
    body: "Change today's length from 10 to 40 minutes. Less time drops exercises; more time adds them. Your usual length stays as it is.",
  },

  // During a strength session
  {
    id: "run.warmup",
    kind: "lifting",
    title: "Warm up first",
    body: "A couple of minutes of easy movement and a light practice set get your muscles and joints ready, so your first real set feels better. Tick each one off as you go.",
  },
  {
    id: "run.set",
    kind: "app",
    title: "Log what you actually did",
    body: "This is your set. Use − and + to record the weight and the reps you really did, even if they differ from the plan. Next time is planned from what you log.",
  },
  {
    id: "run.effort",
    kind: "lifting",
    title: "Reps left in the tank",
    body: "After each set, ask: how many more good reps could I have done? \"2 left\" is the sweet spot: hard, but clean. \"Max\" means you couldn't do another. This is how RepCurve knows when to add weight.",
  },
  {
    id: "run.done",
    kind: "app",
    title: "Done moves you along",
    body: "Tap Done when the set is finished. In a pair, a short switch timer starts and you head to the other exercise. Its first set opens on its own.",
  },
  {
    id: "run.switch",
    kind: "lifting",
    title: "Switch to the other exercise",
    body: "This short timer is your time to get to the second exercise of the pair. After it comes a longer rest, then you're back on the first exercise for set 2. Up next always shows what's coming.",
  },
  {
    id: "run.rest",
    kind: "lifting",
    title: "Rest between rounds",
    body: "Rest lets your muscles recover so the next set is strong. Use +15 s if you need longer, or Skip if you're ready. Tap the ring to change your usual rest.",
  },
  {
    id: "run.hurt",
    kind: "lifting",
    title: "Burn is fine, pain is not",
    body: "A burning, tired feeling in the muscle is normal. Sharp pain, or pain in a joint, means stop: tap It hurt. That exercise stops for today, and next time it's a step lighter with a check-in before you start.",
  },
  {
    id: "run.menu",
    kind: "app",
    title: "Swap or skip",
    body: "Exercise doesn't suit you today? Swap trades it for another that trains the same movement. Skip leaves it out of this session only.",
  },
  {
    id: "run.head",
    kind: "app",
    title: "Pause or end any time",
    body: "Pause stops the clock and timers. The bar fills as you log sets. End lets you finish early, and every set you've logged still counts.",
  },

  // Cardio
  {
    id: "cardio.effort",
    kind: "lifting",
    title: "Effort out of 10",
    body: "Cardio is planned by effort, not speed. Up to 3/10 is easy: you could chat the whole time. 4 to 6 is steady: you can talk in short sentences. 7 and up is hard: a few words at a time. Go by feel.",
  },

  // After a session
  {
    id: "finished.next",
    kind: "app",
    title: "How you get stronger",
    body: "RepCurve compares what you did with the plan. A rep more, or a little more weight, comes once a set feels easier than planned. A tough session holds things steady. Small steps add up.",
  },

  // Other tabs
  {
    id: "plan.week",
    kind: "app",
    title: "The plan",
    body: "Every session of this week, with what's done and what's next. Tap a session to see its exercises.",
  },
  {
    id: "progress.charts",
    kind: "app",
    title: "Your progress",
    body: "Sessions, minutes and your weekly streak, then a chart for each lift that fills in as you train. Tap or drag across a chart to read any point.",
  },
] as const satisfies readonly Tip[];

export type TipId = (typeof TIPS)[number]["id"];

export function tipById(id: TipId): Tip {
  return TIPS.find((t) => t.id === id)!;
}

/** The tip to show now: the first in tutorial order that's on screen and not yet seen. */
export function nextTip(available: ReadonlySet<TipId>, seen: ReadonlySet<string>, off: boolean): TipId | null {
  if (off) return null;
  return TIPS.find((t) => available.has(t.id) && !seen.has(t.id))?.id ?? null;
}
