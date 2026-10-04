import type { Equipment, Muscle, Profile, TrainingLevel } from "@repcurve/shared";
import type { SessionKind } from "./types.js";

export function explain(
  profile: Profile,
  equipment: Equipment,
  level: TrainingLevel,
  template: SessionKind[],
  volume: Record<Muscle, number>,
  target: [number, number],
  hardSetsPerStrengthSession: number,
): string[] {
  const strength = template.filter((k) => k === "strength").length;
  const cardio = template.length - strength;
  const lines: string[] = [];
  lines.push(
    `You train ${template.length} days a week for about ${profile.minutesPerSession} minutes: ${strength} full-body strength session${strength === 1 ? "" : "s"}` +
      (cardio > 0 ? ` and ${cardio} ${equipment.treadmill ? "treadmill" : "walk/jog"} session${cardio === 1 ? "" : "s"}.` : "."),
  );
  lines.push(
    `Every strength session is full body because short sessions get more from hitting everything often than from splitting body parts across days. Exercises are paired so one muscle rests while the other works, which is how ${hardSetsPerStrengthSession} hard sets fit in ${profile.minutesPerSession} minutes.`,
  );
  const majors: Muscle[] = ["quads", "glutes", "hamstrings", "chest", "back", "shoulders"];
  const inRange = majors.filter((m) => volume[m] >= target[0]);
  lines.push(
    `That adds up to roughly ${Math.round(volume.quads)} hard sets for quads, ${Math.round(volume.chest)} for chest and ${Math.round(volume.back)} for back each week. For a ${level} the sweet spot is about ${target[0]}–${target[1]} per muscle, so ${inRange.length === majors.length ? "you are in the range where real progress happens" : "a few muscles are a little under; adding a day or five minutes would close the gap"}.`,
  );
  if (level === "novice") {
    lines.push(
      "Week 1 is a benchmark week: on the first set of each dumbbell exercise, do as many clean reps as you can, stopping when you could still do about two more. That sets your starting weights for the rest of the block.",
    );
    if (profile.trainingHistory === "never") {
      lines.push("Week 1 runs one round lighter than the rest of the block so you can learn the movements without being wrecked for the next day.");
    }
  }
  lines.push(
    "Progress is automatic: hit the top of a rep range with reps to spare and the next session moves you up (next dumbbell, harder variant, or more reps). Miss the bottom twice and it steps you back.",
  );
  lines.push("Expect the first two weeks to feel awkward and a little sore. Expect weeks three to eight to be where the numbers start moving.");
  return lines;
}
