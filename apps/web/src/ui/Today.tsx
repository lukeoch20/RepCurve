import React, { useMemo, useState } from "react";
import { loadUnitsFor } from "@repcurve/shared";
import { dayLabel, plural } from "../model/format";
import { exerciseCount, timeChoices, todayPlan, weekSlots, weekStreak } from "../model/plan";
import type { Core, SessionRecord } from "../model/types";
import { backupDue } from "../platform/backupReminder";
import { unlockAudio } from "../platform/device";
import { useStore } from "../store/useAppStore";
import { Icon, Stepper } from "./common";
import { CardioLineup, Lineup } from "./Lineup";
import { useTip } from "./tips";
import { SessionGlyph, WeekStrip } from "./Week";

export function Today(props: { core: Core; history: SessionRecord[] }): React.ReactElement {
  const { core, history } = props;
  const { dispatch, storage } = useStore();
  const [minutes, setMinutes] = useState<number | null>(null);
  const [skipAsk, setSkipAsk] = useState(false);
  const now = Date.now();
  // Re-plan at least hourly so "days since your last session" (and a comeback) stays current.
  const hour = Math.floor(now / 3_600_000);
  const plan = useMemo(() => todayPlan(core, history, hour * 3_600_000, minutes), [core, history, minutes, hour]);
  // Today's time, from 10 to 40 minutes, stepping only through lengths that change the session.
  const usual = core.profile.minutesPerSession;
  const choices = useMemo(() => timeChoices(core, history, hour * 3_600_000), [core, history, hour]);
  const chosen = minutes ?? usual;
  let at = 0;
  choices.forEach((m, i) => {
    if (m <= chosen) at = i;
  });
  const less = choices[at - 1];
  const more = choices[at + 1];
  const setTime = (m: number) => setMinutes(m === usual ? null : m);
  const welcomeTip = useTip("today.welcome");
  const weekTip = useTip("today.week");
  const benchmarkTip = useTip("today.benchmark");
  const timeTip = useTip("today.time");
  const remindBackup = backupDue(storage, history[0]?.finishedAt ?? null, now);
  const { week, slots } = useMemo(() => weekSlots(core, history), [core, history]);
  const last = [...history].reverse().find((r) => !r.skipped);
  const streak = weekStreak(history, now);
  const benchmarks = plan.kind === "strength" && [...plan.supersets.flatMap((s) => s.items)].some((p) => p.benchmarkSet);

  return (
    <div className="stack-lg">
      <header className="page-head" ref={welcomeTip}>
        <div className="stack" style={{ gap: 6 }}>
          <p className="eyebrow">
            Week {week} · session {core.nextIndex + 1}
          </p>
          <h1 className="title">{plan.name}</h1>
          <p className="meta num">
            {plan.kind === "strength"
              ? `~${Math.round(plan.estimatedMinutes)} min · ${plural(exerciseCount(plan), "exercise")}${plan.finisher ? " incl. core finisher" : ""}`
              : `${plan.cardio?.totalMinutes ?? plan.budgetMinutes} min · ${plan.cardio?.mode === "treadmill" ? "treadmill" : plan.cardio?.mode === "jump_rope" ? "jump rope" : "walk or jog"}`}
          </p>
        </div>
        <SessionGlyph plan={plan} />
      </header>

      <section className="card stack" style={{ gap: 14 }} ref={weekTip}>
        <div className="spread">
          <span className="eyebrow">This week</span>
          {streak > 1 ? <span className="meta small num">{streak}-week streak</span> : null}
        </div>
        <WeekStrip slots={slots} />
      </section>

      {plan.deload ? (
        <div className="banner info"><b>Deload week</b>Recent sessions were grinders. This week is lighter so you come back stronger.</div>
      ) : null}
      {plan.comeback ? (
        <div className="banner info"><b>Welcome back</b>It's been a couple of weeks, so today eases you back in.</div>
      ) : null}
      {remindBackup ? (
        <div className="banner adjust"><b>Time for a backup</b>Your training is saved only on this device, and it's been a month since the last backup. Export one in Settings.</div>
      ) : null}
      {plan.notes?.map((n) => (
        <div key={n} className="banner info"><b>Short on room</b>{n}</div>
      ))}
      {benchmarks ? (
        <div className="banner info" ref={benchmarkTip}><b>Benchmark session</b>The first set of each new exercise is a test set: as many good reps as you can, stopping with about two left. It sets your working weights.</div>
      ) : null}

      <section className="card stack" style={{ gap: 14 }}>
        <span className="eyebrow accent">Today</span>
        {plan.kind === "strength" ? <Lineup plan={plan} units={loadUnitsFor(core.profile, core.equipment)} tips /> : <CardioLineup plan={plan} />}
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
          <Icon name="arrowRight" size={20} />
        </button>
        <div className="time-adjust" ref={timeTip}>
          <div className="stack" style={{ gap: 2 }}>
            <span className="label">Adjust time</span>
            {minutes !== null ? (
              <button type="button" className="link-btn" onClick={() => setMinutes(null)}>Back to usual ({usual} min)</button>
            ) : (
              <span className="meta small">Your usual length</span>
            )}
          </div>
          <Stepper
            label="Time"
            value={String(chosen)}
            unit="min"
            onDec={() => less !== undefined && setTime(less)}
            onInc={() => more !== undefined && setTime(more)}
            decDisabled={less === undefined}
            incDisabled={more === undefined}
          />
        </div>
        {more === undefined && chosen < 40 ? <p className="meta small" style={{ textAlign: "center" }}>That's everything today's session can add.</p> : null}
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
          <button type="button" className="btn ghost" style={{ alignSelf: "center" }} onClick={() => setSkipAsk(true)}>
            Skip this one
          </button>
        )}
      </div>

      {last ? (
        <section className="card flat">
          <p className="eyebrow">Last time · {dayLabel(last.finishedAt, now)}</p>
          <p className="h3" style={{ marginTop: 6 }}>{last.name}</p>
          <p className="meta num">
            {last.activeMinutes} min{last.kind === "strength" ? ` · ${last.sets.length} sets` : last.cardio ? ` · effort ${last.cardio.effort}/10` : ""}
          </p>
        </section>
      ) : null}
    </div>
  );
}
