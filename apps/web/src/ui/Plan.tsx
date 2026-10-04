import React, { useMemo } from "react";
import { generateProgram, MUSCLES } from "@repcurve/engine";
import type { Core } from "../model/types";

const MUSCLE_NAMES: Record<string, string> = {
  quads: "Quads", glutes: "Glutes", hamstrings: "Hamstrings", chest: "Chest", shoulders: "Shoulders",
  triceps: "Triceps", biceps: "Biceps", back: "Back", core: "Core", calves: "Calves",
};

export function Plan(props: { core: Core }): React.ReactElement {
  const { core } = props;
  const program = useMemo(
    () => generateProgram({ profile: core.profile, equipment: core.equipment }, { weeks: 2, restSec: core.settings.restSec, createdAt: "plan" }),
    [core.profile, core.equipment, core.settings.restSec],
  );
  const [lo, hi] = program.volumeTarget;
  const max = Math.max(hi + 4, ...MUSCLES.map((m) => program.weeklyVolume[m]));
  return (
    <div className="stack-lg">
      <header className="stack">
        <p className="eyebrow">Your plan</p>
        <h1 className="title">
          {core.profile.daysPerWeek} × {core.profile.minutesPerSession} minutes
        </h1>
        <p className="meta">
          Week pattern: {program.template.map((k) => (k === "strength" ? "Lift" : "Cardio")).join(" · ")}
        </p>
      </header>
      <section className="stack">
        {program.explanation.map((p, i) => (
          <p className="prose" key={i}>{p}</p>
        ))}
      </section>
      <section className="card stack">
        <h2 className="h3">Hard sets per muscle, per week</h2>
        <p className="meta small">The shaded band is the useful range for your level ({lo}–{hi}). Secondary muscles count as half a set.</p>
        <div className="muscles">
          {MUSCLES.filter((m) => program.weeklyVolume[m] > 0).map((m) => {
            const v = program.weeklyVolume[m];
            return (
              <div className="muscle" key={m}>
                <span>{MUSCLE_NAMES[m]}</span>
                <span className="bar" role="img" aria-label={`${MUSCLE_NAMES[m]}: ${v} sets`}>
                  <span className="band" style={{ left: `${(lo / max) * 100}%`, width: `${((hi - lo) / max) * 100}%` }} />
                  <i style={{ width: `${(v / max) * 100}%` }} />
                </span>
                <span className="v">{Number.isInteger(v) ? v : v.toFixed(1)}</span>
              </div>
            );
          })}
        </div>
      </section>
      <p className="meta small">
        Plan numbers come from training research: weekly hard sets drive muscle growth with diminishing returns, sets taken close to failure count most, and short sessions work when the weekly total is there.
      </p>
    </div>
  );
}
