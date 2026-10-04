import type { Muscle, Profile } from "@repcurve/shared";
import type { SessionKind } from "./types.js";

/**
 * "What to expect if you stick with it." Population priors from docs/EVIDENCE.md,
 * scaled by the user's real weekly dose and adherence, and recalibrated from
 * their own logged lifts once there is enough data. Ranges cover roughly the
 * 10th to 90th percentile of people like the user. Assumes roughly maintenance
 * eating; RepCurve doesn't track food.
 */

export interface Band {
  low: number;
  mid: number;
  high: number;
}

export interface ProjectionPoint {
  week: number;
  /** % change in estimated 1RM across the main lifts. */
  strengthPct: Band;
  /** Lean mass change in kg; null when too early to tell apart from measurement noise. */
  leanMassKg: Band | null;
  /** % change in aerobic fitness (VO2max). */
  cardioPct: Band;
}

export interface LiftObservation {
  exerciseId: string;
  /** Weeks since the user started. */
  week: number;
  /** Estimated 1RM, kg per dumbbell. */
  e1rmKg: number;
}

export interface ProjectionInput {
  profile: Profile;
  /** Weekly hard sets per muscle in the user's program (secondary muscles at half). */
  weeklyVolume: Record<Muscle, number>;
  template: SessionKind[];
  /** Minutes of cardio per week in the program. */
  cardioMinutesPerWeek: number;
  /** Share of planned sessions actually done so far (0-1); 1 when unknown. */
  adherence?: number;
  /** Weeks since the user started. */
  weeksIn?: number;
  /** Best e1RM per loaded exercise per session, for recalibration. */
  lifts?: LiftObservation[];
}

export interface Projection {
  points: ProjectionPoint[];
  dose: {
    sessionsPerWeek: number;
    minutesPerWeek: number;
    setsPerMuscle: number;
    cardioMinutesPerWeek: number;
    adherence: number;
  };
  /** The user's rate relative to the typical curve, once there is enough data. */
  personalFactor: number | null;
  tracking: string | null;
  leanBodyMassKg: number;
  headline: string;
  assumptions: string[];
}

export const HORIZONS = [4, 8, 12, 26, 52];

// ---- priors (docs/EVIDENCE.md, priors table) ---------------------------------------------

/** Median % strength gain for untrained adults at ~2-3 sessions/week, by week. */
const STRENGTH_CURVE: [number, number][] = [[0, 0], [4, 8], [8, 15], [12, 22], [26, 32], [52, 42]];
/** p10 and p90 relative to the median (12-week values 8% and 40% around 22%). */
const STRENGTH_SPREAD = { low: 8 / 22, high: 40 / 22 };
/** Median lean-mass gain, % of lean body mass, by week (1.5 kg ≈ 2.5% at 12 weeks for men). */
const LEAN_CURVE: [number, number][] = [[0, 0], [4, 0.8], [8, 1.8], [12, 2.5], [26, 4.2], [52, 5.8]];
const LEAN_SPREAD = { low: 0, high: 2 };
/** Weeks before lean-mass change rises above scale and DXA noise. */
const LEAN_MIN_WEEK = 8;
/** 12-week VO2max gain (%) by weekly cardio minutes, on top of superset strength training. */
const CARDIO_BY_MINUTES: [number, number, number, number][] = [
  // minutes, p10, median, p90
  [0, 0, 2, 5],
  [20, 0, 5, 10],
  [40, 1, 7, 14],
  [120, 3, 12, 22],
];
/** Share of the 12-week cardio gain reached by week. */
const CARDIO_TIME: [number, number][] = [[0, 0], [4, 0.4], [8, 0.75], [12, 1], [26, 1.2], [52, 1.3]];

/** Dose exponents: hypertrophy ~ (sets/10)^0.4, strength ~ (sets/10)^0.25. */
const HYPERTROPHY_EXP = 0.4;
const STRENGTH_EXP = 0.25;
const REFERENCE_SETS = 10;

const MAJOR: Muscle[] = ["quads", "glutes", "hamstrings", "chest", "back", "shoulders"];

function interp(curve: [number, number][], x: number): number {
  if (x <= curve[0]![0]) return curve[0]![1];
  for (let i = 1; i < curve.length; i++) {
    const [x1, y1] = curve[i]!;
    const [x0, y0] = curve[i - 1]!;
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  // Beyond the last anchor: keep the last slope, halved, so the curve keeps flattening.
  const [xa, ya] = curve[curve.length - 2]!;
  const [xb, yb] = curve[curve.length - 1]!;
  return yb + (((yb - ya) / (xb - xa)) * (x - xb)) / 2;
}

/** Boer (1984) lean body mass estimate. */
export function leanBodyMassKg(p: Pick<Profile, "sex" | "bodyweightKg" | "heightCm">): number {
  const lbm = p.sex === "male"
    ? 0.407 * p.bodyweightKg + 0.267 * p.heightCm - 19.2
    : 0.252 * p.bodyweightKg + 0.473 * p.heightCm - 48.3;
  return Math.max(25, Math.min(p.bodyweightKg * 0.95, lbm));
}

function experienceFactor(p: Profile, week: number): { strength: number; muscle: number } {
  switch (p.trainingHistory) {
    case "regular":
      return { strength: 0.5, muscle: 0.5 };
    case "lapsed":
      // Regaining is faster than first building, but only back to the old level.
      return week <= 12 ? { strength: 1.4, muscle: 1.4 } : { strength: 1.15, muscle: 1.1 };
    default:
      return { strength: 1, muscle: 1 };
  }
}

function ageFactor(age: number): { strength: number; muscle: number } {
  if (age >= 65) return { strength: 0.85, muscle: 0.75 };
  if (age >= 40) return { strength: 1, muscle: 0.9 };
  return { strength: 1, muscle: 1 };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const mass = (kg: number, units: Profile["units"]) => (units === "lb" ? `${round1(kg / 0.45359237)} lb` : `${round1(kg)} kg`);
const band = (mid: number, spread: { low: number; high: number }): Band => ({ low: mid * spread.low, mid, high: mid * spread.high });
const roundBand = (b: Band, r: (n: number) => number): Band => ({ low: r(b.low), mid: r(b.mid), high: r(b.high) });

/** The user's progress rate relative to the typical curve, from their own e1RM history. */
export function personalFactor(lifts: LiftObservation[], baseRate: number): { factor: number; weeks: number } | null {
  const byEx = new Map<string, LiftObservation[]>();
  for (const l of lifts) byEx.set(l.exerciseId, [...(byEx.get(l.exerciseId) ?? []), l]);
  const ratios: number[] = [];
  let span = 0;
  for (const obs of byEx.values()) {
    if (obs.length < 3) continue;
    const sorted = [...obs].sort((a, b) => a.week - b.week);
    // Skip the first exposure: week-1 benchmark sets are a learning effect, not a baseline.
    const first = sorted[1]!;
    const last = sorted[sorted.length - 1]!;
    if (last.week - first.week < 2) continue;
    const predicted = ((1 + (baseRate * interp(STRENGTH_CURVE, last.week)) / 100) / (1 + (baseRate * interp(STRENGTH_CURVE, first.week)) / 100)) - 1;
    if (predicted < 0.02) continue;
    const observed = last.e1rmKg / first.e1rmKg - 1;
    ratios.push(observed / predicted);
    span = Math.max(span, last.week - first.week);
  }
  if (ratios.length === 0) return null;
  ratios.sort((a, b) => a - b);
  const median = ratios[Math.floor(ratios.length / 2)]!;
  // Shrink toward the population curve until there are months of data.
  const weight = Math.min(0.7, span / 16);
  const factor = Math.max(0.4, Math.min(2, 1 + weight * (median - 1)));
  return { factor, weeks: span };
}

export function project(input: ProjectionInput): Projection {
  const p = input.profile;
  const adherence = Math.max(0.2, Math.min(1, input.adherence ?? 1));
  const sets = MAJOR.reduce((n, m) => n + input.weeklyVolume[m], 0) / MAJOR.length;
  const effectiveSets = Math.max(0.5, sets * adherence);
  const strengthDose = Math.pow(effectiveSets / REFERENCE_SETS, STRENGTH_EXP);
  const muscleDose = Math.pow(effectiveSets / REFERENCE_SETS, HYPERTROPHY_EXP);
  const age = ageFactor(p.age);
  const lbm = leanBodyMassKg(p);
  const cardioMinutes = input.cardioMinutesPerWeek * adherence;
  const cardioAt = (col: 1 | 2 | 3) => interp(CARDIO_BY_MINUTES.map((r) => [r[0], r[col]] as [number, number]), cardioMinutes);

  const pf = input.lifts && input.lifts.length > 0 ? personalFactor(input.lifts, strengthDose * age.strength) : null;
  const k = pf?.factor ?? 1;
  const weeksIn = input.weeksIn ?? 0;

  const points = HORIZONS.map((week) => {
    const exp = experienceFactor(p, week);
    // Personal factor applies to time still ahead; muscle follows strength only partly.
    const strengthMid = interp(STRENGTH_CURVE, week) * strengthDose * age.strength * exp.strength * (week > weeksIn ? k : 1);
    const muscleMidPct = interp(LEAN_CURVE, week) * muscleDose * age.muscle * exp.muscle * Math.sqrt(week > weeksIn ? k : 1);
    const cardioShare = interp(CARDIO_TIME, week);
    // Personal data narrows the range a little.
    const narrow = pf ? 0.75 : 1;
    const sSpread = { low: 1 - (1 - STRENGTH_SPREAD.low) * narrow, high: 1 + (STRENGTH_SPREAD.high - 1) * narrow };
    return {
      week,
      strengthPct: roundBand(band(strengthMid, sSpread), Math.round),
      leanMassKg: week < LEAN_MIN_WEEK ? null : roundBand(band((muscleMidPct / 100) * lbm, LEAN_SPREAD), round1),
      cardioPct: roundBand({ low: cardioAt(1) * cardioShare, mid: cardioAt(2) * cardioShare, high: cardioAt(3) * cardioShare }, Math.round),
    };
  });

  const sessionsPerWeek = input.template.length;
  const minutesPerWeek = sessionsPerWeek * p.minutesPerSession;
  const twelve = points.find((x) => x.week === 12)!;
  const who = `${p.trainingHistory === "regular" ? "a regular lifter" : p.trainingHistory === "lapsed" ? "a returning lifter" : "a newer lifter"}, ${p.sex}, ${p.age}`;
  const headline =
    `For ${who}, training ${sessionsPerWeek} × ${p.minutesPerSession} min a week (${minutesPerWeek} min): at week 12, expect strength on your main lifts up about ${twelve.strengthPct.low}–${twelve.strengthPct.high}% (most likely ~${twelve.strengthPct.mid}%)` +
    (twelve.leanMassKg
      ? `, and ${mass(twelve.leanMassKg.low, p.units)}–${mass(twelve.leanMassKg.high, p.units)} more lean mass (most likely ~${mass(twelve.leanMassKg.mid, p.units)}).`
      : ".");

  let tracking: string | null = null;
  if (pf) {
    const pct = Math.round(pf.factor * 100);
    tracking = pf.factor >= 1.1
      ? `Your logged lifts are rising faster than typical (about ${pct}% of the usual rate), so the curve has been nudged up.`
      : pf.factor <= 0.9
        ? `Your logged lifts are rising more slowly than typical (about ${pct}% of the usual rate), so the curve has been nudged down. Sleep, food and showing up shift this more than anything else.`
        : "Your logged lifts are tracking the typical curve.";
  }

  return {
    points,
    dose: { sessionsPerWeek, minutesPerWeek, setsPerMuscle: round1(sets), cardioMinutesPerWeek: input.cardioMinutesPerWeek, adherence: Math.round(adherence * 100) / 100 },
    personalFactor: pf ? Math.round(pf.factor * 100) / 100 : null,
    tracking,
    leanBodyMassKg: round1(lbm),
    headline,
    assumptions: [
      "Ranges cover roughly 8 in 10 people like you who do most of their sessions.",
      "Assumes you eat about as much as you burn. Eating more tends to add muscle faster; dieting slows it.",
      "Lean mass changes under about 1 kg can't be seen reliably on a scale or most body scans, so it isn't shown before week 8.",
      "Strength is your estimated one-rep max across the main lifts. With light dumbbells you'll mostly see it as more reps and harder variations.",
      "Population estimates from published training studies, not medical advice. The curve updates from your own lifts as you log them.",
    ],
  };
}
