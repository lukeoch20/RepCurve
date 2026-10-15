import React, { useEffect, useMemo, useRef, useState } from "react";
import { alternativesFor, cautionAreasFor, needsRampSet, swapSticks, type Prescription, type SwapReason } from "@repcurve/engine";
import { getExercise } from "@repcurve/exercises";
import { loadUnitsFor, platesFor, plateText } from "@repcurve/shared";
import type { Rir } from "@repcurve/shared";
import { EFFORT_OPTIONS, clock, effortLabel, loadNumber, plural, repsUnit } from "../model/format";
import { contextFor, exerciseCount } from "../model/plan";
import { profileFor } from "../model/profile";
import {
  MAX_ADDED_SETS,
  addedSets,
  elapsedMs,
  lastSetAt,
  loggedSet,
  looksLeftOpen,
  nextUp,
  prefill,
  progressSummary,
  setCount,
  setsForSlot,
  timerRemainingMs,
  type SetRef,
} from "../model/session";
import { REST_CHOICES, type ActiveSession, type Core } from "../model/types";
import { whyThisLoad } from "../model/why";
import { beep, keepAwake, unlockAudio } from "../platform/device";
import { haptic } from "../platform/haptics";
import { useNow, useStore } from "../store/useAppStore";
import { Icon, Seg, Sheet, TimerRing, Toggle } from "./common";
import { ExerciseInfo, TIER_LABEL } from "./ExerciseInfo";
import { useTip } from "./tips";

export function SessionRunner(props: { core: Core; active: ActiveSession }): React.ReactElement {
  const { core, active } = props;
  const { dispatch } = useStore();
  const now = useNow(true, 250);
  const up = nextUp(active);
  const { done, total } = progressSummary(active);
  const [endOpen, setEndOpen] = useState(false);
  // A workout left open for hours asks once whether it ended back at the last set.
  const [leftOpenAnswered, setLeftOpenAnswered] = useState(false);
  const leftOpen = !leftOpenAnswered && looksLeftOpen(active, now);
  const paused = active.pausedAt !== null;
  // Tutorial tips arrive a few at a time: the basics before the first set, the rest as the session goes on.
  const headTip = useTip("run.head", active.sets.length >= 5);

  useEffect(() => {
    if (!core.settings.keepAwake) return;
    keepAwake(true);
    return () => keepAwake(false);
  }, [core.settings.keepAwake]);

  // Finishing with sets still to do always asks first, so a stray tap can't end the workout.
  const finish = () => {
    if (active.sets.length === 0 || up) {
      setEndOpen(true);
      return;
    }
    if (core.settings.haptics) haptic("session");
    dispatch({ type: "finish", now: Date.now() });
  };

  return (
    <>
      {/* Any tap in the runner (re)enables sound, e.g. after the app was reloaded mid-session. */}
      <main className="app stack" onPointerDown={unlockAudio} style={{ paddingBottom: `calc(${active.timer ? 210 : 40}px + env(safe-area-inset-bottom, 0px))` }}>
        <div className="runner-head" ref={headTip}>
          <div className="spread" style={{ alignItems: "flex-start" }}>
            <div className="grow">
              <p className="eyebrow">
                Session {active.index + 1} · week {active.plan.week}
                {active.plan.deload ? " · deload" : active.plan.comeback ? " · welcome back" : ""}
              </p>
              <h1 className="h2" style={{ marginTop: 4 }}>{active.plan.name}</h1>
              <p className="meta small num">
                ~{Math.round(active.plan.estimatedMinutes)} min · {plural(exerciseCount(active.plan), "exercise")}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="runner-clock" aria-label="Elapsed time">
                {clock(elapsedMs(active, now))}
              </div>
              <div className="meta small">elapsed</div>
            </div>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button type="button" className="btn small" onClick={() => dispatch({ type: paused ? "resume" : "pause", now: Date.now() })}>
              <Icon name={paused ? "play" : "pause"} size={14} strokeWidth={2} />
              {paused ? "Resume" : "Pause"}
            </button>
            <span className="meta small num grow" style={{ textAlign: "center" }}>
              {done} of {total} sets
            </span>
            <button type="button" className="btn small" onClick={() => setEndOpen(true)}>
              End
            </button>
          </div>
          <div className="progress-track" aria-hidden="true">
            <div className="progress-fill" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
          </div>
        </div>

        {paused ? (
          <div className="banner info">
            <b>Paused</b>
            Take the time you need. The clock and rest timer wait for you.
          </div>
        ) : null}
        {active.plan.deload ? (
          <div className="banner info">
            <b>Deload week</b>
            {active.plan.deloadReason === "scheduled" ? "A planned light week after a long run of training" : "Your last few sessions were grinders"}, so this week is
            lighter: one round fewer and a dumbbell down. Progress resumes next week.
          </div>
        ) : null}
        {active.plan.comeback ? (
          <div className="banner info">
            <b>Welcome back</b>
            It's been a while, so today is a little lighter. Next session picks up from what you lift today.
          </div>
        ) : null}

        <Warmup active={active} />

        {active.plan.supersets.map((ss, g) => (
          <section key={ss.label} className="stack" aria-label={`Superset ${ss.label}`}>
            <div className="superset-label">
              <span className="eyebrow">Superset {ss.label}</span>
              <span className="meta small num">
                {ss.rounds} rounds · alternate {ss.items.map((_, i) => `${ss.label}${i + 1}`).join(" and ")}
                {ss.items.some((p) => p.sets < ss.rounds)
                  ? ` · ${ss.items.map((p, i) => (p.sets < ss.rounds ? `${ss.label}${i + 1}` : null)).filter(Boolean).join(" and ")} sits out the last round`
                  : ""}
              </span>
            </div>
            {ss.items.map((p, i) => (
              <ExerciseBlock key={p.slot} core={core} active={active} p={p} tag={`${ss.label}${i + 1}`} group={g} position={i} up={up} />
            ))}
          </section>
        ))}

        {active.plan.finisher ? (
          <section className="stack" aria-label="Core finisher">
            <div className="superset-label">
              <span className="eyebrow">Core finisher</span>
            </div>
            <ExerciseBlock core={core} active={active} p={active.plan.finisher} tag="Core" group={-1} position={0} up={up} />
          </section>
        ) : null}

        <button type="button" className="btn go big" onClick={finish} style={{ marginTop: 8 }}>
          {up ? "Finish early" : "Finish session"}
        </button>
      </main>

      {active.timer ? <TimerDock core={core} active={active} now={now} /> : null}

      {leftOpen ? <LeftOpenSheet core={core} active={active} now={now} onKeepGoing={() => setLeftOpenAnswered(true)} /> : null}

      {endOpen && !leftOpen ? (
        <Sheet title="End this session?" onClose={() => setEndOpen(false)}>
          {active.sets.length > 0 ? (
            <>
              <p className="prose">
                Your {active.sets.length} logged sets count, and next time's weights update from them.
                {up ? " Sets you haven't logged are counted as skipped." : ""}
              </p>
              <button
                type="button"
                className="btn go big"
                onClick={() => {
                  if (core.settings.haptics) haptic("session");
                  dispatch({ type: "finish", now: Date.now() });
                }}
              >
                Finish and save
              </button>
            </>
          ) : (
            <p className="prose">Nothing is logged yet. You can come back to it later, or set it aside and start fresh.</p>
          )}
          <button type="button" className="btn big" onClick={() => setEndOpen(false)}>
            Keep going
          </button>
          <button type="button" className="btn danger big" onClick={() => dispatch({ type: "discard" })}>
            Discard this session
          </button>
        </Sheet>
      ) : null}
    </>
  );
}

/** "Did you finish this workout around 7:42 PM?": save it as ending at the last set, or carry on. */
function LeftOpenSheet(props: { core: Core; active: ActiveSession; now: number; onKeepGoing: () => void }): React.ReactElement {
  const { dispatch } = useStore();
  const last = lastSetAt(props.active)!;
  const at = new Date(last);
  const sameDay = at.toDateString() === new Date(props.now).toDateString();
  const time = at.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const when = sameDay ? time : `${at.toLocaleDateString(undefined, { weekday: "long" })} at ${time}`;
  return (
    <Sheet title="Still going?" onClose={props.onKeepGoing}>
      <p className="prose">Did you finish this workout around {when}? Your last set was logged then.</p>
      <button
        type="button"
        className="btn go big"
        onClick={() => {
          if (props.core.settings.haptics) haptic("session");
          dispatch({ type: "finish", now: Date.now(), at: last });
        }}
      >
        Yes, finish it as of {time}
      </button>
      <button type="button" className="btn big" onClick={props.onKeepGoing}>
        No, keep going
      </button>
    </Sheet>
  );
}

function Warmup(props: { active: ActiveSession }): React.ReactElement | null {
  const { dispatch } = useStore();
  const items = props.active.plan.warmup;
  const [open, setOpen] = useState(props.active.sets.length === 0);
  const tip = useTip("run.warmup", props.active.sets.length === 0);
  if (items.length === 0) return null;
  const doneCount = items.filter((w) => props.active.warmupDone.includes(w.name)).length;
  return (
    <section className="block" ref={tip}>
      <button type="button" className="block-head" style={{ width: "100%", border: 0, background: "transparent", textAlign: "left", paddingBottom: 14 }} onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="block-tag" aria-hidden="true"><Icon name="run" size={16} /></span>
        <span className="grow">
          <span className="block-name" style={{ display: "block" }}>Warm-up</span>
          <span className="block-target" style={{ display: "block" }}>{props.active.plan.warmupMinutes} min · {doneCount} of {items.length} done</span>
        </span>
        <span style={{ display: "inline-flex", transform: open ? "rotate(90deg)" : undefined, color: "var(--muted)" }}>
          <Icon name="chevronRight" size={18} />
        </span>
      </button>
      {open
        ? items.map((w) => {
            const on = props.active.warmupDone.includes(w.name);
            return (
              <div key={w.name} className={`set${on ? " done" : ""}`}>
                <button type="button" className="set-row wide" onClick={() => dispatch({ type: "warmup", name: w.name })} aria-pressed={on}>
                  <span />
                  <span>
                    <b style={{ fontWeight: 500 }}>{w.name}</b>
                    <span className="meta small" style={{ display: "block" }}>{w.prescription}</span>
                  </span>
                  <span className="tick" aria-hidden="true">{on ? <Icon name="check" size={20} strokeWidth={2.4} /> : null}</span>
                </button>
              </div>
            );
          })
        : null}
    </section>
  );
}

function ExerciseBlock(props: {
  core: Core;
  active: ActiveSession;
  p: Prescription;
  tag: string;
  group: number;
  position: number;
  up: SetRef | null;
}): React.ReactElement {
  const { core, active, p, tag, group, position, up } = props;
  const { dispatch, data } = useStore();
  const [infoOpen, setInfoOpen] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [painSet, setPainSet] = useState<number | null>(null);
  const [painChecked, setPainChecked] = useState(false);
  const [gentleSwap, setGentleSwap] = useState(false);
  const skipped = active.skippedSlots.includes(p.slot);
  const logged = setsForSlot(active, p.slot);
  const advice = active.advice[p.slot];
  const units = loadUnitsFor(core.profile, core.equipment);
  const unit = repsUnit(p.loadType);
  const menuTip = useTip("run.menu", group === 0 && position === 0 && active.sets.length >= 4);

  const added = addedSets(active, p.slot);
  const count = setCount(active, p.slot);
  const target = `${p.sets} sets${added > 0 ? ` + ${added} added` : ""} · ${p.targetReps}${p.loadType === "time" ? " s" : " reps"}${p.unilateral ? " per side" : ""} · range ${p.repRange[0]}–${p.repRange[1]}${p.loadKg !== null ? ` · ${p.loadDisplay}` : ""}`;
  const loaded = p.loadKg !== null;
  const barKg = getExercise(p.exerciseId).barKg;
  const why = whyOpen ? whyThisLoad(p, active, data.history, units) : [];
  const whyId = `why-${p.slot}`;
  // The last added set can be taken back while it isn't logged.
  const removable = added > 0 && !loggedSet(active, p.slot, count - 1);
  const loadCell = (loadKg: number | null) => (loadKg !== null ? loadNumber(loadKg, units) : p.loadType === "band" ? "Band" : p.loadType === "time" ? "—" : "BW");

  return (
    <article className={`block${skipped ? " skipped" : ""}`}>
      <div className="block-head">
        <div className="block-tag">{tag}</div>
        <div className="grow">
          <div className="block-name">
            <button type="button" className="exercise-link" aria-haspopup="dialog" onClick={() => setInfoOpen(true)}>{p.name}</button>
          </div>
          <div className="block-target">{target}</div>
          {p.loadType === "barbell" && p.loadKg !== null ? <div className="block-target">{plateText(platesFor(p.loadKg, barKg, units), units)}</div> : null}
          {group > 0 && needsRampSet(p, group) ? (
            <div className="block-target">Warm up first: one easy set of 5 at about half your working weight.</div>
          ) : null}
          <button type="button" className="link-btn why-btn" aria-expanded={whyOpen} aria-controls={whyId} onClick={() => setWhyOpen(!whyOpen)}>
            {loaded ? "Why this weight?" : "Why this target?"}
          </button>
        </div>
      </div>
      {whyOpen ? (
        <div className="why-panel" id={whyId}>
          {why.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      ) : null}
      <div className="menu" ref={menuTip}>
        <button type="button" className="btn" aria-haspopup="dialog" onClick={() => setInfoOpen(true)}>
          How to
        </button>
        {logged.length === 0 && !skipped ? (
          <button type="button" className="btn" onClick={() => setSwapOpen(true)}>
            Swap
          </button>
        ) : null}
        {skipped ? (
          <button type="button" className="btn" onClick={() => dispatch({ type: "unskipSlot", slot: p.slot })}>
            Undo skip
          </button>
        ) : (
          <button type="button" className="btn" onClick={() => dispatch({ type: "skipSlot", slot: p.slot })}>
            Skip
          </button>
        )}
      </div>
      {p.painCheck && logged.length === 0 && !skipped && !painChecked ? (
        <div className="banner adjust" role="status">
          <b>{p.caution ? `Your ${p.caution.toLowerCase()} hurt recently` : "Last time this hurt"}</b>
          {p.caution
            ? `This one works your ${p.caution.toLowerCase()} too. How does it feel today? Go ahead only if it's fine at rest and moving it gently without weight doesn't hurt. It's held steady until your ${p.caution.toLowerCase()} has had a couple of pain-free sessions.`
            : "How does it feel today? Go ahead only if it's fine at rest and moving it gently without weight doesn't hurt. It's kept a step lighter either way."}
          <div className="row-wrap" style={{ marginTop: 10 }}>
            <button type="button" className="btn small" onClick={() => setPainChecked(true)}>Feels fine</button>
            <button type="button" className="btn small" onClick={() => setGentleSwap(true)}>Something gentler</button>
            <button type="button" className="btn small" onClick={() => dispatch({ type: "skipSlot", slot: p.slot })}>Skip it today</button>
          </div>
        </div>
      ) : null}
      {p.benchmarkSet && logged.length === 0 && !skipped ? (
        <div className="banner info bench">
          <b>Benchmark set</b>
          First set: as many clean reps as you can, stopping when you could still do about two more (max 20). It sets your working weight.
        </div>
      ) : null}
      {advice?.message ? (
        <div className={`suggestion${advice.tone === "good" ? "" : advice.tone === "stop" ? " stop" : " adjust"}`} role="status">
          <span className="icon"><Icon name={advice.tone === "good" ? "trendUp" : "alert"} size={18} strokeWidth={2} /></span>
          <span>
            <b>{advice.tone === "good" ? "Suggestion" : advice.tone === "stop" ? "Stop here" : "Adjust"}</b>
            <span style={{ display: "block" }}>{advice.message}</span>
          </span>
        </div>
      ) : null}
      <div className="set-table-head" aria-hidden="true">
        <span style={{ textAlign: "center" }}>Set</span>
        <span>{loaded ? units : "Load"}</span>
        <span>{unit === "s" ? "Sec" : p.unilateral ? "Reps/side" : "Reps"}</span>
        <span>Effort</span>
        <span />
      </div>
      {Array.from({ length: count }, (_, setIndex) => {
        const done = loggedSet(active, p.slot, setIndex);
        const isUp = !!up && up.slot === p.slot && up.setIndex === setIndex;
        const open = !skipped && (editing === setIndex || (isUp && editing === null));
        const ref: SetRef = { slot: p.slot, exerciseId: p.exerciseId, setIndex, group, round: setIndex, position, label: tag };
        const planned = done ? null : prefill(active, p.slot, setIndex);
        const benchmark = !done && p.benchmarkSet && setIndex === 0;
        const label = done
          ? `Set ${setIndex + 1}: ${done.loadKg !== null ? `${loadNumber(done.loadKg, units)} ${units}, ` : ""}${done.reps}${unit === "s" ? " seconds" : " reps"}, ${effortLabel(done.rir)}${done.painFlag ? ", pain" : ""}`
          : `Set ${setIndex + 1}: ${benchmark ? "benchmark" : isUp ? "up next" : "to do"}`;
        return (
          <div key={setIndex} className={`set${done ? (done.painFlag ? " pain" : " done") : ""}${isUp ? " current" : ""}`} data-current={isUp || undefined}>
            <button
              type="button"
              className="set-row"
              onClick={() => setEditing(open ? (isUp && editing === null ? -1 : null) : setIndex)}
              aria-expanded={open}
              aria-label={label}
              disabled={skipped}
            >
              <span className="n">{setIndex + 1}</span>
              <span className={`cell${done ? "" : " plan"}`}>{loadCell(done ? done.loadKg : planned!.loadKg)}</span>
              <span className={`cell${done ? "" : " plan"}`}>{done ? done.reps : benchmark ? "Max" : planned!.reps}</span>
              <span className={`cell${done ? "" : " plan"}`}>{done ? effortLabel(done.rir) : benchmark ? "2 left" : effortLabel(planned!.rir)}</span>
              <span className="tick" aria-hidden="true">
                {done ? done.painFlag ? "!" : <Icon name="check" size={20} strokeWidth={2.4} /> : null}
              </span>
            </button>
            {open ? (
              <SetEditor
                key={`${setIndex}-${done?.at ?? "new"}`}
                core={core}
                active={active}
                p={p}
                setIndex={setIndex}
                existing={!!done}
                onSave={(values) => {
                  if (values.painFlag && !done?.painFlag) setPainSet(setIndex);
                  if (done) dispatch({ type: "edit", slot: p.slot, setIndex, values });
                  else {
                    if (core.settings.haptics) haptic("set");
                    dispatch({ type: "log", ref, values, now: Date.now() });
                  }
                  setEditing(null);
                }}
                onDelete={() => {
                  dispatch({ type: "remove", slot: p.slot, setIndex });
                  setEditing(null);
                }}
              />
            ) : null}
          </div>
        );
      })}
      {!skipped && (added < MAX_ADDED_SETS || removable) ? (
        <div className="add-set">
          {added < MAX_ADDED_SETS ? (
            <button type="button" className="btn" aria-label={`Add a set of ${p.name}`} onClick={() => dispatch({ type: "addSet", slot: p.slot })}>
              Add a set
            </button>
          ) : null}
          {removable ? (
            <button type="button" className="btn" onClick={() => { if (editing === count - 1) setEditing(null); dispatch({ type: "removeAddedSet", slot: p.slot }); }}>
              Remove set {count}
            </button>
          ) : null}
        </div>
      ) : null}
      {infoOpen ? <ExerciseInfo exerciseId={p.exerciseId} onClose={() => setInfoOpen(false)} /> : null}
      {swapOpen ? <SwapSheet core={core} active={active} p={p} onClose={() => setSwapOpen(false)} /> : null}
      {gentleSwap ? <SwapSheet core={core} active={active} p={p} reason="hard" fromPain onClose={() => setGentleSwap(false)} /> : null}
      {painSet !== null ? <PainSheet active={active} slot={p.slot} setIndex={painSet} onClose={() => setPainSet(null)} /> : null}
    </article>
  );
}

function SetEditor(props: {
  core: Core;
  active: ActiveSession;
  p: Prescription;
  setIndex: number;
  existing: boolean;
  onSave: (v: { loadKg: number | null; reps: number; rir: Rir; painFlag?: boolean }) => void;
  onDelete: () => void;
}): React.ReactElement {
  const { core, active, p, setIndex } = props;
  const initial = prefill(active, p.slot, setIndex);
  const exercise = getExercise(p.exerciseId);
  const owned = contextFor(core).loadsFor(exercise);
  const [loadKg, setLoadKg] = useState<number | null>(initial.loadKg);
  const [reps, setReps] = useState(initial.reps);
  const [rir, setRir] = useState<Rir>(initial.rir);
  const [pain, setPain] = useState(loggedSet(active, p.slot, setIndex)?.painFlag === true);
  const ref = useRef<HTMLDivElement>(null);
  const units = loadUnitsFor(core.profile, core.equipment);
  const isTime = p.loadType === "time";
  const step = isTime ? 5 : 1;

  useEffect(() => {
    ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  const loadIdx = loadKg === null ? -1 : owned.findIndex((w) => Math.abs(w - loadKg) < 1e-6);
  const stepLoad = (dir: 1 | -1) => {
    if (loadKg === null || owned.length === 0) return;
    if (loadIdx === -1) {
      const nearest = dir === 1 ? owned.find((w) => w > loadKg) : [...owned].reverse().find((w) => w < loadKg);
      if (nearest !== undefined) setLoadKg(nearest);
      return;
    }
    const n = owned[loadIdx + dir];
    if (n !== undefined) setLoadKg(n);
  };

  const effortHint = EFFORT_OPTIONS.find((o) => o.rir === rir)?.hint ?? "";
  const fresh = !props.existing;
  const setTip = useTip("run.set", fresh);
  const effortTip = useTip("run.effort", fresh);
  const doneTip = useTip("run.done", fresh);
  const hurtTip = useTip("run.hurt", fresh && active.sets.length >= 3);
  const isBenchmark = p.benchmarkSet && setIndex === 0;

  return (
    <div className="editor" ref={ref}>
      <div className="editor-steppers" ref={setTip}>
        {p.loadKg !== null && loadKg !== null ? (
          <div className="stepper" role="group" aria-label="Weight">
            <button type="button" aria-label="Lighter" onClick={() => stepLoad(-1)} disabled={loadIdx === 0}>−</button>
            <div className="value">
              <b>{loadNumber(loadKg, units)}</b>
              <span>{units}{p.loadType === "dumbbell_pair" ? " each" : p.loadType === "barbell" ? " total" : ""}</span>
            </div>
            <button type="button" aria-label="Heavier" onClick={() => stepLoad(1)} disabled={loadIdx === owned.length - 1}>+</button>
          </div>
        ) : (
          <div className="stepper fixed">
            <div className="value">
              <b style={{ fontSize: "1rem" }}>{p.loadType === "band" ? "Band" : isTime ? "Hold" : "Bodyweight"}</b>
            </div>
          </div>
        )}
        <div className="stepper" role="group" aria-label={isTime ? "Seconds" : "Reps"}>
          <button type="button" aria-label={isTime ? "Fewer seconds" : "Fewer reps"} onClick={() => setReps((r) => Math.max(0, r - step))}>−</button>
          <div className="value">
            <b>{reps}</b>
            <span>{isTime ? "seconds" : p.unilateral ? "reps / side" : "reps"}</span>
          </div>
          <button type="button" aria-label={isTime ? "More seconds" : "More reps"} onClick={() => setReps((r) => Math.min(isTime ? 300 : 60, r + step))}>+</button>
        </div>
      </div>
      {p.loadType === "barbell" && loadKg !== null ? (
        <p className="plates" aria-live="polite">{plateText(platesFor(loadKg, exercise.barKg, units), units)}</p>
      ) : null}
      <div className="effort stack" style={{ gap: 6 }} ref={effortTip}>
        <span className="label">How many more could you have done?</span>
        <Seg label="Effort" value={rir} onChange={setRir} options={EFFORT_OPTIONS.map((o) => ({ value: o.rir, label: o.label }))} />
        <span className="effort-hint">{isBenchmark ? "For the benchmark, stop when you have about 2 left." : effortHint}</span>
      </div>
      {props.existing ? (
        <Toggle id={`pain-${p.slot}-${setIndex}`} label="It hurt" hint="Flags pain: this exercise stops for today and comes back lighter, after a check-in." checked={pain} onChange={setPain} />
      ) : null}
      <div className="row">
        <button
          ref={doneTip}
          type="button"
          className="btn go grow"
          style={{ minHeight: 52 }}
          onClick={() => props.onSave(props.existing ? { loadKg, reps, rir, painFlag: pain } : { loadKg, reps, rir })}
        >
          {props.existing ? "Save changes" : `Done · set ${setIndex + 1}`}
        </button>
        {props.existing ? (
          <button type="button" className="btn danger" onClick={props.onDelete}>
            Delete
          </button>
        ) : (
          <button ref={hurtTip} type="button" className="btn danger" onClick={() => props.onSave({ loadKg, reps, rir, painFlag: true })} title="Log the set and flag pain">
            It hurt
          </button>
        )}
      </div>
    </div>
  );
}

const SWAP_REASONS: { value: SwapReason; label: string; hint: string }[] = [
  { value: "busy", label: "It's taken", hint: "Different equipment first. For today only." },
  { value: "hard", label: "Too hard", hint: "Easier and more stable options first." },
  { value: "balance", label: "Couldn't balance", hint: "Two-sided options first." },
  { value: "dislike", label: "Don't like it", hint: "Same job, other ways. Used from now on." },
];

const PAIN_AREAS = ["Knee", "Hip", "Lower back", "Shoulder", "Elbow", "Wrist", "Neck", "Somewhere else"];

/**
 * After "It hurt": the exercise is done for today. Where it hurt is noted, and the signs that mean
 * stopping the whole workout are spelled out. A gentler alternative is offered next time, after a check-in.
 */
function PainSheet(props: { active: ActiveSession; slot: string; setIndex: number; onClose: () => void }): React.ReactElement {
  const { dispatch } = useStore();
  const area = loggedSet(props.active, props.slot, props.setIndex)?.painArea ?? null;
  return (
    <Sheet title="Stopping this exercise" onClose={props.onClose}>
      <p className="meta">That's it for this exercise today. Next time it comes back a step lighter, and you'll be asked how it feels before you start.</p>
      <div className="field">
        <span className="label">Where did it hurt?</span>
        <div className="row-wrap" role="group" aria-label="Where it hurt">
          {PAIN_AREAS.map((a) => (
            <button key={a} type="button" className="chip" aria-pressed={area === a} onClick={() => dispatch({ type: "painArea", slot: props.slot, setIndex: props.setIndex, area: area === a ? null : a })}>
              {a}
            </button>
          ))}
        </div>
      </div>
      <div className="banner stop">
        <b>Stop the whole workout if</b>
        you have chest pain or pressure, feel faint or dizzy, are unusually short of breath, or the pain is severe, a joint gives way, or it swells. Get medical help for chest pain or fainting.
        <div className="row" style={{ marginTop: 10 }}>
          <button type="button" className="btn danger" onClick={() => { props.onClose(); dispatch({ type: "finish", now: Date.now() }); }}>
            End workout
          </button>
        </div>
      </div>
      <p className="meta small">Otherwise carry on with the rest if everything else feels fine. Pain that's sharp or keeps coming back is worth getting checked.</p>
      <button type="button" className="btn primary" onClick={props.onClose}>Carry on</button>
    </Sheet>
  );
}

function SwapSheet(props: { core: Core; active: ActiveSession; p: Prescription; reason?: SwapReason; fromPain?: boolean; onClose: () => void }): React.ReactElement {
  const { dispatch, data } = useStore();
  const [reason, setReason] = useState<SwapReason | undefined>(props.reason);
  // A reason the user picked is remembered; the gentler options offered after pain are not "too hard".
  const [chosen, setChosen] = useState(false);
  const [permanent, setPermanent] = useState(false);
  const [sticks, setSticks] = useState(false);
  const ctx = contextFor(props.core);
  const profile = useMemo(() => profileFor(props.core, data.history, Date.now()), [props.core, data.history]);
  const inSession = useMemo(
    () => [...props.active.plan.supersets.flatMap((ss) => ss.items), ...(props.active.plan.finisher ? [props.active.plan.finisher] : [])].map((x) => x.exerciseId),
    [props.active.plan],
  );
  // Options that spare a recently painful area come first; the others are marked.
  const alts = alternativesFor(props.p, ctx, inSession, reason, profile);
  const areasOf = (id: string) => cautionAreasFor(profile, id).map((a) => a.toLowerCase());
  const allLoadCaution = alts.length > 0 && alts.every((e) => areasOf(e.id).length > 0);
  const pickReason = (r: SwapReason) => {
    setReason(r);
    setChosen(true);
    // Busy equipment is a today problem; not liking an exercise is a for-good one, and so is finding it
    // too hard or unsteady a second time.
    const stick = swapSticks(profile, props.p.exerciseId, r);
    setPermanent(stick);
    setSticks(stick && r !== "dislike");
  };
  return (
    <Sheet title={`Swap ${props.p.name}`} onClose={props.onClose}>
      <div className="field">
        <span className="label">Why swap?</span>
        <div className="row-wrap" role="group" aria-label="Why swap">
          {SWAP_REASONS.map((r) => (
            <button key={r.value} type="button" className="chip" aria-pressed={reason === r.value} onClick={() => pickReason(r.value)}>
              {r.label}
            </button>
          ))}
        </div>
        <span className="meta small">{reason ? SWAP_REASONS.find((r) => r.value === reason)!.hint : "Same job, different exercise. Pick one you can do right now."}</span>
      </div>
      <div className="choice">
        {alts.length === 0 ? <p className="meta">Nothing else does this job with your equipment.</p> : null}
        {props.fromPain && allLoadCaution ? (
          <div className="banner adjust" role="status">
            <b>Every option here works your {areasOf(alts[0]!.id).join(" and ")} too</b>
            Each comes with the same check-in and stays at a steady weight. Skipping it today is fine.
            <div className="row-wrap" style={{ marginTop: 10 }}>
              <button
                type="button"
                className="btn small"
                onClick={() => {
                  dispatch({ type: "skipSlot", slot: props.p.slot });
                  props.onClose();
                }}
              >
                Skip it today
              </button>
            </div>
          </div>
        ) : null}
        {alts.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => {
              dispatch({ type: "swap", slot: props.p.slot, exerciseId: e.id, permanent, now: Date.now(), ...(chosen && reason ? { reason } : {}) });
              props.onClose();
            }}
          >
            <b>
              {e.name}
              {TIER_LABEL[e.tier] ? <span className="example-tag" style={{ marginLeft: 8 }}>{TIER_LABEL[e.tier]}</span> : null}
            </b>
            {e.cue ? <span>{e.cue}</span> : null}
            {areasOf(e.id).length > 0 ? <span className="caution-note">Works your {areasOf(e.id).join(" and ")}: same check-in, steady weight</span> : null}
          </button>
        ))}
      </div>
      <label className="toggle" htmlFor="perm">
        <span className="grow">
          <b>Always use this instead</b>
          <span className="meta small" style={{ display: "block" }}>
            {sticks ? `You've swapped ${props.p.name} for this reason before, so this one sticks. Untick to keep it for today only.` : "Otherwise the swap is for today only."}
          </span>
        </span>
        <input id="perm" type="checkbox" role="switch" className="switch" checked={permanent} onChange={(e) => setPermanent(e.target.checked)} />
      </label>
    </Sheet>
  );
}

function TimerDock(props: { core: Core; active: ActiveSession; now: number }): React.ReactElement | null {
  const { dispatch } = useStore();
  const t = props.active.timer!;
  const remaining = timerRemainingMs(t, props.now, props.active.pausedAt);
  const over = remaining <= 0;
  const [chooser, setChooser] = useState(false);
  const alerted = useRef<number | null>(null);
  // The beep can't be heard by everyone: screen readers announce the end of a rest too.
  const [announce, setAnnounce] = useState("");
  const switchTip = useTip("run.switch", t.kind === "transition");
  const restTip = useTip("run.rest", t.kind !== "transition");

  useEffect(() => {
    if (over && alerted.current !== t.endsAt) {
      alerted.current = t.endsAt;
      if (props.core.settings.sound) beep("go");
      setAnnounce(`${t.kind === "transition" ? "Switch now" : "Rest over"}. Next: ${t.next.replace(" · ", ", ")}`);
    } else if (!over) setAnnounce("");
  }, [over, t.endsAt, t.kind, t.next, props.core.settings.sound]);

  return (
    <>
      <div className="sr-only" role="alert" aria-atomic="true">{announce}</div>
      <div className={`dock${over ? " go" : ""}`} role="timer" aria-live="off" onPointerDown={unlockAudio}>
        <div className="dock-inner" ref={t.kind === "transition" ? switchTip : restTip}>
          <button type="button" className="ring" onClick={() => setChooser(true)} aria-label={`Rest timer ${clock(remaining)}. Tap to change the rest length.`}>
            <TimerRing fraction={over ? 1 : remaining / Math.max(1, t.durationSec * 1000)} size={104} />
            <span className="face">
              <span className="t">{over ? "GO" : clock(remaining)}</span>
              <span className="l">{over ? "Rest over" : t.kind === "transition" ? "Switch" : "Rest"}</span>
            </span>
          </button>
          <div style={{ minWidth: 0 }}>
            <div className="dock-label">Up next</div>
            <div className="dock-next">{t.next}</div>
            <div className="dock-actions">
              <button type="button" onClick={() => dispatch({ type: "timerAdjust", deltaSec: -15, now: Date.now() })} disabled={over}>
                −15 s
              </button>
              <button type="button" onClick={() => dispatch({ type: "timerAdjust", deltaSec: 15, now: Date.now() })}>
                +15 s
              </button>
              <button type="button" className="go" onClick={() => dispatch({ type: "timerClear" })}>{over ? "Hide" : "Skip"}</button>
            </div>
          </div>
        </div>
      </div>
      {chooser ? (
        <Sheet title={t.kind === "transition" ? "Switch time" : "Rest length"} onClose={() => setChooser(false)}>
          <p className="meta">
            {t.kind === "transition"
              ? "Seconds between the two exercises of a pair. Saved for next time too."
              : "Seconds after each round. Saved for next time, and future sessions are planned around it."}
          </p>
          <div className="weights">
            {(t.kind === "transition" ? [10, 15, 20, 30, 45] : REST_CHOICES).map((s) => (
              <button
                key={s}
                type="button"
                className="chip num"
                aria-pressed={t.durationSec === s}
                onClick={() => {
                  dispatch({ type: "settings", settings: t.kind === "transition" ? { transitionSec: s } : { restSec: s } });
                  dispatch({ type: "timerLength", seconds: s });
                  setChooser(false);
                }}
              >
                {s >= 60 ? clock(s * 1000) : `${s}s`}
              </button>
            ))}
          </div>
        </Sheet>
      ) : null}
    </>
  );
}

