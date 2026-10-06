import React, { useMemo, useState } from "react";
import { dayLabel, plural } from "../model/format";
import { todayPlan, weekSlots, weekStreak } from "../model/plan";
import type { Core, SessionRecord } from "../model/types";
import { unlockAudio } from "../platform/device";
import { useStore } from "../store/useAppStore";
import { CardioLineup, Lineup } from "./Lineup";

export function Today(props: { core: Core; history: SessionRecord[] }): React.ReactElement {
  const { core, history } = props;
  const { dispatch } = useStore();
  const [minutes, setMinutes] = useState<number | null>(null);
  const [skipAsk, setSkipAsk] = useState(false);
  const now = Date.now();
  const plan = useMemo(() => todayPlan(core, history, now, minutes), [core, history, minutes]); // eslint-disable-line react-hooks/exhaustive-deps
  const { week, slots } = useMemo(() => weekSlots(core, history), [core, history]);
  const last = [...history].reverse().find((r) => !r.skipped);
  const streak = weekStreak(history, now);
  const shorter = [10, 15].filter((m) => m < core.profile.minutesPerSession);
  const benchmarks = plan.kind === "strength" && [...plan.supersets.flatMap((s) => s.items)].some((p) => p.benchmarkSet);

  return (
    <div className="stack-lg">
      <header className="stack">
        <p className="eyebrow">
          Week {week} · session {core.nextIndex + 1}
        </p>
        <h1 className="title">{plan.name}</h1>
        <p className="meta num">
          {plan.kind === "strength"
            ? `~${Math.round(plan.estimatedMinutes)} min · ${plural(plan.supersets.length, "superset")}${plan.finisher ? " · core finisher" : ""}`
            : `${plan.cardio?.totalMinutes ?? plan.budgetMinutes} min · ${plan.cardio?.mode === "treadmill" ? "treadmill" : "walk or jog"}`}
        </p>
      </header>

      {plan.deload ? (
        <div className="banner info"><b>Deload week</b>Recent sessions were grinders. This week is lighter so you come back stronger.</div>
      ) : null}
      {plan.comeback ? (
        <div className="banner info"><b>Welcome back</b>It's been a couple of weeks, so today eases you back in.</div>
      ) : null}
      {plan.notes?.map((n) => (
        <div key={n} className="banner info"><b>Short on room</b>{n}</div>
      ))}
      {benchmarks ? (
        <div className="banner info"><b>Benchmark session</b>The first set of each new exercise is a test set: as many good reps as you can, stopping with about two left. It sets your working weights.</div>
      ) : null}

      <section className="card">
        {plan.kind === "strength" ? <Lineup plan={plan} units={core.profile.units} /> : <CardioLineup plan={plan} />}
      </section>

      <div className="stack">
        <button
          type="button"
          className="btn primary big"
          onClick={() => {
            unlockAudio();
            dispatch({ type: "start", now: Date.now(), minutes });
          }}
        >
          Start session
        </button>
        {plan.kind === "strength" && shorter.length > 0 ? (
          <div className="row-wrap" style={{ alignItems: "center" }}>
            <span className="meta small">Short on time?</span>
            {shorter.map((m) => (
              <button key={m} type="button" className="chip" aria-pressed={minutes === m} onClick={() => setMinutes(minutes === m ? null : m)}>
                {m} min
              </button>
            ))}
          </div>
        ) : null}
        {skipAsk ? (
          <div className="banner adjust">
            <b>Skip this session?</b>
            It's marked as skipped and the next one comes up. Your weights don't change.
            <div className="row" style={{ marginTop: 10 }}>
              <button type="button" className="btn" onClick={() => setSkipAsk(false)}>Keep it</button>
              <button type="button" className="btn danger" onClick={() => { setSkipAsk(false); dispatch({ type: "skip", now: Date.now() }); }}>Skip it</button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn ghost" style={{ alignSelf: "flex-start" }} onClick={() => setSkipAsk(true)}>
            Skip this one
          </button>
        )}
      </div>

      <section className="stack">
        <div className="spread">
          <h2 className="h3">This week</h2>
          {streak > 1 ? <span className="meta small num">{streak}-week streak</span> : null}
        </div>
        <div className="week">
          {slots.map((s) => (
            <div key={s.index} className={`week-day ${s.status}`} title={s.name}>
              <div className="k">{s.kind === "cardio" ? "C" : s.name.replace("Full body ", "")}</div>
              <div className="s">{s.status === "next" ? "next" : s.status === "done" ? "done" : s.status === "skipped" ? "skip" : s.kind === "cardio" ? "cardio" : "lift"}</div>
            </div>
          ))}
        </div>
      </section>

      {last ? (
        <section className="card flat">
          <p className="eyebrow">Last time · {dayLabel(last.finishedAt, now)}</p>
          <p style={{ margin: "4px 0 0", fontWeight: 700 }}>{last.name}</p>
          <p className="meta num">
            {last.activeMinutes} min{last.kind === "strength" ? ` · ${last.sets.length} sets` : last.cardio ? ` · effort ${last.cardio.effort}/10` : ""}
          </p>
        </section>
      ) : null}
    </div>
  );
}
