import React from "react";
import type { ExerciseChange } from "@repcurve/engine";
import { findExercise } from "@repcurve/exercises";
import { displayLoad, formatLoad } from "@repcurve/shared";
import type { Units } from "@repcurve/shared";
import { celebrate } from "../model/celebrate";
import { equivalent, levelUps, newBadges } from "../model/gamify";
import { Medal } from "./Trophies";
import type { Core, SessionRecord } from "../model/types";
import { useStore } from "../store/useAppStore";
import { useTip } from "./tips";

const UP = new Set(["load_up", "ladder_up", "widen_range"]);
const DOWN = new Set(["load_down", "ladder_down", "pain"]);

/** Symbol and colour for each kind of change: a rep more is a small step up; a noted tough session changes nothing yet. */
function marker(action: string): { arrow: string; cls: string } {
  if (action === "calibrated") return { arrow: "◎", cls: "cal" };
  if (UP.has(action)) return { arrow: "▲", cls: "up" };
  if (action === "add_rep") return { arrow: "+", cls: "up" };
  if (DOWN.has(action)) return { arrow: "▼", cls: "down" };
  return { arrow: "=", cls: "" };
}

const nameOf = (id: string) => findExercise(id)?.name ?? id;

function nextText(c: ExerciseChange, units: Units): string {
  const loadType = findExercise(c.nextExerciseId)?.loadType ?? "dumbbell_pair";
  const reps = loadType === "time" ? `${c.next.targetReps} s` : `${c.next.targetReps} reps`;
  return c.next.loadKg !== null ? `${formatLoad(c.next.loadKg, loadType, units)} × ${reps}` : reps;
}

export function Finished(props: { record: SessionRecord; core: Core; history: SessionRecord[]; units: Units }): React.ReactElement {
  const { dispatch } = useStore();
  const r = props.record;
  const { units } = props;
  const changes = r.changes.filter((c) => c.action !== "skipped");
  const nextTip = useTip("finished.next", changes.length > 0);
  const c = React.useMemo(() => celebrate(r, props.history, props.core), [r, props.history, props.core]);
  const moved = Math.round(displayLoad(c.movedKg, units));
  const like = equivalent(c.movedKg);
  const earned = React.useMemo(() => newBadges(r, props.history, props.core), [r, props.history, props.core]);
  const levels = React.useMemo(() => (r.kind === "strength" ? levelUps(r, props.history) : []), [r, props.history]);
  // The session screen was scrolled; the celebration starts at the top.
  React.useEffect(() => window.scrollTo(0, 0), []);
  return (
    <main className="app stack-lg" style={{ paddingBottom: 40 }}>
      <Confetti />
      <header className="celebrate-hero" aria-live="polite">
        <span className="celebrate-badge" aria-hidden="true">
          <svg viewBox="0 0 48 48" width="56" height="56">
            <circle cx="24" cy="24" r="22" fill="var(--accent)" />
            <path className="celebrate-check" d="M14 25 l7 7 l13 -15" fill="none" stroke="var(--accent-ink)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <p className="eyebrow">{r.name} · session {r.index + 1}</p>
        <h1 className="title">{c.headline}</h1>
        <p className="prose">{c.message}</p>
      </header>

      <section className="celebrate-stats" aria-label="This session">
        <div className="stat"><b className="num">{c.minutes > 0 ? c.minutes : "<1"}</b><span>{c.minutes === 1 ? "minute" : "minutes"}</span></div>
        {r.kind === "strength" ? (
          <div className="stat"><b className="num">{c.sets}</b><span>sets</span></div>
        ) : r.cardio ? (
          <div className="stat"><b className="num">{r.cardio.effort}/10</b><span>effort</span></div>
        ) : null}
        {c.calories > 0 ? <div className="stat"><b className="num">~{c.calories}</b><span>calories</span></div> : null}
        {moved > 0 ? <div className="stat"><b className="num">{moved.toLocaleString()}</b><span>{units} moved</span></div> : null}
      </section>

      {like && moved > 0 ? <p className="meta celebrate-like">You moved {like} today.</p> : null}

      {earned.length > 0 ? (
        <section className="card stack new-badges" style={{ gap: 10 }}>
          <h2 className="h3">{earned.length === 1 ? "New badge!" : `${earned.length} new badges!`}</h2>
          <div className="trophies">
            {earned.map((b) => (
              <div key={b.id} className="trophy">
                <Medal badge={b} size={56} />
                <span className="trophy-name">{b.name}</span>
                <span className="meta small" style={{ textAlign: "center" }}>{b.how}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {levels.length > 0 ? (
        <section className="card stack" style={{ gap: 8 }}>
          <h2 className="h3">Level up!</h2>
          {levels.map((l) => (
            <div key={l.exerciseId} className="lift">
              <div className="name">{l.name}</div>
              <span className="level-chip num">Lv {l.level}</span>
            </div>
          ))}
        </section>
      ) : null}

      {c.records.length > 0 ? (
        <section className="card stack" style={{ gap: 8 }}>
          <h2 className="h3">New personal {c.records.length === 1 ? "record" : "records"}</h2>
          {c.records.map((rec) => (
            <div key={rec.exerciseId} className="change up">
              <span className="arrow" aria-hidden="true">▲</span>
              <div>
                <div style={{ fontWeight: 700 }}>{rec.name}</div>
                <div className="next">
                  {rec.loadKg !== null ? `${formatLoad(rec.loadKg, findExercise(rec.exerciseId)?.loadType ?? "dumbbell_pair", units)} × ${rec.reps}` : `${rec.reps} reps`} · your best yet
                </div>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <section className="card stack" style={{ gap: 12 }}>
        <div className="spread">
          <h2 className="h3">This week</h2>
          {c.streakWeeks > 1 ? <span className="streak num">{c.streakWeeks}-week streak</span> : null}
        </div>
        <div className="week-dots" role="img" aria-label={`${c.week.done} of ${c.week.planned} sessions done this week`}>
          {Array.from({ length: Math.max(c.week.planned, c.week.done) }, (_, i) => (
            <span key={i} className={i < c.week.done ? "on" : ""} />
          ))}
        </div>
        <p className="meta small num">
          {c.week.done >= c.week.planned ? `All ${c.week.planned} done this week.` : `${c.week.done} of ${c.week.planned} done this week.`} {c.count} {c.count === 1 ? "workout" : "workouts"} so far.
        </p>
      </section>

      <section className="card stack" style={{ gap: 8 }}>
        <h2 className="h3">Why it matters</h2>
        <ul className="howto-list">
          {c.benefits.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <p className="meta small">Calories are an estimate from your body weight, time and the kind of session.</p>
      </section>

      {changes.length > 0 ? (
        <section className="card" ref={nextTip}>
          <h2 className="h3" style={{ marginBottom: 6 }}>Next time</h2>
          {changes.map((c) => {
            const { arrow, cls } = marker(c.action);
            const moved = c.nextExerciseId !== c.exerciseId;
            return (
              <div key={c.slot} className={`change ${cls}`}>
                <span className="arrow" aria-hidden="true">{arrow}</span>
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {moved ? `${nameOf(c.exerciseId)} → ${nameOf(c.nextExerciseId)}` : nameOf(c.exerciseId)}
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
        <p className="prose">Cardio logged. Cardio sessions build a little each week, and the next one adjusts to how hard you said this felt.</p>
      )}

      <button type="button" className="btn primary big" onClick={() => dispatch({ type: "dismissFinished" })}>
        Done
      </button>
    </main>
  );
}

/** A short burst of confetti in the app's colours. Nothing moves when reduced motion is on. */
function Confetti(): React.ReactElement {
  const pieces = Array.from({ length: 28 }, (_, i) => {
    // Spread evenly, with a little fixed variety so it doesn't look like a grid.
    const left = ((i * 37) % 100) + ((i * 7) % 5);
    const delay = ((i * 53) % 40) / 100;
    const drift = ((i * 29) % 60) - 30;
    const turn = ((i * 97) % 720) - 360;
    return (
      <i
        key={i}
        style={{ left: `${left}%`, animationDelay: `${delay}s`, ["--drift" as string]: `${drift}px`, ["--turn" as string]: `${turn}deg` } as React.CSSProperties}
        className={`c${i % 4}`}
      />
    );
  });
  return <div className="confetti" aria-hidden="true">{pieces}</div>;
}
