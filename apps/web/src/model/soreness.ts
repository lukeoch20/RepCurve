import { MUSCLES, soreQuestion, type RecentSession, type SessionPlan, type SoreLevel, type Soreness, type SoreQuestion } from "@repcurve/engine";
import type { Muscle } from "@repcurve/shared";
import type { Core, SessionRecord, SoreCheck } from "./types";

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** Soreness changes by the hour: an answer counts for the session it was given for, within this many hours. */
export const SORE_CHECK_HOURS = 12;

const LEVELS: SoreLevel[] = ["none", "bit", "very"];

/** Strength sessions done, with the exercises actually logged. */
export function recentStrength(history: SessionRecord[]): RecentSession[] {
  return history
    .filter((r) => r.kind === "strength" && !r.skipped && r.sets.length > 0)
    .map((r) => ({ finishedAt: r.finishedAt, exerciseIds: [...new Set(r.sets.map((s) => s.exerciseId))] }));
}

/** What to ask before today's session, if anything: groups today's plan shares with the last three days. */
export function soreQuestionFor(plan: SessionPlan, history: SessionRecord[], now: number): SoreQuestion | null {
  return soreQuestion(plan, recentStrength(history), now);
}

/** The check-in answers for the next session, while they're fresh. */
export function currentSoreCheck(core: Pick<Core, "soreCheck" | "nextIndex">, now: number): SoreCheck | undefined {
  const c = core.soreCheck;
  return c && c.index === core.nextIndex && now - c.at < SORE_CHECK_HOURS * HOUR_MS ? c : undefined;
}

/** The answers that shape the next session (and are saved with it). */
export function currentSoreness(core: Pick<Core, "soreCheck" | "nextIndex">, now: number): Soreness[] | undefined {
  return currentSoreCheck(core, now)?.answers;
}

/**
 * Save an answer to "Still sore?": `level` for the groups picked (all of `asked` for "not sore"), and
 * "not sore" for the rest of the groups asked about.
 */
export function answerSoreness(core: Core, asked: Muscle[], level: SoreLevel, picked: Muscle[], now: number): Core {
  const answers = asked.map((group) => ({ group, level: level !== "none" && picked.includes(group) ? level : ("none" as SoreLevel) }));
  return { ...core, soreCheck: { index: core.nextIndex, at: now, level, answers } };
}

/** How the check-in names the session the soreness is from. */
export function soreFrom(since: number, now: number): string {
  const startOf = (t: number) => {
    const d = new Date(t);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  const days = Math.round((startOf(now) - startOf(since)) / DAY_MS);
  if (days <= 0) return "your earlier session today";
  if (days === 1) return "yesterday's session";
  return `${new Date(since).toLocaleDateString(undefined, { weekday: "long" })}'s session`;
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

/** Check-in answers from storage, keeping only ones this version understands. */
export function migrateSoreness(x: unknown): Soreness[] | undefined {
  if (!Array.isArray(x)) return undefined;
  const out = x.filter((s): s is Soreness => isObj(s) && MUSCLES.includes(s["group"] as Muscle) && LEVELS.includes(s["level"] as SoreLevel));
  return out.length > 0 ? out.map((s) => ({ group: s.group, level: s.level })) : undefined;
}

export function migrateSoreCheck(x: unknown): SoreCheck | undefined {
  if (!isObj(x) || !isNum(x["index"]) || !isNum(x["at"]) || !LEVELS.includes(x["level"] as SoreLevel)) return undefined;
  const answers = migrateSoreness(x["answers"]);
  return answers ? { index: x["index"], at: x["at"], level: x["level"] as SoreLevel, answers } : undefined;
}
