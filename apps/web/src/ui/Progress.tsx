import React, { useMemo } from "react";
import { e1RM, formatLoad, displayLoad } from "@repcurve/shared";
import { findExercise } from "@repcurve/exercises";
import { dayLabel } from "../model/format";
import { weekStreak } from "../model/plan";
import { userProjection } from "../model/projection";
import { ProjectionCard } from "./ProjectionCard";
import type { Core, SessionRecord } from "../model/types";
import { Spark, type SparkPoint } from "./Spark";

interface LiftSeries {
  id: string;
  name: string;
  points: SparkPoint[];
  firstY: number;
  lastY: number;
  metric: "e1rm" | "reps";
}

function series(history: SessionRecord[], core: Core): LiftSeries[] {
  const units = core.profile.units;
  const map = new Map<string, LiftSeries>();
  for (const r of history) {
    if (r.kind !== "strength" || r.skipped) continue;
    const byEx = new Map<string, typeof r.sets>();
    for (const s of r.sets) byEx.set(s.exerciseId, [...(byEx.get(s.exerciseId) ?? []), s]);
    for (const [id, sets] of byEx) {
      const e = findExercise(id);
      if (!e || e.pattern === "core") continue;
      const loaded = sets.some((s) => s.loadKg !== null);
      let y: number;
      let label: string;
      if (loaded) {
        y = Math.max(...sets.filter((s) => s.loadKg !== null).map((s) => e1RM(s.loadKg!, s.reps, s.rir)));
        label = `${displayLoad(Math.round(y * 10) / 10, units)} ${units}`;
      } else {
        y = Math.max(...sets.map((s) => s.reps));
        label = `${y} reps`;
      }
      const cur = map.get(id) ?? { id, name: e.name, points: [], firstY: y, lastY: y, metric: loaded ? "e1rm" : "reps" };
      cur.points.push({ x: r.finishedAt, y, label: `${label}, ${dayLabel(r.finishedAt, Date.now()).toLowerCase()}` });
      cur.lastY = y;
      map.set(id, cur);
    }
  }
  return [...map.values()].sort((a, b) => b.points.length - a.points.length);
}

export function Progress(props: { core: Core; history: SessionRecord[] }): React.ReactElement {
  const { core, history } = props;
  const lifts = useMemo(() => series(history, core), [history, core]);
  const done = history.filter((r) => !r.skipped);
  const minutes = done.reduce((n, r) => n + r.activeMinutes, 0);
  const streak = weekStreak(history, Date.now());
  const units = core.profile.units;
  const projection = useMemo(() => userProjection(core, history, Date.now()), [core, history]);

  return (
    <div className="stack-lg">
      <header className="stack">
        <p className="eyebrow">Progress</p>
        <h1 className="title">Your curve so far</h1>
      </header>

      <div className="stats">
        <div className="stat"><b className="num">{done.length}</b><span>sessions</span></div>
        <div className="stat"><b className="num">{minutes}</b><span>minutes</span></div>
        <div className="stat"><b className="num">{streak}</b><span>week streak</span></div>
      </div>

      <ProjectionCard projection={projection} units={units} />

      <section className="card">
        <h2 className="h3">Lifts</h2>
        <p className="meta small" style={{ marginBottom: 8 }}>
          Dumbbell lifts show your estimated one-rep max from the best set each session. Bodyweight moves show your best set of reps. Tap a line to read any point.
        </p>
        {lifts.length === 0 ? (
          <p className="meta">Finish your first session and your lifts appear here.</p>
        ) : (
          lifts.map((l) => {
            const change = l.firstY > 0 ? Math.round(((l.lastY - l.firstY) / l.firstY) * 100) : 0;
            const st = core.state.exercises[l.id];
            const now = st
              ? `${st.loadKg !== null ? `${formatLoad(st.loadKg, findExercise(l.id)?.loadType ?? "dumbbell_pair", units)} × ` : ""}${st.targetReps} next`
              : "";
            return (
              <div className="lift" key={l.id}>
                <div style={{ minWidth: 0 }}>
                  <div className="name">{l.name}</div>
                  <div className="now">
                    {l.points.length > 1 ? `${change >= 0 ? "+" : ""}${change}% since first · ` : "first session · "}
                    {now}
                  </div>
                </div>
                <Spark points={l.points} title={l.name} />
              </div>
            );
          })
        )}
      </section>

      <section className="card">
        <h2 className="h3">History</h2>
        {history.length === 0 ? <p className="meta">No sessions yet.</p> : null}
        {[...history].reverse().slice(0, 30).map((r) => (
          <div key={r.id} className="lift">
            <div>
              <div className="name">{r.name}{r.skipped ? " · skipped" : ""}</div>
              <div className="now">
                {dayLabel(r.finishedAt, Date.now())} · {r.activeMinutes} min
                {r.kind === "strength" && !r.skipped ? ` · ${r.sets.length} sets` : ""}
                {r.cardio ? ` · effort ${r.cardio.effort}/10` : ""}
              </div>
            </div>
            <span className="meta small num">#{r.index + 1}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
