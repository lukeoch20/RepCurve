import type { ExerciseChange, Prescription } from "@repcurve/engine";
import { findExercise } from "@repcurve/exercises";
import { formatLoad } from "@repcurve/shared";
import type { LoadType, Units } from "@repcurve/shared";
import type { ActiveSession, SessionRecord } from "./types";

const nameOf = (id: string) => findExercise(id)?.name ?? id;

/** The newest session that set up an exercise: it was progressed there, or moved onto from another. */
export function lastChangeFor(exerciseId: string, history: SessionRecord[]): { record: SessionRecord; change: ExerciseChange } | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const record = history[i]!;
    if (record.skipped || record.kind !== "strength") continue;
    const change = record.changes.find((c) => c.nextExerciseId === exerciseId && c.action !== "skipped");
    if (change) return { record, change };
  }
  return null;
}

/** "Last time: 12, 12, 12 reps at 20 lb." The planned sets, as progression judged them. */
function lastTime(record: SessionRecord, change: ExerciseChange, loadType: LoadType, units: Units): string | null {
  const sets = record.sets.filter((s) => s.exerciseId === change.exerciseId && !s.extra).sort((a, b) => a.setIndex - b.setIndex);
  const last = sets.at(-1);
  if (!last) return null;
  const on = change.exerciseId !== change.nextExerciseId ? ` on ${nameOf(change.exerciseId)}` : "";
  const reps = `${sets.map((s) => s.reps).join(", ")} ${loadType === "time" ? "s" : "reps"}`;
  const kind = findExercise(change.exerciseId)?.loadType ?? loadType;
  return `Last time${on}: ${reps}${last.loadKg !== null ? ` at ${formatLoad(last.loadKg, kind, units)}` : ""}.`;
}

/** Why the last session led to today's numbers. The engine's reasons look ahead ("next time"); these read from today. */
function because(change: ExerciseChange, loadType: LoadType): string {
  const reps = change.next.targetReps;
  switch (change.action) {
    case "add_rep":
      if (loadType === "time") return "Same hold today; add a few seconds if you can.";
      return `${change.next.loadKg !== null ? "Same weight" : "Same again"}, one more rep: aim for ${reps} today.`;
    case "stall_noted":
      return "That one was tough, so it's the same plan today. If it's tough again, it eases off.";
    default:
      return change.reason;
  }
}

/**
 * Where an exercise's prescribed load and reps came from, in a few short lines: a benchmark still
 * to do, or the last session's result and what it changed, then anything adjusting it today
 * (a swap, a deload, a comeback, a recent pain).
 */
export function whyThisLoad(p: Prescription, active: ActiveSession, history: SessionRecord[], units: Units): string[] {
  const lines: string[] = [];
  const fmt = (kg: number) => formatLoad(kg, p.loadType, units);
  const swap = [...(active.swaps ?? [])].reverse().find((s) => s.slot === p.slot && s.to === p.exerciseId);
  if (swap) lines.push(`Swapped in for ${nameOf(swap.from)} today.`);
  if (p.benchmarkSet) {
    // A re-test of an exercise already done starts from its working weight, not a first guess.
    const doneBefore = history.some((r) => r.sets.some((x) => x.exerciseId === p.exerciseId));
    lines.push(
      p.loadKg !== null && doneBefore
        ? `Re-test: ${fmt(p.loadKg)} is your current working weight. Your first set, as many clean reps as you can with about 2 left, resets it.`
        : p.loadKg !== null
        ? `Benchmark: ${fmt(p.loadKg)} is a first guess from your body weight, experience and equipment. Your first set, as many clean reps as you can with about 2 left, sets your working weight.`
        : "Benchmark: your first set, as many clean reps as you can with about 2 left, sets your target from here.",
    );
    return lines;
  }
  const last = lastChangeFor(p.exerciseId, history);
  if (!last) {
    lines.push(
      p.loadKg !== null
        ? `First time: ${fmt(p.loadKg)} is a first guess from your body weight, experience and equipment. Change it if it feels off; it adjusts from what you do.`
        : `First time: ${p.targetReps} ${p.loadType === "time" ? "seconds" : "reps"} is a starting point. Change it if it feels off; it adjusts from what you do.`,
    );
  } else {
    const seen = lastTime(last.record, last.change, p.loadType, units);
    if (seen) lines.push(seen);
    lines.push(because(last.change, p.loadType));
  }
  if (active.plan.deload) lines.push("Deload week: a step lighter and one set fewer while you recover.");
  else if (active.plan.comeback) lines.push("Welcome back: a step lighter after the break.");
  else if (last && p.loadKg !== null && last.change.next.loadKg !== null && Math.abs(p.loadKg - last.change.next.loadKg) > 1e-6) {
    lines.push(`${fmt(p.loadKg)} is the nearest your equipment allows.`);
  }
  if (p.caution) lines.push(`Your ${p.caution.toLowerCase()} hurt recently, so this stays at a steady weight until it's had a couple of pain-free sessions.`);
  else if (p.painCheck && last?.change.action !== "pain") lines.push("It hurt recently, so nothing gets heavier until a session goes by without pain.");
  return lines;
}
