import React from "react";
import type { ExerciseChange } from "@repcurve/engine";
import { getExercise } from "@repcurve/exercises";
import { formatLoad } from "@repcurve/shared";
import type { Units } from "@repcurve/shared";
import type { SessionRecord } from "../model/types";
import { useStore } from "../store/useAppStore";

const UP = new Set(["load_up", "ladder_up", "widen_range"]);
const DOWN = new Set(["load_down", "ladder_down", "pain", "stall_noted"]);

function nextText(c: ExerciseChange, units: Units): string {
  const e = getExercise(c.nextExerciseId);
  const reps = e.loadType === "time" ? `${c.next.targetReps} s` : `${c.next.targetReps} reps`;
  return c.next.loadKg !== null ? `${formatLoad(c.next.loadKg, e.loadType, units)} × ${reps}` : reps;
}

export function Finished(props: { record: SessionRecord; units: Units }): React.ReactElement {
  const { dispatch } = useStore();
  const r = props.record;
  const changes = r.changes.filter((c) => c.action !== "skipped");
  return (
    <main className="app stack-lg" style={{ paddingBottom: 40 }}>
      <header className="stack">
        <p className="eyebrow">Session {r.index + 1} done · {r.activeMinutes} min</p>
        <h1 className="title">{r.name}</h1>
        {r.kind === "strength" ? (
          <p className="meta num">{r.sets.length} sets logged{r.deload ? " · deload" : ""}</p>
        ) : r.cardio ? (
          <p className="meta num">
            {r.cardio.minutes} min · effort {r.cardio.effort}/10{r.cardio.notes ? ` · ${r.cardio.notes}` : ""}
          </p>
        ) : null}
      </header>

      {changes.length > 0 ? (
        <section className="card">
          <h2 className="h3" style={{ marginBottom: 6 }}>Next time</h2>
          {changes.map((c) => {
            const cls = c.action === "calibrated" ? "cal" : UP.has(c.action) ? "up" : DOWN.has(c.action) ? "down" : "";
            const arrow = c.action === "calibrated" ? "◎" : UP.has(c.action) ? "▲" : DOWN.has(c.action) ? "▼" : "=";
            const moved = c.nextExerciseId !== c.exerciseId;
            return (
              <div key={c.slot} className={`change ${cls}`}>
                <span className="arrow" aria-hidden="true">{arrow}</span>
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {moved ? `${getExercise(c.exerciseId).name} → ${getExercise(c.nextExerciseId).name}` : getExercise(c.exerciseId).name}
                  </div>
                  <div className="next">{nextText(c, props.units)}</div>
                  {c.reason ? <div className="why">{c.reason}</div> : null}
                </div>
              </div>
            );
          })}
        </section>
      ) : r.kind === "strength" ? (
        <p className="meta">Nothing logged, so nothing changes for next time.</p>
      ) : (
        <p className="prose">Cardio logged. Treadmill sessions build a little each week on their own.</p>
      )}

      <button type="button" className="btn primary big" onClick={() => dispatch({ type: "dismissFinished" })}>
        Done
      </button>
    </main>
  );
}
