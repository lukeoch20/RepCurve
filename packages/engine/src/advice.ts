import { getExercise } from "@repcurve/exercises";
import { e1RM, formatLoad, nextOwnedLoad, prevOwnedLoad, repsAtLoad } from "@repcurve/shared";
import type { SetLog } from "@repcurve/shared";
import type { EngineContext } from "./context.js";
import { isLoaded } from "./loads.js";
import { MAX_HOLD_SEC, MAX_REPS, clamp } from "./prescribe.js";
import type { Prescription } from "./types.js";

export interface SetAdvice {
  /** Suggested load for the next set (kg per dumbbell), or null for bodyweight work. */
  loadKg: number | null;
  /** Suggested reps (or seconds) for the next set. */
  targetReps: number;
  tone: "good" | "adjust" | "stop";
  message: string;
}

/**
 * In-workout coaching after each logged set: keep going, change the dumbbell,
 * or stop. Benchmark sets recalibrate the remaining sets straight away.
 */
export function adviseNextSet(p: Prescription, done: SetLog[], ctx: EngineContext): SetAdvice {
  const sets = done.filter((s) => s.exerciseId === p.exerciseId).sort((a, b) => a.setIndex - b.setIndex);
  const last = sets[sets.length - 1];
  const [lo, hi] = p.repRange;
  if (!last) return { loadKg: p.loadKg, targetReps: p.targetReps, tone: "good", message: "" };
  if (last.painFlag) {
    return {
      loadKg: p.loadKg,
      targetReps: p.targetReps,
      tone: "stop",
      message: "Skip the rest of this one. It will be swapped next time. Sharp or lingering pain is worth getting checked.",
    };
  }

  const e = getExercise(p.exerciseId);
  const units = ctx.profile.units;
  const rirT = p.targetRir;
  const fmt = (w: number) => formatLoad(w, e.loadType, units);
  const unit = e.loadType === "time" ? "seconds" : "reps";
  const cap = e.loadType === "time" ? MAX_HOLD_SEC : MAX_REPS;

  if (isLoaded(e) && last.loadKg !== null) {
    const e1 = e1RM(last.loadKg, last.reps, last.rir);
    const fit = (w: number) => repsAtLoad(e1, w) - rirT;
    if (p.benchmarkSet && sets.length === 1) {
      let chosen: number | null = null;
      for (const w of ctx.ownedLoadsKg) if (fit(w) >= lo) chosen = w;
      const load = chosen ?? ctx.ownedLoadsKg[0] ?? last.loadKg;
      const target = clamp(fit(load), lo, hi);
      if (Math.abs(load - last.loadKg) < 1e-6) {
        return { loadKg: load, targetReps: target, tone: "good", message: `Benchmark logged. Stay at ${fmt(load)} and aim for ${target} reps.` };
      }
      return { loadKg: load, targetReps: target, tone: "adjust", message: `Benchmark logged. Use ${fmt(load)} for the rest and aim for ${target} reps.` };
    }
    if (last.reps < lo && last.rir <= 1) {
      const prev = prevOwnedLoad(last.loadKg, ctx.ownedLoadsKg);
      if (prev !== null) {
        return { loadKg: prev, targetReps: clamp(fit(prev), lo, hi), tone: "adjust", message: `That was a grind. Drop to ${fmt(prev)} for the next set.` };
      }
      return { loadKg: last.loadKg, targetReps: Math.max(1, last.reps), tone: "adjust", message: "That was a grind. Same weight, and fewer reps is fine. Keep the form clean." };
    }
    if (last.rir >= 4 && last.reps >= hi) {
      const up = nextOwnedLoad(last.loadKg, ctx.ownedLoadsKg);
      if (up !== null && fit(up) >= lo) {
        return { loadKg: up, targetReps: clamp(fit(up), lo, hi), tone: "adjust", message: `Too easy. Try ${fmt(up)} next set.` };
      }
      return { loadKg: last.loadKg, targetReps: Math.min(cap, last.reps + 2), tone: "good", message: "Easy one. Add a couple of reps or slow the lowering down." };
    }
    const target = last.rir >= rirT ? clamp(last.reps, lo, hi) : clamp(last.reps - 1, lo, hi);
    return { loadKg: last.loadKg, targetReps: target, tone: "good", message: "Good set. Same weight next round." };
  }

  if (p.benchmarkSet && sets.length === 1) {
    const target = clamp(last.reps + last.rir - rirT, lo, hi);
    return { loadKg: null, targetReps: target, tone: "good", message: `Benchmark logged. Aim for ${target} ${unit} on the rest.` };
  }
  if (last.reps < lo && last.rir <= 1) {
    return { loadKg: null, targetReps: Math.max(1, last.reps), tone: "adjust", message: `Tough one. Fewer ${unit} is fine; keep the form clean.` };
  }
  if (last.rir >= 4 && last.reps >= hi) {
    const step = e.loadType === "time" ? 10 : 2;
    return { loadKg: null, targetReps: Math.min(cap, last.reps + step), tone: "good", message: `Strong. Add a few ${unit}; next session we'll make it harder.` };
  }
  const target = last.rir >= rirT ? clamp(last.reps, lo, hi) : clamp(last.reps - 1, lo, hi);
  return { loadKg: null, targetReps: target, tone: "good", message: "Good set. Same again next round." };
}
