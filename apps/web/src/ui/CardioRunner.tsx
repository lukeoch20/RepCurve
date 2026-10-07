import React, { useEffect, useRef, useState } from "react";
import { clock } from "../model/format";
import { cardioMinutesDone, cardioRemainingMs, elapsedMs } from "../model/session";
import type { ActiveSession, Core } from "../model/types";
import { beep, keepAwake, unlockAudio } from "../platform/device";
import { useNow, useStore } from "../store/useAppStore";
import { Sheet, TimerRing } from "./common";

const INTENT: Record<string, string> = { warmup: "Warm-up", easy: "Easy", steady: "Steady", hard: "Hard", cooldown: "Cool-down" };

export function CardioRunner(props: { core: Core; active: ActiveSession }): React.ReactElement {
  const { core, active } = props;
  const { dispatch } = useStore();
  const c = active.cardio!;
  const plan = active.plan.cardio!;
  const running = c.started && !c.finished && active.pausedAt === null;
  const now = useNow(true, 250);
  const [finishOpen, setFinishOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const lastSegment = useRef(c.segmentIndex);

  useEffect(() => {
    if (!core.settings.keepAwake) return;
    keepAwake(true);
    return () => keepAwake(false);
  }, [core.settings.keepAwake]);

  // Advance segments as their time runs out.
  useEffect(() => {
    if (running && c.segmentEndsAt !== null && now >= c.segmentEndsAt) dispatch({ type: "cardioTick", now });
  }, [now, running, c.segmentEndsAt, dispatch]);

  useEffect(() => {
    if (c.segmentIndex !== lastSegment.current || c.finished) {
      lastSegment.current = c.segmentIndex;
      if (core.settings.sound) beep(c.finished ? "go" : "segment");
    }
    if (c.finished) setFinishOpen(true);
  }, [c.segmentIndex, c.finished, core.settings.sound]);

  const seg = plan.segments[c.segmentIndex]!;
  const remaining = cardioRemainingMs(active, now);

  return (
    <main className="app stack-lg" style={{ paddingBottom: 40 }} onPointerDown={unlockAudio}>
      <header className="stack">
        <p className="eyebrow">
          Session {active.index + 1} · week {active.plan.week} · {plan.mode === "treadmill" ? "treadmill" : "outdoors"}
        </p>
        <h1 className="title">{active.plan.name}</h1>
        <p className="meta num">
          {plan.totalMinutes} min planned · {clock(elapsedMs(active, now))} so far
        </p>
      </header>

      <section className="cardio-clock" aria-label="Segment timer">
        <div className="ring" role="timer">
          <TimerRing fraction={c.finished ? 1 : remaining / Math.max(1, seg.minutes * 60_000)} size={132} />
          <span className="face">
            <span className="t">{c.finished ? "Done" : clock(remaining)}</span>
            <span className="l">{running ? "running" : c.finished ? "finished" : "paused"}</span>
          </span>
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="dock-label">
            {INTENT[seg.intent]} · effort {seg.effort}/10
          </div>
          <div className="dock-next" style={{ marginTop: 4 }}>{seg.note ?? effortWords(seg.effort)}</div>
        </div>
      </section>

      <div className="row">
        {!c.started ? (
          <button type="button" className="btn primary big" onClick={() => { unlockAudio(); dispatch({ type: "cardioStart", now: Date.now() }); }}>
            Start
          </button>
        ) : c.finished ? (
          <button type="button" className="btn go big" onClick={() => setFinishOpen(true)}>
            Log it
          </button>
        ) : (
          <>
            <button type="button" className="btn big grow" onClick={() => dispatch({ type: active.pausedAt ? "resume" : "pause", now: Date.now() })}>
              {active.pausedAt ? "Resume" : "Pause"}
            </button>
            <button type="button" className="btn big grow" onClick={() => dispatch({ type: "cardioNext", now: Date.now() })}>
              Next part
            </button>
          </>
        )}
      </div>

      <section className="segments" aria-label="Plan">
        {plan.segments.map((s, i) => (
          <div key={i} className={`segment${i === c.segmentIndex && !c.finished ? " now" : ""}${i < c.segmentIndex || c.finished ? " past" : ""}${s.intent === "hard" ? " hard" : ""}`}>
            <span className="m">{s.minutes} min</span>
            <span>{INTENT[s.intent]}{s.note ? <span className="meta small"> · {s.note}</span> : null}</span>
            <span className="e">{s.effort}/10</span>
          </div>
        ))}
      </section>

      <div className="row">
        <button type="button" className="btn grow" onClick={() => setFinishOpen(true)}>
          {c.finished ? "Log it" : "Finish early"}
        </button>
        <button type="button" className="btn danger" onClick={() => setDiscardOpen(true)}>
          Discard
        </button>
      </div>

      {discardOpen ? (
        <div className="banner stop" role="alertdialog" aria-label="Discard this session?">
          <b>Discard this session?</b>
          Nothing from it will be saved.
          <div className="row" style={{ marginTop: 10 }}>
            <button type="button" className="btn" onClick={() => setDiscardOpen(false)}>Keep going</button>
            <button type="button" className="btn danger solid" onClick={() => dispatch({ type: "discard" })}>Discard</button>
          </div>
        </div>
      ) : null}

      {finishOpen ? <CardioFinish active={active} now={now} onClose={() => setFinishOpen(false)} /> : null}
    </main>
  );
}

function effortWords(effort: number): string {
  if (effort <= 3) return "Easy: you could chat the whole time.";
  if (effort <= 6) return "Steady: you can talk in short sentences.";
  return "Hard: a few words at a time.";
}

function CardioFinish(props: { active: ActiveSession; now: number; onClose: () => void }): React.ReactElement {
  const { dispatch } = useStore();
  const [effort, setEffort] = useState(6);
  const [notes, setNotes] = useState("");
  const minutes = cardioMinutesDone(props.active, props.now);
  return (
    <Sheet title="Log your cardio" onClose={props.onClose}>
      <p className="meta num">{minutes} minutes done.</p>
      <div className="field">
        <span className="label">How hard was it overall? ({effort}/10)</span>
        <div className="weights" role="group" aria-label="Overall effort">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <button key={n} type="button" className="chip" aria-pressed={effort === n} onClick={() => setEffort(n)}>
              {n}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label htmlFor="cardio-notes">Speed, incline, anything to remember</label>
        <input id="cardio-notes" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="3.4 mph, 8% incline" />
      </div>
      <button type="button" className="btn go big" onClick={() => dispatch({ type: "finish", now: Date.now(), cardio: { minutes, effort, notes } })}>
        Save
      </button>
    </Sheet>
  );
}
