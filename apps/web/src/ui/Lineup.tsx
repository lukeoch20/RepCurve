import React from "react";
import type { Prescription, SessionPlan } from "@repcurve/engine";
import type { Units } from "@repcurve/shared";
import { repsUnit } from "../model/format";

function dose(p: Prescription): string {
  const reps = p.loadType === "time" ? `${p.targetReps} s` : `${p.targetReps}`;
  const side = p.unilateral ? "/side" : "";
  return `${p.sets} × ${reps}${side}`;
}

/** Compact preview of a strength session: supersets, then the finisher. */
export function Lineup(props: { plan: SessionPlan; units: Units }): React.ReactElement {
  const { plan } = props;
  return (
    <div className="lineup">
      {plan.supersets.map((ss) => (
        <div className="lineup-group" key={ss.label}>
          <div className="lineup-tag">{ss.label}</div>
          <div>
            {ss.items.map((p) => (
              <div className="lineup-item" key={p.slot}>
                <span className="what">{p.name}</span>
                <span className="dose">
                  {dose(p)}
                  {p.loadKg !== null ? <><br />{p.loadDisplay}</> : null}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
      {plan.finisher ? (
        <div className="lineup-group">
          <div className="lineup-tag wide">Core</div>
          <div className="lineup-item">
            <span className="what">{plan.finisher.name}</span>
            <span className="dose">
              {plan.finisher.sets} × {plan.finisher.targetReps} {repsUnit(plan.finisher.loadType)}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function CardioLineup(props: { plan: SessionPlan }): React.ReactElement | null {
  const c = props.plan.cardio;
  if (!c) return null;
  return (
    <div className="lineup">
      {c.segments.map((s, i) => (
        <div className="lineup-item" key={i}>
          <span className="what">
            {s.intent === "warmup" ? "Warm-up" : s.intent === "cooldown" ? "Cool-down" : s.intent === "hard" ? "Hard" : s.intent === "easy" ? "Easy" : "Steady"}
            {s.note ? <span className="meta small"> · {s.note}</span> : null}
          </span>
          <span className="dose">
            {s.minutes} min · effort {s.effort}/10
          </span>
        </div>
      ))}
    </div>
  );
}
