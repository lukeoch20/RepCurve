import React, { useEffect, useMemo, useRef, useState } from "react";
import { alternativesFor, type Prescription } from "@repcurve/engine";
import type { Rir } from "@repcurve/shared";
import { EFFORT_OPTIONS, clock, effortLabel, loadNumber, repsUnit } from "../model/format";
import { contextFor } from "../model/plan";
import {
  elapsedMs,
  loggedSet,
  nextUp,
  prefill,
  progressSummary,
  setsForSlot,
  timerRemainingMs,
  type SetRef,
} from "../model/session";
import { REST_CHOICES, type ActiveSession, type Core } from "../model/types";
import { beep, keepAwake } from "../platform/device";
import { useNow, useStore } from "../store/useAppStore";
import { Seg, Sheet } from "./common";

export function SessionRunner(props: { core: Core; active: ActiveSession }): React.ReactElement {
  const { core, active } = props;
  const { dispatch } = useStore();
  const now = useNow(true, 250);
  const up = nextUp(active);
  const { done, total } = progressSummary(active);
  const [endOpen, setEndOpen] = useState(false);
  const paused = active.pausedAt !== null;

  useEffect(() => {
    if (!core.settings.keepAwake) return;
    keepAwake(true);
    return () => keepAwake(false);
  }, [core.settings.keepAwake]);

  const finish = () => {
    if (active.sets.length === 0) {
      setEndOpen(true);
      return;
    }
    dispatch({ type: "finish", now: Date.now() });
  };

  return (
    <>
      <main className="app stack" style={{ paddingBottom: `calc(${active.timer ? 210 : 40}px + env(safe-area-inset-bottom, 0px))` }}>
        <div className="runner-head">
          <div className="spread">
            <div className="grow">
              <p className="eyebrow">
                Session {active.index + 1} · week {active.plan.week}
                {active.plan.deload ? " · deload" : active.plan.comeback ? " · welcome back" : ""}
              </p>
              <h1 className="h2">{active.plan.name}</h1>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="num" style={{ fontSize: "1.3rem", fontWeight: 700 }} aria-label="Elapsed time">
                {clock(elapsedMs(active, now))}
              </div>
              <div className="meta small num">of ~{Math.round(active.plan.estimatedMinutes)} min</div>
            </div>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button type="button" className="btn" style={{ minHeight: 40 }} onClick={() => dispatch({ type: paused ? "resume" : "pause", now: Date.now() })}>
              {paused ? "Resume" : "Pause"}
            </button>
            <span className="meta small num grow" style={{ textAlign: "center" }}>
              {done} of {total} sets
            </span>
            <button type="button" className="btn" style={{ minHeight: 40 }} onClick={() => setEndOpen(true)}>
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
            Your last few sessions were grinders, so this week is lighter: one round fewer and a dumbbell down. Progress resumes next week.
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
              <span className="h3">Superset {ss.label}</span>
              <span className="meta small num">
                {ss.rounds} rounds · alternate {ss.items.map((_, i) => `${ss.label}${i + 1}`).join(" and ")}
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
              <span className="h3">Core finisher</span>
            </div>
            <ExerciseBlock core={core} active={active} p={active.plan.finisher} tag="Core" group={-1} position={0} up={up} />
          </section>
        ) : null}

        <button type="button" className="btn go big" onClick={finish} style={{ marginTop: 8 }}>
          {up ? "Finish early" : "Finish session"}
        </button>
      </main>

      {active.timer ? <TimerDock core={core} active={active} now={now} /> : null}

      {endOpen ? (
        <Sheet title="End this session?" onClose={() => setEndOpen(false)}>
          {active.sets.length > 0 ? (
            <>
              <p className="prose">Your {active.sets.length} logged sets count, and next time's weights update from them.</p>
              <button type="button" className="btn go big" onClick={() => dispatch({ type: "finish", now: Date.now() })}>
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

function Warmup(props: { active: ActiveSession }): React.ReactElement | null {
  const { dispatch } = useStore();
  const items = props.active.plan.warmup;
  const [open, setOpen] = useState(props.active.sets.length === 0);
  if (items.length === 0) return null;
  const doneCount = items.filter((w) => props.active.warmupDone.includes(w.name)).length;
  return (
    <section className="block">
      <button type="button" className="set-row" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="n">Warm</span>
        <span className="v" style={{ fontFamily: "var(--font-body)", fontWeight: 700 }}>
          Warm-up · {props.active.plan.warmupMinutes} min
        </span>
        <span className="meta small num">
          {doneCount}/{items.length}
        </span>
      </button>
      {open
        ? items.map((w) => {
            const on = props.active.warmupDone.includes(w.name);
            return (
              <div key={w.name} className={`set${on ? " done" : ""}`}>
                <button type="button" className="set-row" onClick={() => dispatch({ type: "warmup", name: w.name })} aria-pressed={on}>
                  <span className="tick" aria-hidden="true">{on ? "✓" : ""}</span>
                  <span>
                    <b>{w.name}</b>
                    <span className="meta small" style={{ display: "block" }}>{w.prescription}</span>
                  </span>
                  <span />
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
  const { dispatch } = useStore();
  const [showCue, setShowCue] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const skipped = active.skippedSlots.includes(p.slot);
  const logged = setsForSlot(active, p.slot);
  const advice = active.advice[p.slot];
  const units = core.profile.units;
  const unit = repsUnit(p.loadType);

  const target = `aim ${p.targetReps}${p.loadType === "time" ? " s" : ""}${p.unilateral ? " per side" : ""} · range ${p.repRange[0]}–${p.repRange[1]}${p.loadKg !== null ? ` · ${p.loadDisplay}` : ""}`;

  return (
    <article className={`block${skipped ? " skipped" : ""}`}>
      <div className="block-head">
        <div className="block-tag">{tag}</div>
        <div className="grow">
          <div className="block-name">{p.name}</div>
          <div className="block-target">{target}</div>
        </div>
      </div>
      <div className="menu">
        {p.cue ? (
          <button type="button" className="btn" onClick={() => setShowCue(!showCue)} aria-expanded={showCue}>
            How to
          </button>
        ) : null}
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
      {showCue && p.cue ? <p className="cue">{p.cue}</p> : null}
      {p.benchmarkSet && logged.length === 0 && !skipped ? (
        <div className="banner info bench">
          <b>Benchmark set</b>
          First set: as many clean reps as you can, stopping when you could still do about two more (max 20). It sets your working weight.
        </div>
      ) : null}
      {advice?.message ? (
        <div className={`banner ${advice.tone === "good" ? "good" : advice.tone === "stop" ? "stop" : "adjust"} advice`} role="status">
          {advice.message}
        </div>
      ) : null}
      {Array.from({ length: p.sets }, (_, setIndex) => {
        const done = loggedSet(active, p.slot, setIndex);
        const isUp = !!up && up.slot === p.slot && up.setIndex === setIndex;
        const open = !skipped && (editing === setIndex || (isUp && editing === null));
        const ref: SetRef = { slot: p.slot, exerciseId: p.exerciseId, setIndex, group, round: setIndex, position, label: tag };
        return (
          <div key={setIndex} className={`set${done ? (done.painFlag ? " pain" : " done") : ""}${isUp ? " current" : ""}`} data-current={isUp || undefined}>
            <button
              type="button"
              className="set-row"
              onClick={() => setEditing(open ? (isUp && editing === null ? -1 : null) : setIndex)}
              aria-expanded={open}
              disabled={skipped}
            >
              <span className="n">Set {setIndex + 1}</span>
              <span className="v">
                {done
                  ? `${done.loadKg !== null ? `${loadNumber(done.loadKg, units)} ${units} × ` : ""}${done.reps}${unit === "s" ? " s" : ""} · ${effortLabel(done.rir)}`
                  : p.benchmarkSet && setIndex === 0
                    ? "benchmark"
                    : isUp
                      ? "up next"
                      : ""}
              </span>
              <span className="tick" aria-hidden="true">{done ? (done.painFlag ? "!" : "✓") : ""}</span>
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
                  if (done) dispatch({ type: "edit", slot: p.slot, setIndex, values });
                  else dispatch({ type: "log", ref, values, now: Date.now() });
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
      {swapOpen ? <SwapSheet core={core} active={active} p={p} onClose={() => setSwapOpen(false)} /> : null}
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
  const owned = contextFor(core).ownedLoadsKg;
  const [loadKg, setLoadKg] = useState<number | null>(initial.loadKg);
  const [reps, setReps] = useState(initial.reps);
  const [rir, setRir] = useState<Rir>(initial.rir);
  const ref = useRef<HTMLDivElement>(null);
  const units = core.profile.units;
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
  const isBenchmark = p.benchmarkSet && setIndex === 0;

  return (
    <div className="editor" ref={ref}>
      <div className="editor-steppers">
        {p.loadKg !== null && loadKg !== null ? (
          <div className="stepper" role="group" aria-label="Weight">
            <button type="button" aria-label="Lighter" onClick={() => stepLoad(-1)} disabled={loadIdx === 0}>−</button>
            <div className="value">
              <b>{loadNumber(loadKg, units)}</b>
              <span>{units}{p.loadType === "dumbbell_pair" ? " each" : ""}</span>
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
      <div className="effort stack" style={{ gap: 6 }}>
        <span className="label">How many more could you have done?</span>
        <Seg label="Effort" value={rir} onChange={setRir} options={EFFORT_OPTIONS.map((o) => ({ value: o.rir, label: o.label }))} />
        <span className="effort-hint">{isBenchmark ? "For the benchmark, stop when you have about 2 left." : effortHint}</span>
      </div>
      <div className="row">
        <button type="button" className="btn go grow" style={{ minHeight: 54, fontSize: "1.05rem" }} onClick={() => props.onSave({ loadKg, reps, rir })}>
          {props.existing ? "Save changes" : `Done · set ${setIndex + 1}`}
        </button>
        {props.existing ? (
          <button type="button" className="btn danger" onClick={props.onDelete}>
            Delete
          </button>
        ) : (
          <button type="button" className="btn danger" onClick={() => props.onSave({ loadKg, reps, rir, painFlag: true })} title="Log the set and flag pain">
            It hurt
          </button>
        )}
      </div>
    </div>
  );
}

function SwapSheet(props: { core: Core; active: ActiveSession; p: Prescription; onClose: () => void }): React.ReactElement {
  const { dispatch } = useStore();
  const [permanent, setPermanent] = useState(false);
  const ctx = contextFor(props.core);
  const inSession = useMemo(
    () => [...props.active.plan.supersets.flatMap((ss) => ss.items), ...(props.active.plan.finisher ? [props.active.plan.finisher] : [])].map((x) => x.exerciseId),
    [props.active.plan],
  );
  const alts = alternativesFor(props.p, ctx, inSession);
  return (
    <Sheet title={`Swap ${props.p.name}`} onClose={props.onClose}>
      <p className="meta">Same movement, different exercise. Pick one you can do right now.</p>
      <div className="choice">
        {alts.length === 0 ? <p className="meta">Nothing else trains this movement with your equipment.</p> : null}
        {alts.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => {
              dispatch({ type: "swap", slot: props.p.slot, exerciseId: e.id, permanent });
              props.onClose();
            }}
          >
            <b>{e.name}</b>
            {e.cue ? <span>{e.cue}</span> : null}
          </button>
        ))}
      </div>
      <label className="toggle" htmlFor="perm">
        <span className="grow">
          <b>Always use this instead</b>
          <span className="meta small" style={{ display: "block" }}>Otherwise the swap is for today only.</span>
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

  useEffect(() => {
    if (over && alerted.current !== t.endsAt) {
      alerted.current = t.endsAt;
      if (props.core.settings.sound) beep("go");
    }
  }, [over, t.endsAt, props.core.settings.sound]);

  return (
    <>
      <div className={`dock${over ? " go" : ""}`} role="timer" aria-live="off">
        <div className="dock-inner">
          <button type="button" className="clock-digits" onClick={() => setChooser(true)} aria-label={`Rest timer ${clock(remaining)}. Tap to change the rest length.`}>
            {over ? "GO" : clock(remaining)}
          </button>
          <div style={{ minWidth: 0 }}>
            <div className="dock-label">{over ? "Rest over" : t.kind === "transition" ? "Switch" : "Rest"}</div>
            <div className="dock-next">Next: {t.next}</div>
          </div>
          <div className="dock-actions">
            <button type="button" onClick={() => dispatch({ type: "timerAdjust", deltaSec: -15, now: Date.now() })} disabled={over}>
              −15 s
            </button>
            <button type="button" onClick={() => dispatch({ type: "timerAdjust", deltaSec: 15, now: Date.now() })}>
              +15 s
            </button>
            <button type="button" onClick={() => dispatch({ type: "timerClear" })}>{over ? "Hide" : "Skip"}</button>
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
