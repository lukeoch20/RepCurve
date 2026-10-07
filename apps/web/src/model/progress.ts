import type { Projection } from "@repcurve/engine";
import { findExercise } from "@repcurve/exercises";
import { e1RM } from "@repcurve/shared";
import { localWeek } from "./plan";
import type { SessionRecord } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export interface LiftSeries {
  id: string;
  name: string;
  /** "e1rm": estimated one-rep max in kg per dumbbell. "reps": best set of reps (bodyweight moves). */
  metric: "e1rm" | "reps";
  points: { t: number; y: number }[];
}

/** One series per exercise (core work aside): the best set of each session. */
export function liftSeries(history: SessionRecord[]): LiftSeries[] {
  const map = new Map<string, LiftSeries>();
  for (const r of history) {
    if (r.kind !== "strength" || r.skipped) continue;
    const byEx = new Map<string, SessionRecord["sets"]>();
    for (const s of r.sets) byEx.set(s.exerciseId, [...(byEx.get(s.exerciseId) ?? []), s]);
    for (const [id, sets] of byEx) {
      const e = findExercise(id);
      if (!e || e.pattern === "core") continue;
      const loaded = sets.filter((s) => s.loadKg !== null && s.reps > 0);
      const metric = loaded.length > 0 ? "e1rm" : "reps";
      const y = metric === "e1rm" ? Math.max(...loaded.map((s) => e1RM(s.loadKg!, s.reps, s.rir))) : Math.max(...sets.map((s) => s.reps));
      const cur = map.get(id) ?? { id, name: e.name, metric, points: [] };
      // A move from bodyweight to dumbbells starts a fresh series rather than mixing units.
      if (cur.metric !== metric) {
        cur.metric = metric;
        cur.points = [];
      }
      cur.points.push({ t: r.finishedAt, y });
      map.set(id, cur);
    }
  }
  // Loaded lifts first (they have a weight to project), then by how often they were done.
  return [...map.values()].sort((a, b) => Number(b.metric === "e1rm") - Number(a.metric === "e1rm") || b.points.length - a.points.length);
}

export type Range = "4w" | "12w" | "all";

export function inRange<T extends { t: number }>(points: T[], range: Range, now: number): T[] {
  if (range === "all") return points;
  const from = now - (range === "4w" ? 4 : 12) * WEEK_MS;
  return points.filter((p) => p.t >= from);
}

/** Change from the first to the latest point, as a share (0.18 = +18%). */
export function change(points: { y: number }[]): number | null {
  if (points.length < 2 || points[0]!.y <= 0) return null;
  return points[points.length - 1]!.y / points[0]!.y - 1;
}

export interface WeekShare {
  /** Local Monday-start week number. */
  week: number;
  /** Epoch ms of a moment inside that week, for labels. */
  t: number;
  done: number;
  planned: number;
}

/** Sessions done against the plan, per local week, from the first session's week to now. */
export function weeklyAdherence(history: SessionRecord[], daysPerWeek: number, now: number): WeekShare[] {
  const done = history.filter((r) => !r.skipped);
  if (done.length === 0) return [];
  const first = localWeek(done[0]!.finishedAt);
  const last = localWeek(now);
  const counts = new Map<number, number>();
  for (const r of done) counts.set(localWeek(r.finishedAt), (counts.get(localWeek(r.finishedAt)) ?? 0) + 1);
  const out: WeekShare[] = [];
  for (let w = first; w <= last; w++) {
    out.push({ week: w, t: now - (last - w) * WEEK_MS, done: counts.get(w) ?? 0, planned: daysPerWeek });
  }
  return out;
}

/** Strength gain (%) the projection expects by a week, interpolated between its horizons. */
function strengthPctAt(projection: Projection, week: number, key: "low" | "mid" | "high"): number {
  const pts: [number, number][] = [[0, 0], ...projection.points.map((p) => [p.week, p.strengthPct[key]] as [number, number])];
  if (week <= 0) return 0;
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i]!;
    const [x0, y0] = pts[i - 1]!;
    if (week <= x1) return y0 + ((y1 - y0) * (week - x0)) / (x1 - x0);
  }
  return pts[pts.length - 1]![1];
}

export interface ForecastPoint {
  weeksAhead: number;
  lo: number;
  mid: number;
  hi: number;
}

/**
 * Where one lift could be if it follows the user's projected strength curve from here:
 * today's value scaled by the gain the projection expects between now and each later week.
 */
export function liftForecast(currentKg: number, projection: Projection, weeksIn: number, ahead = [0, 4, 8, 12]): ForecastPoint[] {
  const base = 1 + strengthPctAt(projection, weeksIn, "mid") / 100;
  const at = (key: "low" | "mid" | "high", w: number) => (currentKg * (1 + strengthPctAt(projection, weeksIn + w, key) / 100)) / base;
  return ahead.map((w) =>
    w === 0
      ? { weeksAhead: 0, lo: currentKg, mid: currentKg, hi: currentKg }
      : // The low edge never sits below today: the band is where the lift is heading, not a loss forecast.
        { weeksAhead: w, lo: Math.max(currentKg, at("low", w)), mid: at("mid", w), hi: Math.max(at("mid", w), at("high", w)) },
  );
}
