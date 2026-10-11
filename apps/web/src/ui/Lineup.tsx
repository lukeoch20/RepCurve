import React from "react";
import type { Prescription, SessionPlan } from "@repcurve/engine";
import type { Units } from "@repcurve/shared";
import { repsUnit } from "../model/format";
import { ExerciseName } from "./ExerciseInfo";
import { useTip } from "./tips";

function dose(p: Prescription): string {
  const reps = p.loadType === "time" ? `${p.targetReps} s` : `${p.targetReps}`;
  const side = p.unilateral ? "/side" : "";
  return `${p.sets} × ${reps}${side}`;
}

/** Compact preview of a strength session: supersets, then the finisher. `tips` points the tutorial at it. */
export function Lineup(props: { plan: SessionPlan; units: Units; tips?: boolean }): React.ReactElement {
  const { plan } = props;
  const pairTip = useTip("today.superset", !!props.tips && (plan.supersets[0]?.items.length ?? 0) > 1);
  const doseTip = useTip("today.dose", !!props.tips);
  const howtoTip = useTip("today.howto", !!props.tips);
  return (
    <div className="lineup">
      {plan.supersets.map((ss, g) => (
        <div className="lineup-group" key={ss.label} ref={g === 0 ? pairTip : undefined}>
          <div className="lineup-tag">{ss.label}</div>
          <div>
            {ss.items.map((p, i) => (
              <div className="lineup-item" key={p.slot}>
                <span className="what" ref={g === 0 && i === 0 ? howtoTip : undefined}><ExerciseName id={p.exerciseId} name={p.name} /></span>
                <span className="dose" ref={g === 0 && i === 0 ? doseTip : undefined}>
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
            <span className="what"><ExerciseName id={plan.finisher.exerciseId} name={plan.finisher.name} /></span>
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
