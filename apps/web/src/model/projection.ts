import { generateProgram, project, type LiftObservation, type Program, type Projection } from "@repcurve/engine";
import { findExercise } from "@repcurve/exercises";
import { e1RM } from "@repcurve/shared";
import type { Equipment, Profile } from "@repcurve/shared";
import { currentProgram } from "./plan";
import { DEFAULT_SETTINGS, type Core, type SessionRecord, type Settings } from "./types";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function weeksSince(iso: string, now: number): number {
  return Math.max(0, (now - Date.parse(iso)) / WEEK_MS);
}

/** Projection for a profile and equipment before any training (onboarding preview). */
export function previewProjection(profile: Profile, equipment: Equipment, settings: Settings = DEFAULT_SETTINGS): Projection {
  const program = previewProgram(profile, equipment, settings);
  const cardioMinutes = program.template.filter((k) => k === "cardio").length * profile.minutesPerSession;
  return project({ profile, weeklyVolume: program.weeklyVolume, template: program.template, cardioMinutesPerWeek: cardioMinutes });
}

/** The programme a new user would get, with the same rest and switch times as their real sessions. */
export function previewProgram(profile: Profile, equipment: Equipment, settings: Settings = DEFAULT_SETTINGS): Program {
  return generateProgram({ profile, equipment }, { weeks: 2, createdAt: "preview", restSec: settings.restSec, transitionSec: settings.transitionSec });
}

/** Best estimated 1RM per loaded exercise per session, timed in weeks since the start. */
export function liftObservations(history: SessionRecord[], startedAt: string): LiftObservation[] {
  const start = Date.parse(startedAt);
  const out: LiftObservation[] = [];
  for (const r of history) {
    if (r.kind !== "strength" || r.skipped || r.deload || r.comeback) continue;
    const best = new Map<string, number>();
    for (const s of r.sets) {
      if (s.loadKg === null || s.reps <= 0 || (findExercise(s.exerciseId)?.pattern ?? "core") === "core") continue;
      best.set(s.exerciseId, Math.max(best.get(s.exerciseId) ?? 0, e1RM(s.loadKg, s.reps, s.rir)));
    }
    for (const [exerciseId, e1rmKg] of best) out.push({ exerciseId, week: (r.finishedAt - start) / WEEK_MS, e1rmKg });
  }
  return out;
}

/**
 * Share of planned sessions done, counted from the first session (not from setup) and only
 * once two full weeks have passed, so a late start or the first days don't drag it down.
 */
export function adherence(core: Core, history: SessionRecord[], now: number): number | undefined {
  const first = history.find((r) => !r.skipped);
  if (!first) return undefined;
  const weeks = (now - first.startedAt) / WEEK_MS;
  if (weeks < 2) return undefined;
  const planned = weeks * core.profile.daysPerWeek;
  const done = history.filter((r) => !r.skipped && r.finishedAt >= first.startedAt).length;
  return Math.min(1, done / planned);
}

export function userProjection(core: Core, history: SessionRecord[], now: number): Projection {
  const { profile, equipment } = core;
  const program = currentProgram(core);
  const cardioMinutes = program.template.filter((k) => k === "cardio").length * profile.minutesPerSession;
  const a = adherence(core, history, now);
  return project({
    profile,
    weeklyVolume: program.weeklyVolume,
    template: program.template,
    cardioMinutesPerWeek: cardioMinutes,
    weeksIn: weeksSince(core.startedAt, now),
    lifts: liftObservations(history, core.startedAt),
    ...(a !== undefined ? { adherence: a } : {}),
  });
}

export const NOTICE: Record<number, string> = {
  4: "The moves feel smoother and the weights feel lighter. Most early strength is your nervous system learning the lifts.",
  8: "Clear strength gains on every lift. Stairs, carrying kids and getting off the floor feel easier.",
  12: "Clothes may fit differently through the shoulders and legs. People who see you often may notice before the scale does.",
  26: "Most people who keep going see a visible change in shoulders, back and legs. Progress slows a little, which is normal.",
  52: "A noticeably stronger, more muscular version of the person who started, especially upper back, shoulders and legs. Gains keep coming, more slowly.",
};
