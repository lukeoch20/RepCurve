import React, { useMemo, useState } from "react";
import { mobilityDose, mobilityMinutes } from "@repcurve/engine";
import { MOBILITY_FACTS, MOBILITY_SOURCES, ROUTINES, findDrill, findExercise, findRoutine, type MobilityFact, type Routine } from "@repcurve/exercises";
import { dayLabel, plural } from "../model/format";
import { blockStatus, handsFreeOn, mobilityTotals, routinePlan, stoppedForPain, trainedFamilies, type BlockStatus } from "../model/mobility";
import type { Core, SessionRecord } from "../model/types";
import { unlockAudio } from "../platform/device";
import { useStore } from "../store/useAppStore";
import { Icon, Seg, Sheet, Toggle } from "./common";
import { ExerciseInfo } from "./ExerciseInfo";
import { useTip } from "./tips";

const SOURCE = new Map(MOBILITY_SOURCES.map((s) => [s.id, s]));
const AREA_NAME: Record<string, string> = { knee: "knees", low_back: "lower back", shoulder: "shoulders", wrist: "wrists" };

/** How to do a mobility drill. A light strength exercise borrowed from the library shows the library's own guide. */
export function DrillInfo(props: { id: string; ease?: string[]; onClose: () => void }): React.ReactElement {
  const d = findDrill(props.id);
  if (!d) return <ExerciseInfo exerciseId={props.id} onClose={props.onClose} />;
  const ease = props.ease ?? [];
  return (
    <Sheet title={d.name} onClose={props.onClose}>
      <div className="row-wrap" style={{ gap: 6 }}>
        <span className="example-tag">{d.area}</span>
        <span className="example-tag">{d.kind === "hold" ? "Hold" : "Slow reps"}</span>
      </div>
      <p className="meta">
        {d.kind === "hold" ? "A stretch you hold still while the timer runs." : "A slow, controlled movement at your own pace: no timer."}
        {d.sided ? " One side, then the other." : ""} No equipment needed.
      </p>
      <p className="prose"><b style={{ fontWeight: 600 }}>In short:</b> {d.cue}</p>
      {ease.length > 0 ? (
        <div className="banner info">
          <b>For you</b>
          {ease.join(" ")}
        </div>
      ) : null}
      {d.skipIf ? (
        <div className="banner adjust">
          <b>When to leave it out</b>
          {d.skipIf}
        </div>
      ) : null}
      <section className="howto">
        <h3 className="eyebrow">Setup</h3>
        <p className="prose">{d.howTo.setup}</p>
      </section>
      <section className="howto">
        <h3 className="eyebrow">{d.kind === "hold" ? "Each hold" : "Each rep"}</h3>
        <ol className="howto-steps">
          {d.howTo.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </section>
      <section className="howto">
        <h3 className="eyebrow">Feel for</h3>
        <ul className="howto-list">
          {d.howTo.cues.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </section>
      <section className="howto">
        <h3 className="eyebrow">Avoid</h3>
        <ul className="howto-list avoid">
          {d.howTo.mistakes.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </section>
      <p className="meta small">A firm stretch you can breathe through is the aim. Sharp or pinching pain, numbness or tingling means stop: tap "Something hurts" in a session and it pauses.</p>
    </Sheet>
  );
}

/** A drill name that opens its how-to guide. */
export function DrillName(props: { id: string; name: string; ease?: string[] }): React.ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="exercise-link" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {props.name}
      </button>
      {open ? <DrillInfo id={props.id} {...(props.ease ? { ease: props.ease } : {})} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function Facts(props: { title: string; facts: MobilityFact[]; avoid?: boolean }): React.ReactElement {
  return (
    <section className="howto">
      <h3 className="eyebrow">{props.title}</h3>
      <ul className={`howto-list${props.avoid ? " avoid" : ""}`}>
        {props.facts.map((f) => (
          <li key={f.text}>{f.text}</li>
        ))}
      </ul>
    </section>
  );
}

/** What stretching and mobility work can be expected to do, what it can't, and where that comes from. */
function FactsSheet(props: { onClose: () => void }): React.ReactElement {
  const all = [...MOBILITY_FACTS.does, ...MOBILITY_FACTS.doesnt, ...MOBILITY_FACTS.unsure, ...MOBILITY_FACTS.care];
  const used = [...new Set(all.flatMap((f) => f.sources))].map((id) => SOURCE.get(id)).filter((s) => s !== undefined);
  return (
    <Sheet title="What stretching does" onClose={props.onClose}>
      <p className="meta">What the research supports, said plainly, so you know what these sessions are for.</p>
      <Facts title="What it does" facts={MOBILITY_FACTS.does} />
      <Facts title="What it doesn't" facts={MOBILITY_FACTS.doesnt} avoid />
      <Facts title="What isn't settled" facts={MOBILITY_FACTS.unsure} />
      <Facts title="When to take care" facts={MOBILITY_FACTS.care} avoid />
      <p className="meta small">The cautions are standard professional guidance. No trial has tested who shouldn't stretch.</p>
      <details className="sources">
        <summary className="meta small">Sources ({used.length})</summary>
        <ul className="howto-list">
          {used.map((s) => (
            <li key={s.id}>
              <a href={s.url} target="_blank" rel="noreferrer">{s.authors} ({s.year})</a>, {s.title}. <i>{s.journal}</i>.{" "}
              <span className="meta small">{s.finding}</span>
            </li>
          ))}
        </ul>
      </details>
      <p className="meta small">RepCurve gives general fitness guidance. These sessions aren't treatment for an injury: pain that's sharp, lasts or keeps coming back is worth getting checked.</p>
    </Sheet>
  );
}

/** Whole hours, so plans built from the week's workouts are worked out again now and then, not on every render. */
const hourOf = (now: number) => Math.floor(now / 3_600_000);

/** This week's block sessions as dots: done, and still to do. */
function WeekDots(props: { status: BlockStatus }): React.ReactElement {
  const { thisWeek, perWeek } = props.status;
  return (
    <div className="week-dots" role="img" aria-label={`${thisWeek} of ${perWeek} sessions done this week`}>
      {Array.from({ length: Math.max(perWeek, thisWeek) }, (_, i) => (
        <span key={i} className={i < thisWeek ? "on" : ""} />
      ))}
    </div>
  );
}

/**
 * Mobility as a list: the block in progress, then every routine. On the Plan tab it's a card;
 * opened from Today it fills a sheet (`bare`).
 */
export function MobilitySection(props: { core: Core; history: SessionRecord[]; bare?: boolean }): React.ReactElement {
  const { core, history } = props;
  const now = Date.now();
  const hour = hourOf(now);
  const trained = useMemo(() => trainedFamilies(core, history, hour * 3_600_000), [core, history, hour]);
  const status = blockStatus(core, now);
  const totals = mobilityTotals(core, now);
  const [open, setOpen] = useState<string | null>(null);
  const [facts, setFacts] = useState(false);
  const tip = useTip("plan.mobility", !props.bare);
  const routine = open ? findRoutine(open) : undefined;
  const body = (
    <>
      <p className="meta small">Stretching and slow, controlled drills, apart from your workouts. A few minutes on the floor, no equipment.</p>
      <div className="session-list">
        {ROUTINES.map((r) => {
          const mine = status !== null && status.routine.id === r.id;
          const plan = routinePlan(core, r, mine ? status.level : 0, trained);
          const when = mine ? (status.reviewDue ? `All ${status.total} sessions done` : status.paused ? "Paused" : `Session ${status.done + 1} of ${status.total}`) : r.kind === "block" ? `${r.weeks}-week block` : "Quick session";
          return (
            <button key={r.id} type="button" className={`session-row${mine && !status.paused ? " current" : ""}`} aria-haspopup="dialog" onClick={() => setOpen(r.id)}>
              <span className="glyph" aria-hidden="true"><Icon name="mobility" size={26} /></span>
              <span style={{ minWidth: 0 }}>
                <span className="when" style={{ display: "block" }}>{when}</span>
                <span className="name" style={{ display: "block" }}>{r.name}</span>
                <span className="sub" style={{ display: "block" }}>About {mobilityMinutes(plan)} min · {plural(plan.items.length, "drill")}</span>
              </span>
              <span className="chev"><Icon name="chevronRight" size={18} /></span>
            </button>
          );
        })}
      </div>
      {totals.sessions > 0 ? (
        <p className="meta small num">
          {plural(totals.sessions, "session")} and {plural(totals.minutes, "minute")} in the last year.
        </p>
      ) : null}
      <div>
        <button type="button" className="link-btn" aria-haspopup="dialog" onClick={() => setFacts(true)}>What stretching does, and what it doesn't</button>
      </div>
      {routine ? <RoutineSheet core={core} trained={trained} routine={routine} onClose={() => setOpen(null)} /> : null}
      {facts ? <FactsSheet onClose={() => setFacts(false)} /> : null}
    </>
  );
  if (props.bare) return body;
  return (
    <section className="card stack" aria-labelledby="mobility-title" ref={tip}>
      <h2 className="h3" id="mobility-title">Mobility</h2>
      {body}
    </section>
  );
}

/** One routine: what's in it for this person, what was changed for them, and starting it. */
function RoutineSheet(props: { core: Core; trained: string[]; routine: Routine; onClose: () => void }): React.ReactElement {
  const { core, routine, trained } = props;
  const { dispatch } = useStore();
  const now = Date.now();
  const status = blockStatus(core, now);
  const mine = status !== null && status.routine.id === routine.id ? status : null;
  const [picked, setPicked] = useState(0);
  const [ending, setEnding] = useState(false);
  const [review, setReview] = useState(false);
  const level = mine ? mine.level : Math.min(picked, routine.levels.length - 1);
  const plan = useMemo(() => routinePlan(core, routine, level, trained), [core, routine, level, trained]);
  const minutes = mobilityMinutes(plan);
  const top = routine.levels.length - 1;
  const span = useMemo(() => [mobilityMinutes(routinePlan(core, routine, 0, trained)), mobilityMinutes(routinePlan(core, routine, top, trained))] as const, [core, routine, top, trained]);
  const start = (block: boolean) => {
    unlockAudio();
    dispatch({ type: "mobilityStart", routine: routine.id, level, block, now: Date.now() });
  };
  const empty = plan.items.length === 0;
  const pace = mine && mine.block.level !== undefined;
  const sore = core.profile.injuries.map((i) => AREA_NAME[i]).filter(Boolean);

  return (
    <Sheet title={routine.name} onClose={props.onClose}>
      <p className="meta">{routine.summary} {routine.when}</p>

      {mine ? (
        <section className="card tint stack" style={{ gap: 10 }} aria-label="Your block">
          <div className="spread">
            <b>{mine.reviewDue ? `All ${mine.total} sessions done` : `Session ${mine.done + 1} of ${mine.total}`}</b>
            <span className="meta small num">week {mine.week} of {mine.weeks}</span>
          </div>
          {mine.reviewDue ? (
            <>
              <p className="meta small">That's the whole block. Look back at it and choose what's next.</p>
              <button type="button" className="btn primary" onClick={() => setReview(true)}>Look back at the block</button>
            </>
          ) : (
            <>
              <WeekDots status={mine} />
              <p className="meta small">
                {mine.thisWeek >= mine.perWeek ? `All ${mine.perWeek} done this week.` : `${mine.thisWeek} of ${mine.perWeek} done this week.`} Level {mine.level + 1} of {routine.levels.length}: {routine.levels[mine.level]!.name.toLowerCase()}.
              </p>
              {mine.levelNote ? <p className="meta small" role="status">{mine.levelNote}</p> : null}
              {mine.paused ? (
                <div className="row-wrap">
                  <button type="button" className="btn primary" onClick={() => dispatch({ type: "blockResume" })}>Resume the block</button>
                </div>
              ) : null}
            </>
          )}
        </section>
      ) : routine.kind === "block" ? (
        <div className="banner info">
          <b>{routine.weeks} weeks, {routine.perWeek} sessions a week</b>
          About {span[0]} minutes a session at first and {span[1]} by the end: roughly {(routine.perWeek ?? 0) * span[0]} to {(routine.perWeek ?? 0) * span[1]} minutes a week on top of your workouts. Sessions run in order, so a missed day just waits. At the end you look back and decide what's next.
          <div className="row-wrap" style={{ marginTop: 10 }}>
            <button type="button" className="btn primary" onClick={() => dispatch({ type: "blockStart", routine: routine.id, now: Date.now() })}>Start the {routine.weeks} weeks</button>
          </div>
        </div>
      ) : null}

      {!mine && routine.levels.length > 1 ? (
        <div className="field">
          <span className="label">Or try one session</span>
          <Seg label="Level" value={level} onChange={setPicked} options={routine.levels.map((_, i) => ({ value: i, label: `Level ${i + 1}` }))} />
          <span className="meta small">{routine.levels[level]!.name}. {routine.levels[level]!.note}</span>
        </div>
      ) : null}

      {empty ? (
        <div className="banner adjust" role="status">
          <b>Nothing left to do</b>
          Every drill of this routine is left out. Bring one back below to start it.
        </div>
      ) : mine && (mine.paused || mine.reviewDue) ? null : (
        <button type="button" className={`btn big${routine.kind === "block" && !mine ? "" : " primary"}`} onClick={() => start(mine !== null)}>
          Start this session
        </button>
      )}

      <section className="howto">
        <h3 className="eyebrow">The drills · about {minutes} min</h3>
        <div className="lineup">
          {plan.items.map((it) => (
            <div className="drill-row" key={it.id}>
              <div className="lineup-item">
                <span className="what"><DrillName id={it.id} name={it.name} ease={it.ease} /></span>
                <span className="dose">{mobilityDose(it)}</span>
              </div>
              {it.ease.length > 0 ? <p className="meta small">{it.ease.join(" ")}</p> : null}
              {stoppedForPain(core, it.id) ? <p className="meta small warn">You stopped this for pain last time.</p> : null}
              <div>
                <button type="button" className="link-btn" aria-label={`Leave out ${it.name}`} onClick={() => dispatch({ type: "mobilityLeaveOut", routine: routine.id, drill: it.id, out: true })}>
                  Leave out
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {plan.changes.length > 0 ? (
        <div className="banner info" role="status">
          <b>Changed for you</b>
          <ul className="howto-list" style={{ marginTop: 4 }}>
            {plan.changes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          {sore.length > 0 ? <p className="meta small" style={{ marginTop: 6 }}>From the areas you go easy on. Change them under Settings, Edit profile, schedule and equipment.</p> : null}
        </div>
      ) : null}

      {plan.leftOut.length > 0 ? (
        <section className="howto">
          <h3 className="eyebrow">Left out by you</h3>
          {plan.leftOut.map((d) => (
            <div key={d.id} className="lift">
              <div className="name">{d.name}</div>
              <button type="button" className="btn small" aria-label={`Bring back ${d.name}`} onClick={() => dispatch({ type: "mobilityLeaveOut", routine: routine.id, drill: d.id, out: false })}>
                Bring back
              </button>
            </div>
          ))}
        </section>
      ) : null}

      <div>
        <Toggle
          id="routine-hands-free"
          label="Hands-free"
          hint="Each hold starts by itself after a short countdown. Off: it waits for your tap."
          checked={handsFreeOn(core)}
          onChange={(on) => dispatch({ type: "mobilityHandsFree", on, now: Date.now() })}
        />
      </div>

      {mine && !mine.reviewDue ? (
        <section className="howto">
          <h3 className="eyebrow">Your block</h3>
          <div className="row-wrap">
            {pace ? (
              <button type="button" className="btn small" onClick={() => dispatch({ type: "blockLevel", level: null })}>Back to the block's own pace</button>
            ) : mine.level > 0 ? (
              <button type="button" className="btn small" onClick={() => dispatch({ type: "blockLevel", level: mine.level - 1 })}>Stay at level {mine.level} for now</button>
            ) : null}
            {mine.paused ? null : <button type="button" className="btn small" onClick={() => dispatch({ type: "blockPause", now: Date.now() })}>Pause the block</button>}
            <button type="button" className="btn small danger" onClick={() => setEnding(true)}>End the block</button>
          </div>
          {ending ? (
            <div className="banner adjust" role="alertdialog" aria-label="End the block?">
              <b>End the block?</b>
              Its {plural(mine.done, "finished session")} stay in your history, and the routine stays here for one-off sessions.
              <div className="row" style={{ marginTop: 10 }}>
                <button type="button" className="btn" onClick={() => setEnding(false)}>Keep it</button>
                <button type="button" className="btn danger" onClick={() => { setEnding(false); dispatch({ type: "blockEnd" }); }}>End it</button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <p className="meta small">General guidance, not treatment for an injury. A firm stretch is fine; sharp or pinching pain, numbness or tingling means stop.</p>
      {review ? <BlockReview core={core} onClose={() => setReview(false)} /> : null}
    </Sheet>
  );
}

/** The end of a block: what was done, and what's next. */
export function BlockReview(props: { core: Core; onClose: () => void }): React.ReactElement | null {
  const { dispatch } = useStore();
  const status = blockStatus(props.core, Date.now());
  if (!status) return null;
  const mine = (props.core.mobility?.log ?? []).filter((e) => e.routine === status.routine.id && e.blockSession !== undefined && e.finishedAt >= status.block.startedAt);
  const minutes = mine.reduce((n, e) => n + e.minutes, 0);
  const last = mine[mine.length - 1];
  const weeks = last ? Math.max(1, Math.round((last.finishedAt - status.block.startedAt) / (7 * 86_400_000))) : status.weeks;
  return (
    <Sheet title="Looking back" onClose={props.onClose}>
      <p className="prose">
        {status.routine.name}: {plural(mine.length, "session")} and {minutes} minutes over {plural(weeks, "week")}.
      </p>
      <p className="prose">What matters now is what's changed for you. Sit cross-legged, sink into the bottom of a squat, get up off the floor: is any of it easier than when you started?</p>
      <button
        type="button"
        className="btn primary big"
        onClick={() => {
          dispatch({ type: "blockAgain", now: Date.now() });
          props.onClose();
        }}
      >
        Go another {status.weeks} weeks
      </button>
      <p className="meta small">Stays at level {status.routine.levels.length}, {status.perWeek} sessions a week.</p>
      <button
        type="button"
        className="btn big"
        onClick={() => {
          dispatch({ type: "blockEnd" });
          props.onClose();
        }}
      >
        Finish the block
      </button>
      <p className="meta small">The routine stays in Mobility for one-off sessions whenever you like.</p>
    </Sheet>
  );
}

/**
 * Mobility on Today. With a block running: its next session beside today's workout, with what
 * it adds to the day and what comes first. Otherwise a way in to the routines.
 */
export function MobilityToday(props: {
  core: Core;
  history: SessionRecord[];
  /** Today's workout, for the day's total. */
  workout: { name: string; minutes: number };
  /** A workout was already finished today, so the one on screen is the next one. */
  trainedToday?: boolean;
  /** A shorter workout that makes room for the session inside the usual time, when there is one. */
  fit?: { minutes: number; usual: number; apply: () => void } | null;
}): React.ReactElement {
  const { core, history } = props;
  const { dispatch } = useStore();
  const now = Date.now();
  const hour = hourOf(now);
  const trained = useMemo(() => trainedFamilies(core, history, hour * 3_600_000), [core, history, hour]);
  const status = blockStatus(core, now);
  const [browse, setBrowse] = useState(false);
  const [review, setReview] = useState(false);
  const plan = useMemo(() => (status ? routinePlan(core, status.routine, status.level, trained) : null), [core, status?.routine, status?.level, trained]);
  const sheet = browse ? (
    <Sheet title="Mobility" onClose={() => setBrowse(false)}>
      <MobilitySection core={core} history={history} bare />
    </Sheet>
  ) : null;

  if (!status || status.paused || !plan) {
    return (
      <>
        <button type="button" className="session-row" aria-haspopup="dialog" onClick={() => setBrowse(true)}>
          <span className="glyph" aria-hidden="true"><Icon name="mobility" size={26} /></span>
          <span style={{ minWidth: 0 }}>
            <span className="when" style={{ display: "block" }}>{status?.paused ? "Mobility · block paused" : "Mobility"}</span>
            <span className="name" style={{ display: "block" }}>Stretch and loosen up</span>
            <span className="sub" style={{ display: "block" }}>A six-week hips block and quick sessions · 5 to 15 min</span>
          </span>
          <span className="chev"><Icon name="chevronRight" size={18} /></span>
        </button>
        {sheet}
      </>
    );
  }

  const minutes = mobilityMinutes(plan);
  const short = status.routine.short;
  return (
    <section className="card stack" style={{ gap: 12 }} aria-labelledby="mobility-today">
      <span className="eyebrow">Mobility · week {status.week} of {status.weeks}</span>
      {status.reviewDue ? (
        <>
          <h2 className="h3" id="mobility-today">{short}: all {status.total} sessions done</h2>
          <p className="meta small">That's the whole block. Look back at it and choose what's next.</p>
          <button type="button" className="btn" onClick={() => setReview(true)}>Look back at the block</button>
        </>
      ) : (
        <>
          <div className="stack" style={{ gap: 4 }}>
            <h2 className="h3" id="mobility-today">{short}: session {status.done + 1} of {status.total}</h2>
            <p className="meta small num">
              About {minutes} min · {plural(plan.items.length, "drill")} · {status.thisWeek} of {status.perWeek} done this week
            </p>
          </div>
          <WeekDots status={status} />
          <p className="meta small">
            {status.doneToday
              ? "Done for today. The next one is ready whenever you are."
              : status.thisWeek >= status.perWeek
                ? `This week's ${status.perWeek} are done. Another is fine if you feel like it, but it's extra.`
                : props.trainedToday
                  ? "Today's workout is done, so this is a good time for it."
                  : `Your workout comes first. Do this after it or on a day off: with today's ${props.workout.name.toLowerCase()} it comes to about ${Math.round(props.workout.minutes) + minutes} minutes.`}
          </p>
          {status.levelNote ? <p className="meta small" role="status">{status.levelNote}</p> : null}
          {props.fit && !props.trainedToday && !status.doneToday && status.thisWeek < status.perWeek ? (
            <button type="button" className="link-btn" onClick={props.fit.apply}>
              Only have {props.fit.usual} minutes? Shorten today's workout to {props.fit.minutes}
            </button>
          ) : null}
          <button
            type="button"
            className="btn"
            onClick={() => {
              unlockAudio();
              dispatch({ type: "mobilityStart", routine: status.routine.id, level: status.level, block: true, now: Date.now() });
            }}
          >
            <Icon name="mobility" size={18} />
            Start {short.toLowerCase()} session
          </button>
        </>
      )}
      <div>
        <button type="button" className="link-btn" aria-haspopup="dialog" onClick={() => setBrowse(true)}>All mobility routines</button>
      </div>
      {sheet}
      {review ? <BlockReview core={core} onClose={() => setReview(false)} /> : null}
    </section>
  );
}

/** Mobility on the Progress tab: sessions, minutes and the latest few. Nothing until there's one to show. */
export function MobilityProgress(props: { core: Core; now: number }): React.ReactElement | null {
  const { core, now } = props;
  const totals = mobilityTotals(core, now);
  if (totals.sessions === 0) return null;
  const status = blockStatus(core, now);
  const log = core.mobility?.log ?? [];
  const name = (id: string) => findRoutine(id)?.name ?? "Mobility";
  return (
    <section className="card stack" aria-labelledby="mobility-progress">
      <div className="spread">
        <h2 className="h3" id="mobility-progress">Mobility</h2>
        <span className="meta small num">{totals.thisWeek} this week</span>
      </div>
      <p className="meta small num">
        {plural(totals.sessions, "session")} and {totals.minutes} minutes in the last year.
        {status ? ` ${status.routine.short} block: ${status.done} of ${status.total} sessions${status.paused ? ", paused" : ""}.` : ""}
      </p>
      {status ? (
        <div className="meter" role="img" aria-label={`${status.done} of ${status.total} block sessions done`}>
          <i style={{ width: `${(status.done / status.total) * 100}%` }} />
        </div>
      ) : null}
      <div>
        {[...log].reverse().slice(0, 4).map((e) => {
          const stopped = e.drills.filter((d) => d.hurt).map((d) => (findDrill(d.id)?.name ?? findExercise(d.id)?.name ?? d.id).toLowerCase());
          return (
            <div key={e.id} className="lift">
              <div>
                <div className="name">{name(e.routine)}</div>
                <div className="now">
                  {dayLabel(e.finishedAt, now)} · {e.minutes} min{e.blockSession !== undefined ? ` · session ${e.blockSession}` : ""}
                  {stopped.length > 0 ? ` · stopped ${stopped.join(", ")}` : ""}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
