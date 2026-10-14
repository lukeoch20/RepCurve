import React, { useMemo, useState } from "react";
import { loadUnitsFor } from "@repcurve/shared";
import { ACTIVITY_NAME, cardioLabel, dayLabel, plural } from "../model/format";
import { contextFor, exerciseCount, timeChoices, todayPlan, weekSlots, weekStreak } from "../model/plan";
import type { Core, SessionRecord } from "../model/types";
import { backupDue } from "../platform/backupReminder";
import { BackupButton } from "./Backup";
import { ReminderPrompt } from "./Reminders";
import { canSuggestInstall, isIOS } from "../platform/install";
import { unlockAudio } from "../platform/device";
import { useStore } from "../store/useAppStore";
import { Icon, Seg, Stepper } from "./common";
import { placesOf } from "../model/equipment";
import { CardioLineup, Lineup } from "./Lineup";
import { useTip } from "./tips";
import { ChallengeCard } from "./Trophies";
import { badges, monthChallenge, RETURN_GAP_DAYS } from "../model/gamify";
import { SessionGlyph, WeekStrip } from "./Week";

const DAY_MS = 86_400_000;

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
  const splitTip = useTip("today.split", plan.kind === "strength" && contextFor(core).split !== "full_body");
  const benchmarkTip = useTip("today.benchmark");
  const timeTip = useTip("today.time");
  // Safari can clear a website's data after a week without a visit; a Home Screen app keeps it.
  const remindInstall = storage === "device" && isIOS() && canSuggestInstall() && history.some((r) => !r.skipped);
  const remindBackup = backupDue(storage, history.filter((r) => !r.skipped).map((r) => r.finishedAt), now);
  const { week, slots } = useMemo(() => weekSlots(core, history), [core, history]);
  const last = [...history].reverse().find((r) => !r.skipped);
  // Days since the last session, once it's been a week or more: coming back gets a warm welcome and a badge.
  const away = last && now - last.finishedAt >= RETURN_GAP_DAYS * DAY_MS ? Math.floor((now - last.finishedAt) / DAY_MS) : null;
  const returnBadge = useMemo(() => {
    if (away === null) return null;
    const next = badges(history, core).find((b) => b.id.startsWith("return-") && !b.earned);
    return next && next.progress && next.progress.have + 1 >= next.progress.need ? next.name : null;
  }, [away, history, core]);
  const streak = weekStreak(history, now);
  const benchmarks = plan.kind === "strength" && [...plan.supersets.flatMap((s) => s.items)].some((p) => p.benchmarkSet);

  return (
    <div className="stack-lg">
      <header className="page-head" ref={welcomeTip}>
        <div className="stack" style={{ gap: 6 }}>
          <p className="eyebrow">
            Week {week} · session {core.nextIndex + 1}
          </p>
          <h1 className="title" ref={splitTip}>{plan.name}</h1>
          <p className="meta num">
            {plan.kind === "strength"
              ? `~${Math.round(plan.estimatedMinutes)} min · ${plural(exerciseCount(plan), "exercise")}${plan.finisher ? " incl. core finisher" : ""}`
              : `${plan.cardio?.totalMinutes ?? plan.budgetMinutes} min · ${cardioLabel(plan.cardio).toLowerCase()}`}
          </p>
        </div>
        <SessionGlyph plan={plan} />
      </header>

      {placesOf(core).length === 2 && core.locations ? (
        <div className="field">
          <span className="label">Training at</span>
          <Seg
            label="Training at"
            value={core.locations.at}
            onChange={(at) => dispatch({ type: "location", at })}
            options={[{ value: "home", label: "Home" }, { value: "gym", label: "Gym" }]}
          />
        </div>
      ) : null}

      <section className="card stack" style={{ gap: 14 }} ref={weekTip}>
        <div className="spread">
          <span className="eyebrow">This week</span>
          {streak > 1 ? <span className="meta small num">{streak}-week streak</span> : null}
        </div>
        <WeekStrip slots={slots} />
        {history.some((r) => !r.skipped) ? <ChallengeCard challenge={monthChallenge(history, core, now)} compact /> : null}
      </section>

      {plan.deload ? (
        <div className="banner info"><b>Deload week</b>Recent sessions were grinders. This week is lighter so you come back stronger.</div>
      ) : null}
      {away !== null ? (
        <div className="banner good">
          <b>Welcome back</b>
          {plan.comeback ? "It's been a couple of weeks, so today eases you back in. " : `It's been ${away} days. `}
          Coming back after a break is the habit that matters most{returnBadge ? `, and finishing today earns the ${returnBadge} badge` : ""}.
        </div>
      ) : null}
      {history.some((r) => !r.skipped) ? <ReminderPrompt core={core} /> : null}
      {remindInstall ? (
        <div className="banner adjust">
          <b>Add RepCurve to your Home Screen</b>
          In a Safari tab, your training can be cleared after a week without a visit. Installed, it stays. Tap Share, then Add to Home Screen (Settings shows how).
        </div>
      ) : null}
      {remindBackup ? (
        <div className="banner adjust">
          <b>{remindBackup === "first" ? "Keep your progress safe" : "Time for a backup"}</b>
          {remindBackup === "first"
            ? "Your training is saved only on this phone. A backup takes one tap: save it to Files or iCloud Drive, and you can restore it on any device."
            : "Your training is saved only on this device, and there's been a lot of it since the last backup."}
          <div className="row-wrap" style={{ marginTop: 10 }}>
            <BackupButton />
          </div>
        </div>
      ) : null}
      {plan.coverage?.map((n) => (
        <div key={n} className="banner adjust"><b>Missing a movement</b>{n}</div>
      ))}
      {plan.notes?.map((n) => (
        <div key={n} className="banner info"><b>{n.includes("on purpose") ? "Shorter on purpose" : "Short on room"}</b>{n}</div>
      ))}
      {benchmarks ? (
        <div className="banner info" ref={benchmarkTip}><b>Benchmark session</b>The first set of each new exercise is a test set: as many good reps as you can, stopping with about two left. It sets your working weights.</div>
      ) : null}

      {plan.kind === "cardio" && (plan.cardio?.options?.length ?? 0) > 1 ? (
        <div className="field">
          <span className="label">Activity</span>
          <div className="row-wrap" role="group" aria-label="Activity">
            {plan.cardio!.options!.map((a) => (
              <button key={a} type="button" className="chip" aria-pressed={plan.cardio!.activity === a} onClick={() => dispatch({ type: "settings", settings: { cardioActivity: a } })}>
                {ACTIVITY_NAME[a]}
              </button>
            ))}
          </div>
          <span className="meta small">Same plan and effort on any of them. Your pick is remembered for next time.</span>
        </div>
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
