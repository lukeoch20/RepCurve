import type { Program, SessionPlan } from "@repcurve/engine";
import type { Units } from "@repcurve/shared";

function fmtRange(p: { repRange: [number, number]; loadType: string }): string {
  const [lo, hi] = p.repRange;
  return p.loadType === "time" ? `${lo}–${hi} s` : `${lo}–${hi} reps`;
}

export function formatSession(s: SessionPlan, _units: Units): string[] {
  const out: string[] = [];
  out.push(`Day ${s.dayIndex + 1} · ${s.name} · ~${s.estimatedMinutes} of ${s.budgetMinutes} min`);
  if (s.kind === "cardio" && s.cardio) {
    out.push(`  ${s.cardio.mode === "treadmill" ? "Treadmill" : "Outdoors"} · ${s.cardio.style.replace("_", " ")}`);
    for (const seg of s.cardio.segments) {
      out.push(`  ${String(seg.minutes).padStart(2)} min  ${seg.intent.padEnd(8)} effort ${seg.effort}/10${seg.note ? `  ${seg.note}` : ""}`);
    }
    return out;
  }
  if (s.warmup.length) {
    out.push(`  Warm-up (${s.warmupMinutes} min)`);
    for (const w of s.warmup) out.push(`    ${w.name}: ${w.prescription}`);
  }
  for (const ss of s.supersets) {
    out.push(`  Superset ${ss.label} · ${ss.rounds} rounds · ${ss.restSec}s rest after each round · ~${Math.round(ss.estimatedSec / 60)} min`);
    ss.items.forEach((p, i) => {
      const side = p.unilateral ? " per side" : "";
      const load = p.loadDisplay ? ` @ ${p.loadDisplay}` : "";
      const bench = p.benchmarkSet ? "  [first set: as many as you can, stop with 2 left, cap 20]" : "";
      out.push(`    ${ss.label}${i + 1} ${p.name}: ${ss.rounds} × ${fmtRange(p)}${side}${load}${bench}`);
      if (p.cue) out.push(`       ${p.cue}`);
    });
  }
  if (s.finisher) {
    const f = s.finisher;
    out.push(`  Finisher · ${f.name}: ${f.sets} × ${fmtRange(f)}`);
    if (f.cue) out.push(`       ${f.cue}`);
  }
  return out;
}

export function formatProgram(p: Program, units: Units, onlyWeek?: number): string {
  const lines: string[] = [];
  lines.push(`RepCurve program · level: ${p.level} · ${p.weeks} weeks · template: ${p.template.map((k) => (k === "strength" ? "S" : "C")).join(" ")}`);
  lines.push("");
  for (const l of p.explanation) lines.push(l, "");
  const vol = Object.entries(p.weeklyVolume)
    .filter(([, v]) => v > 0)
    .map(([m, v]) => `${m} ${v}`)
    .join(" · ");
  lines.push(`Weekly hard sets (steady week): ${vol}`);
  lines.push(`Target for this level: ${p.volumeTarget[0]}–${p.volumeTarget[1]} per muscle`);
  lines.push("");
  const weeks = [...new Set(p.sessions.map((s) => s.week))].filter((w) => !onlyWeek || w === onlyWeek);
  for (const w of weeks) {
    lines.push(`=== Week ${w} ===`);
    for (const s of p.sessions.filter((x) => x.week === w)) {
      lines.push(...formatSession(s, units), "");
    }
  }
  return lines.join("\n");
}
