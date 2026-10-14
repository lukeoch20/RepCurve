import type { Equipment, Muscle, Pattern, Profile, Split, TrainingLevel } from "@repcurve/shared";
import type { SessionKind } from "./types.js";

const SPLIT_WORD: Record<Split, string> = { full_body: "full-body", push_pull: "push/pull", upper_lower: "upper/lower", ppl: "push/pull/legs" };
const SPLIT_WHY: Record<Split, string> = {
  full_body: "Every strength session is full body, so each muscle is trained every session.",
  push_pull: "Sessions alternate push days (chest, shoulders, triceps, quads) and pull days (back, biceps, hamstrings, glutes), so each day can focus.",
  upper_lower: "Sessions alternate upper-body and lower-body days, so each day can focus.",
  ppl: "Sessions rotate push, pull and leg days, so each day goes deep on a few muscles.",
};

export function explain(
  profile: Profile,
  equipment: Equipment,
  level: TrainingLevel,
  template: SessionKind[],
  volume: Record<Muscle, number>,
  target: [number, number],
  hardSetsPerStrengthSession: number,
  extras: { benchmarkWeek: boolean; missingPatterns: Pattern[]; volumeLevel?: TrainingLevel; split?: Split } = { benchmarkWeek: false, missingPatterns: [] },
): string[] {
  const strength = template.filter((k) => k === "strength").length;
  const cardio = template.length - strength;
  const lines: string[] = [];
  const split = extras.split ?? profile.split ?? "full_body";
  const volumeLevel = extras.volumeLevel ?? level;
  lines.push(
    `You train ${template.length} days a week for about ${profile.minutesPerSession} minutes: ${strength} ${SPLIT_WORD[split]} strength session${strength === 1 ? "" : "s"}` +
      (cardio > 0 ? ` and ${cardio} ${equipment.treadmill ? "treadmill" : "walk/jog"} session${cardio === 1 ? "" : "s"}.` : "."),
  );
  lines.push(
    `${SPLIT_WHY[split]} Exercises are paired so one muscle rests while the other works, which is how ${hardSetsPerStrengthSession} hard sets fit in ${profile.minutesPerSession} minutes.`,
  );
  if (split !== (profile.split ?? "full_body")) {
    lines.push(
      `You chose ${SPLIT_WORD[profile.split ?? "full_body"]}, but with ${strength} lifting day${strength === 1 ? "" : "s"} a week most muscles would go a week or more untrained, so your plan runs full body. With 3 or more lifting days it switches to ${SPLIT_WORD[profile.split ?? "full_body"]}.`,
    );
  }
  if (volumeLevel !== level) {
    lines.push(
      `You've trained steadily long enough that your plan now gives each muscle the weekly volume for ${volumeLevel === "advanced" ? "an advanced" : "an intermediate"} lifter, and sessions can run to four sets of an exercise.`,
    );
  }
  const majors: Muscle[] = ["quads", "glutes", "hamstrings", "chest", "back", "shoulders"];
  const under = majors.filter((m) => volume[m] < target[0]);
  const range = `${target[0]}–${target[1]}`;
  let verdict: string;
  if (under.length === 0) verdict = "you are in the range where real progress happens";
  else {
    const list = under.map((m) => `${m} ${Math.round(volume[m])}`).join(", ");
    const small = under.every((m) => volume[m] >= target[0] - 2);
    verdict = small
      ? `a few muscles are a little under (${list}); adding a day or five minutes would close the gap`
      : `some muscles are well under (${list} hard sets a week against ${range}); more days or longer sessions would close the gap, and the plan still works, just more slowly`;
  }
  lines.push(
    `That adds up to roughly ${Math.round(volume.quads)} hard sets for quads, ${Math.round(volume.chest)} for chest and ${Math.round(volume.back)} for back each week. For ${volumeLevel === "intermediate" || volumeLevel === "advanced" ? "an" : "a"} ${volumeLevel} the sweet spot is about ${range} per muscle, so ${verdict}.`,
  );
  if (extras.missingPatterns.length > 0) {
    lines.push(
      `Your week has no ${listOf(extras.missingPatterns.map((p) => PATTERN_NAMES[p]))} work, because of your equipment, injuries or session length. Each superset pairs what is available instead.`,
    );
  }
  if (extras.benchmarkWeek) {
    lines.push(
      "Week 1 is a benchmark week: on the first set of each dumbbell exercise, do as many clean reps as you can, stopping when you could still do about two more. That sets your starting weights for the rest of the block.",
    );
  }
  if (profile.trainingHistory === "never") {
    lines.push("Week 1 runs one round lighter than the rest of the block so you can learn the movements without being wrecked for the next day.");
  }
  lines.push(
    "Progress is automatic: hit the top of a rep range with reps to spare and the next session moves you up (next dumbbell, harder variant, or more reps). Miss the bottom twice and it steps you back.",
  );
  lines.push("Expect the first two weeks to feel awkward and a little sore. Expect weeks three to eight to be where the numbers start moving.");
  return lines;
}

const PATTERN_NAMES: Record<Pattern, string> = {
  squat: "squat",
  hinge: "hip hinge",
  horizontal_push: "push-up or press",
  vertical_push: "overhead press",
  row: "row",
  vertical_pull: "pull-up",
  core: "core",
  isolation: "arm and shoulder",
  cardio: "cardio",
};

function listOf(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`;
}
