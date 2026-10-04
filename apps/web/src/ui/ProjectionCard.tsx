import React, { useMemo, useState } from "react";
import type { Band, Projection } from "@repcurve/engine";
import { kgToLb } from "@repcurve/shared";
import type { Units } from "@repcurve/shared";
import { NOTICE } from "../model/projection";

function RangeBar(props: { band: Band; max: number; label: string; unit: string }): React.ReactElement {
  const { band, max } = props;
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  return (
    <div className="range" role="img" aria-label={`${props.label}: ${band.low} to ${band.high}${props.unit}, most likely ${band.mid}${props.unit}`}>
      <div className="range-track">
        <span className="range-band" style={{ left: pct(band.low), width: `calc(${pct(band.high)} - ${pct(band.low)})` }} />
        <span className="range-mid" style={{ left: pct(band.mid) }} />
      </div>
    </div>
  );
}

function massText(kg: number, units: Units): string {
  return units === "lb" ? `${Math.round(kgToLb(kg) * 10) / 10} lb` : `${kg} kg`;
}

export function ProjectionCard(props: { projection: Projection; units: Units; initialWeek?: number; compact?: boolean }): React.ReactElement {
  const { projection, units } = props;
  const [week, setWeek] = useState(props.initialWeek ?? 12);
  const pt = projection.points.find((p) => p.week === week) ?? projection.points[0]!;
  const maxStrength = useMemo(() => Math.max(...projection.points.map((p) => p.strengthPct.high)), [projection]);
  const maxLean = useMemo(() => Math.max(0.5, ...projection.points.map((p) => p.leanMassKg?.high ?? 0)), [projection]);
  const maxCardio = useMemo(() => Math.max(5, ...projection.points.map((p) => p.cardioPct.high)), [projection]);
  const [showAssumptions, setShowAssumptions] = useState(false);

  return (
    <section className="card stack projection" aria-label="What to expect">
      <div className="spread">
        <h2 className="h3">If you stick with it</h2>
        <span className="eyebrow">Projection</span>
      </div>
      <div className="seg" role="group" aria-label="Weeks from the start">
        {projection.points.map((p) => (
          <button key={p.week} type="button" aria-pressed={p.week === week} onClick={() => setWeek(p.week)}>
            {p.week === 52 ? "1 yr" : `${p.week} wk`}
          </button>
        ))}
      </div>

      <div className="proj-row">
        <div className="proj-head">
          <span className="proj-label">Strength</span>
          <span className="proj-value num">
            +{pt.strengthPct.mid}% <small>({pt.strengthPct.low}–{pt.strengthPct.high}%)</small>
          </span>
        </div>
        <RangeBar band={pt.strengthPct} max={maxStrength} label="Strength gain" unit="%" />
      </div>

      <div className="proj-row">
        <div className="proj-head">
          <span className="proj-label">Lean mass</span>
          <span className="proj-value num">
            {pt.leanMassKg ? (
              <>
                +{massText(pt.leanMassKg.mid, units)} <small>({massText(pt.leanMassKg.low, units)}–{massText(pt.leanMassKg.high, units)})</small>
              </>
            ) : (
              <small>too early to measure</small>
            )}
          </span>
        </div>
        {pt.leanMassKg ? <RangeBar band={pt.leanMassKg} max={maxLean} label="Lean mass gain" unit=" kg" /> : <div className="range-track ghost" />}
      </div>

      <div className="proj-row">
        <div className="proj-head">
          <span className="proj-label">Cardio fitness</span>
          <span className="proj-value num">
            +{pt.cardioPct.mid}% <small>({pt.cardioPct.low}–{pt.cardioPct.high}%)</small>
          </span>
        </div>
        <RangeBar band={pt.cardioPct} max={maxCardio} label="Cardio fitness gain" unit="%" />
      </div>

      <p className="prose"><b>What you'd notice:</b> {NOTICE[pt.week]}</p>
      {!props.compact ? <p className="meta small">{projection.headline}</p> : null}
      {projection.tracking ? <div className="banner info small">{projection.tracking}</div> : null}
      {pt.cardioPct.mid <= 5 ? (
        <p className="meta small">Cardio gains are small at this dose. A second treadmill day, especially with intervals, roughly doubles them.</p>
      ) : null}
      <button type="button" className="btn ghost" style={{ alignSelf: "flex-start" }} onClick={() => setShowAssumptions(!showAssumptions)} aria-expanded={showAssumptions}>
        {showAssumptions ? "Hide" : "How this is worked out"}
      </button>
      {showAssumptions ? (
        <ul className="meta small" style={{ margin: 0, paddingLeft: 18 }}>
          <li>
            Based on {projection.dose.sessionsPerWeek} sessions a week, about {projection.dose.setsPerMuscle} hard sets per muscle, and {projection.dose.cardioMinutesPerWeek} cardio minutes
            {projection.dose.adherence < 1 ? `, at the ${Math.round(projection.dose.adherence * 100)}% of sessions you've been doing` : ""}.
          </li>
          {projection.assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
