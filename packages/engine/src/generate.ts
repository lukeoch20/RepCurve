import { buildCardioSession } from "./cardio.js";
import { explain } from "./explain.js";
import { trainingLevel, volumeTarget } from "./level.js";
import { buildPool } from "./pool.js";
import { buildStrengthSession } from "./session.js";
import { weeklyTemplate } from "./template.js";
import type { GenerateInput, GenerateOptions, Program, SessionPlan } from "./types.js";
import { hardSets, weeklyVolume } from "./volume.js";

export function generateProgram(input: GenerateInput, opts: GenerateOptions = {}): Program {
  const { profile, equipment } = input;
  const weeks = opts.weeks ?? 4;
  const e1rmByExercise = opts.e1rmByExercise ?? {};
  const level = trainingLevel(profile);
  const pool = buildPool(equipment, profile.injuries);
  const template = weeklyTemplate(profile.daysPerWeek, profile.goal, equipment);
  const baseRounds = 3;

  const sessions: SessionPlan[] = [];
  for (let week = 1; week <= weeks; week++) {
    const rampWeek = week === 1 && profile.trainingHistory === "never";
    let strengthIndex = 0;
    let cardioIndex = 0;
    template.forEach((kind, dayIndex) => {
      if (kind === "strength") {
        const base = {
          profile,
          equipment,
          level,
          pool,
          strengthIndex: strengthIndex++,
          week,
          dayIndex,
          benchmark: week === 1,
          e1rmByExercise,
        };
        const steady = buildStrengthSession({ ...base, rounds: baseRounds });
        if (rampWeek) {
          // Same exercises and superset count as the steady weeks, one round lighter.
          sessions.push(
            buildStrengthSession({
              ...base,
              rounds: baseRounds - 1,
              maxRounds: baseRounds - 1,
              maxSupersets: steady.supersets.length,
            }),
          );
        } else {
          sessions.push(steady);
        }
      } else {
        sessions.push(buildCardioSession({ profile, equipment, level, cardioIndex: cardioIndex++, week, dayIndex }));
      }
    });
  }

  const steadyWeek = sessions.filter((s) => s.week === Math.min(2, weeks));
  const volume = weeklyVolume(steadyWeek);
  const target = volumeTarget(level);
  const strengthSessions = steadyWeek.filter((s) => s.kind === "strength");
  const avgHardSets = strengthSessions.length
    ? Math.round(strengthSessions.reduce((n, s) => n + hardSets(s), 0) / strengthSessions.length)
    : 0;

  return {
    createdAt: opts.createdAt ?? new Date().toISOString(),
    level,
    weeks,
    template,
    sessions,
    weeklyVolume: volume,
    volumeTarget: target,
    explanation: explain(profile, equipment, level, template, volume, target, avgHardSets),
  };
}
