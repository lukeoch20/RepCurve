import React, { useEffect, useRef, useState } from "react";
import { mobilityDose, type MobilityItem, type MobilityStep } from "@repcurve/engine";
import { findDrill, findExercise, findRoutine, sideLabel } from "@repcurve/exercises";
import { clock } from "../model/format";
import { blockStatus, currentStep, isCounting, mobilityElapsedMs, mobilityProgress, stepRemainingMs, stoppedForPain, type ActiveMobility, type MobilityEntry } from "../model/mobility";
import type { Core } from "../model/types";
import { beep, keepAwake, unlockAudio } from "../platform/device";
import { haptic } from "../platform/haptics";
import { useNow, useStore } from "../store/useAppStore";
import { Icon, Sheet, TimerRing, Toggle } from "./common";
import { BlockReview, DrillInfo, DrillName } from "./Mobility";
import { PIXEL_ICONS } from "./pixelIcons";
import { useTip } from "./tips";

const PHASE: Record<MobilityStep["kind"], string> = { ready: "Get ready", work: "Hold", switch: "Switch sides", rest: "Rest" };

/** What the step is, in a word or two: "Hold", "Your pace", "Get ready". */
function phase(step: MobilityStep): string {
  return step.kind === "work" && step.seconds === null ? "Your pace" : PHASE[step.kind];
}

/** What a set of reps is counted in: "reps", "switches", "circles each way". */
const unit = (item: MobilityItem): string => item.count ?? "reps";

/** The same in a word, to fit inside the ring. */
function shortUnit(item: MobilityItem): string {
  const u = unit(item);
  return u.length <= 10 ? u : u.split(" ")[0]!;
}

/** What a work step is, beside the ring: "Left knee down · set 1 of 2", "4 circles each way · left leg". */
function where(step: MobilityStep, item: MobilityItem): string {
  const amount = step.seconds === null ? `${item.amount} ${unit(item)}` : "";
  const side = step.side ? sideLabel(item, step.side) : "";
  const set = item.sets > 1 ? `set ${step.set + 1} of ${item.sets}` : "";
  return [amount, amount ? side.toLowerCase() : side, set].filter(Boolean).join(" · ");
}

/** The step read out for screen readers as it starts: the beep can't be heard by everyone. */
function spoken(step: MobilityStep, item: MobilityItem): string {
  const side = step.side ? `, ${sideLabel(item, step.side).toLowerCase()}` : "";
  if (step.kind === "ready") return `Get ready: ${item.name}`;
  if (step.kind === "switch") return "Switch sides";
  if (step.kind === "rest") return `Rest, then set ${step.set + 1}`;
  return step.seconds === null ? `${item.name}${side}: ${item.amount} ${unit(item)}` : `Hold: ${item.name}${side}, ${step.seconds} seconds`;
}

/** A drill's or borrowed exercise's name, for records that only keep the id. */
function nameOf(id: string): string {
  return findDrill(id)?.name ?? findExercise(id)?.name ?? id;
}

/** The side a "switch" step is changing to. */
function nextSide(a: ActiveMobility): MobilityStep["side"] {
  return a.plan.steps[a.stepIndex + 1]?.side;
}

/**
 * A mobility session, one step at a time: get ready, hold or do the reps, switch sides, rest.
 * Holds count down and beep; reps wait for Done. Pause, skip and "Something hurts" are always
 * there, and nothing moves on while the session is paused.
 */
export function MobilityRunner(props: { core: Core; session: ActiveMobility }): React.ReactElement {
  const { core, session: a } = props;
  const { dispatch } = useStore();
  const now = useNow(true, 250);
  const step = currentStep(a);
  const item = step ? a.plan.items[step.item]! : null;
  const paused = a.pausedAt !== null;
  const counting = isCounting(a);
  const remaining = stepRemainingMs(a, now);
  /** The "End this session?" sheet; `resume` when opening it paused a session that was running. */
  const [ending, setEnding] = useState<{ resume: boolean } | null>(null);
  const [hurtOpen, setHurtOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [announce, setAnnounce] = useState("");
  const timerTip = useTip("mobility.timer");
  const routine = findRoutine(a.plan.routine);
  const block = a.block ? blockStatus(core, now) : null;

  useEffect(() => {
    if (!core.settings.keepAwake) return;
    keepAwake(true);
    return () => keepAwake(false);
  }, [core.settings.keepAwake]);

  // Move on as each countdown runs out, with one sound for a hold ending and another for work starting.
  const ticked = useRef<number | null>(null);
  useEffect(() => {
    if (!counting || a.endsAt === null || now < a.endsAt || ticked.current === a.endsAt) return;
    ticked.current = a.endsAt;
    const next = a.plan.steps[a.stepIndex + 1];
    if (core.settings.sound) {
      if (step?.kind === "work") beep(next ? "segment" : "go");
      else if (next?.kind === "work") beep("go");
    }
    if (core.settings.haptics && step?.kind === "work") haptic("set");
    dispatch({ type: "mobilityTick", now });
  }, [now, counting, a.endsAt, a.stepIndex, a.plan.steps, step, core.settings.sound, core.settings.haptics, dispatch]);

  // Every step behind: save it and show the summary.
  useEffect(() => {
    if (!a.finished) return;
    if (core.settings.haptics) haptic("session");
    dispatch({ type: "mobilityFinish", now: Date.now() });
  }, [a.finished, core.settings.haptics, dispatch]);

  useEffect(() => {
    // Once per step, not on every clock tick.
    setAnnounce(step && item ? spoken(step, item) : "");
    window.scrollTo(0, 0);
  }, [a.stepIndex]);

  if (!step || !item) {
    return (
      <main className="app stack" style={{ paddingTop: 48, alignItems: "center" }}>
        <p className="meta">Saving your session…</p>
      </main>
    );
  }

  const timed = step.seconds !== null;
  const waiting = !counting && !paused;
  const at = () => Date.now();
  const next = () => {
    unlockAudio();
    dispatch({ type: "mobilityNext", now: at() });
  };
  const face =
    step.kind === "work" && !timed
      ? { t: String(item.amount), l: shortUnit(item) }
      : waiting
        ? { t: "Ready", l: "tap start" }
        : { t: clock(remaining), l: paused ? "paused" : phase(step).toLowerCase() };
  const go =
    step.kind === "work"
      ? timed
        ? "Next"
        : "Done"
      : step.kind === "ready"
        ? counting ? "Start now" : "Start"
        : step.kind === "switch"
          ? counting ? "Start now" : "Start the other side"
          : counting ? "Start now" : `Start set ${step.set + 1}`;
  const keepGoing = () => {
    if (ending?.resume) dispatch({ type: "mobilityResume", now: at() });
    setEnding(null);
  };
  const hurtBefore = step.kind === "ready" && stoppedForPain(core, item.id);
  const side = step.kind === "switch" ? nextSide(a) : step.side;

  return (
    <>
      <div className="sr-only" role="alert" aria-atomic="true">{announce}</div>
      <main className="app stack" onPointerDown={unlockAudio} style={{ paddingBottom: "calc(40px + env(safe-area-inset-bottom, 0px))" }}>
        <div className="runner-head">
          <div className="spread" style={{ alignItems: "flex-start" }}>
            <div className="grow">
              <p className="eyebrow">
                Mobility{block ? ` · session ${block.done + 1} of ${block.total}` : ""}
                {routine && routine.levels.length > 1 ? ` · level ${a.plan.level + 1}` : ""}
              </p>
              <h1 className="h2" style={{ marginTop: 4 }}>{a.plan.name}</h1>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="runner-clock" aria-label="Elapsed time">{clock(mobilityElapsedMs(a, now))}</div>
              <div className="meta small">elapsed</div>
            </div>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button type="button" className="btn small" onClick={() => dispatch({ type: paused ? "mobilityResume" : "mobilityPause", now: at() })}>
              <Icon name={paused ? "play" : "pause"} size={14} strokeWidth={2} />
              {paused ? "Resume" : "Pause"}
            </button>
            <span className="meta small num grow" style={{ textAlign: "center" }}>
              Drill {step.item + 1} of {a.plan.items.length}
            </span>
            <button
              type="button"
              className="btn small"
              aria-haspopup="dialog"
              onClick={() => {
                // The clock stops while they decide, and picks up again if they keep going.
                if (!paused) dispatch({ type: "mobilityPause", now: at() });
                setEnding({ resume: !paused });
              }}
            >
              End
            </button>
          </div>
          <div className="progress-track" aria-hidden="true">
            <div className="progress-fill" style={{ width: `${mobilityProgress(a) * 100}%` }} />
          </div>
        </div>

        {paused ? (
          <div className="banner info" role="status">
            <b>Paused</b>
            Take the time you need. {timed && step.kind === "work" ? "The hold picks up where it stopped." : "Nothing moves on until you resume."}
          </div>
        ) : null}

        <section className="cardio-clock" aria-label="Now" ref={timerTip}>
          <div className="ring" role="timer" aria-label={!timed ? `${item.amount} ${unit(item)}` : waiting ? "Ready: tap start" : `${phase(step)}: ${clock(remaining)} left${paused ? ", paused" : ""}`}>
            <TimerRing fraction={timed ? remaining / Math.max(1, step.seconds! * 1000) : 1} size={132} />
            <span className="face">
              <span className="t">{face.t}</span>
              <span className="l">{face.l}</span>
            </span>
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="dock-label">{phase(step)}</div>
            <h2 className="block-name" style={{ margin: "4px 0 0" }}>
              <DrillName id={item.id} name={item.name} ease={item.ease} />
            </h2>
            <div className="block-target">
              {step.kind === "ready" || step.kind === "rest" ? mobilityDose(item) : step.kind === "switch" ? (side ? `Next: ${sideLabel(item, side).toLowerCase()}` : "") : where(step, item)}
            </div>
          </div>
        </section>

        {step.kind === "work" || step.kind === "ready" ? <p className="prose">{item.cue}</p> : null}
        {step.kind === "ready" && item.ease.length > 0 ? (
          <div className="banner info">
            <b>For you</b>
            {item.ease.join(" ")}
          </div>
        ) : null}
        {hurtBefore ? (
          <div className="banner adjust" role="status">
            <b>You stopped this one for pain last time</b>
            Start gently, and stop again if it hurts. Skipping it today is fine too.
          </div>
        ) : null}

        <div className="row">
          {paused ? (
            <button type="button" className="btn primary big" onClick={() => dispatch({ type: "mobilityResume", now: at() })}>
              Resume
            </button>
          ) : (
            <button type="button" className={`btn big${step.kind === "work" && timed ? "" : " primary"}`} onClick={next}>
              {go}
            </button>
          )}
        </div>

        <div className="row-wrap">
          <button type="button" className="btn small" aria-haspopup="dialog" onClick={() => setInfoOpen(true)}>
            How to
          </button>
          {step.kind === "work" && timed ? (
            <button type="button" className="btn small" onClick={() => dispatch({ type: "mobilityRestart", now: at() })}>
              Start this hold again
            </button>
          ) : null}
          <button type="button" className="btn small" onClick={() => dispatch({ type: "mobilitySkip", now: at() })}>
            Skip this drill
          </button>
          <button
            type="button"
            className="btn small danger"
            aria-haspopup="dialog"
            onClick={() => {
              // Stop the clock first, then ask.
              dispatch({ type: "mobilityPause", now: at() });
              setHurtOpen(true);
            }}
          >
            Something hurts
          </button>
        </div>

        <section className="segments" aria-label="Drills">
          {a.plan.items.map((it, i) => {
            const state = a.hurt.includes(i) ? "stopped" : a.skipped.includes(i) ? "skipped" : i < step.item ? "done" : "";
            return (
              <div key={it.id} className={`segment drill${i === step.item ? " now" : ""}${i < step.item ? " past" : ""}`}>
                <span className="m">{i + 1}</span>
                <span>
                  {it.name}
                  <span className="meta small" style={{ display: "block" }}>{mobilityDose(it)}</span>
                </span>
                <span className="e">{state}</span>
              </div>
            );
          })}
        </section>

        <div>
          <Toggle
            id="hands-free"
            label="Hands-free"
            hint="Each hold starts by itself after a short countdown. Off: it waits for your tap."
            checked={a.handsFree}
            onChange={(on) => dispatch({ type: "mobilityHandsFree", on, now: at() })}
          />
        </div>
        <p className="meta small">A stretch should feel firm but easy to breathe through. Sharp pain, pinching, numbness or tingling means stop.</p>
      </main>

      {infoOpen ? <DrillInfo id={item.id} ease={item.ease} onClose={() => setInfoOpen(false)} /> : null}

      {hurtOpen ? (
        <Sheet title="Something hurts?" onClose={() => setHurtOpen(false)}>
          <p className="prose">The session is paused. A firm stretch is fine; sharp or pinching pain, numbness or tingling is not, and pushing through it doesn't help.</p>
          <button
            type="button"
            className="btn primary big"
            onClick={() => {
              setHurtOpen(false);
              dispatch({ type: "mobilitySkip", now: at(), hurt: true });
            }}
          >
            Stop this drill
          </button>
          <button
            type="button"
            className="btn big"
            onClick={() => {
              setHurtOpen(false);
              dispatch({ type: "mobilityResume", now: at() });
            }}
          >
            Ease off and carry on
          </button>
          <div className="banner stop">
            <b>End the session if</b>
            the pain is severe or stays after you stop, a joint gives way, or numbness or tingling doesn't settle. Pain that keeps coming back is worth getting checked.
            <div className="row" style={{ marginTop: 10 }}>
              <button type="button" className="btn danger" onClick={() => dispatch({ type: "mobilityFinish", now: at() })}>
                End session
              </button>
            </div>
          </div>
          <p className="meta small">Stopping a drill is noted, so it comes with a reminder next time. Leave it out for good from the routine's page.</p>
        </Sheet>
      ) : null}

      {ending ? (
        <Sheet title="End this session?" onClose={keepGoing}>
          {mobilityProgress(a) > 0 ? (
            <>
              <p className="prose">
                What you've done is saved.
                {block && mobilityProgress(a) < 0.5 ? ` Less than half of it is done, so it won't count as session ${block.done + 1} of your block.` : ""}
              </p>
              <button type="button" className="btn go big" onClick={() => dispatch({ type: "mobilityFinish", now: at() })}>
                Finish and save
              </button>
            </>
          ) : (
            <p className="prose">Nothing is done yet, so there's nothing to save.</p>
          )}
          <button type="button" className="btn big" onClick={keepGoing}>
            Keep going
          </button>
          <button type="button" className="btn danger big" onClick={() => dispatch({ type: "mobilityDiscard" })}>
            Discard this session
          </button>
        </Sheet>
      ) : null}
    </>
  );
}

/** After a mobility session: what was done, where the block stands, and what was stopped. */
export function MobilityFinished(props: { core: Core; entry: MobilityEntry }): React.ReactElement {
  const { core, entry } = props;
  const { dispatch } = useStore();
  const [review, setReview] = useState(false);
  const routine = findRoutine(entry.routine);
  const block = blockStatus(core, entry.finishedAt);
  const inBlock = block !== null && block.routine.id === entry.routine;
  const done = entry.drills.filter((d) => d.doneSec > 0 && !d.skipped).length;
  const stopped = entry.drills.filter((d) => d.hurt);
  // A block body, so the effect returns nothing: newer Chrome hands back a promise from scrollTo,
  // and React would try to call it as the effect's cleanup.
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  // The level the next session is at, when this one was the last of its level.
  const stepsUp = inBlock && entry.blockSession !== undefined && !block.reviewDue && block.level > entry.level ? block.routine.levels[block.level] : null;
  return (
    <main className="app stack-lg" style={{ paddingBottom: 40 }}>
      <header className="celebrate-hero" aria-live="polite">
        <span className="celebrate-badge" aria-hidden="true">
          <svg viewBox="0 0 48 48" width="56" height="56">
            <circle cx="24" cy="24" r="22" fill="var(--accent)" />
            <path className="celebrate-check" d="M14 25 l7 7 l13 -15" fill="none" stroke="var(--accent-ink)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <path className="celebrate-check-px" d={PIXEL_ICONS["check"]} transform="translate(10 10) scale(2.33)" fill="var(--accent-ink)" shapeRendering="crispEdges" />
          </svg>
        </span>
        <p className="eyebrow">Mobility · {routine?.name ?? "session"}</p>
        <h1 className="title">{done === entry.drills.length ? "All of it, done" : "Done for today"}</h1>
        <p className="prose">A few unhurried minutes, banked. Range of motion comes from doing this regularly, not from pushing hard once.</p>
      </header>

      <section className="celebrate-stats" aria-label="This session">
        <div className="stat"><b className="num">{entry.minutes}</b><span>{entry.minutes === 1 ? "minute" : "minutes"}</span></div>
        <div className="stat"><b className="num">{done} of {entry.drills.length}</b><span>drills</span></div>
      </section>

      {inBlock ? (
        <section className="card stack" style={{ gap: 12 }}>
          <div className="spread">
            <h2 className="h3">{block.routine.name}</h2>
            <span className="streak num" style={{ whiteSpace: "nowrap", flex: "none" }}>week {block.week} of {block.weeks}</span>
          </div>
          {entry.blockSession !== undefined ? (
            <>
              <div className="week-dots" role="img" aria-label={`${block.thisWeek} of ${block.perWeek} sessions done this week`}>
                {Array.from({ length: Math.max(block.perWeek, block.thisWeek) }, (_, i) => (
                  <span key={i} className={i < block.thisWeek ? "on" : ""} />
                ))}
              </div>
              <p className="meta small num">
                Session {entry.blockSession} of {block.total} done. {block.thisWeek >= block.perWeek ? `That's all ${block.perWeek} for this week.` : `${block.thisWeek} of ${block.perWeek} this week.`}
              </p>
              {stepsUp ? (
                <p className="meta small">
                  Next time is level {block.level + 1}: {stepsUp.note.charAt(0).toLowerCase()}{stepsUp.note.slice(1)}
                </p>
              ) : null}
            </>
          ) : (
            <p className="meta small">Less than half of today's session was done, so it's saved but session {block.done + 1} is still to come.</p>
          )}
          {block.reviewDue ? (
            <button type="button" className="btn primary" onClick={() => setReview(true)}>
              Look back at the block
            </button>
          ) : null}
        </section>
      ) : null}
      {review ? <BlockReview core={core} onClose={() => setReview(false)} /> : null}

      {stopped.length > 0 ? (
        <div className="banner adjust">
          <b>You stopped {stopped.map((d) => nameOf(d.id).toLowerCase()).join(" and ")}</b>
          Next time it comes with a reminder to start gently. If it keeps hurting, leave it out from the routine's page, and get pain that lasts looked at.
        </div>
      ) : null}

      <section className="card">
        <h2 className="h3" style={{ marginBottom: 6 }}>What you did</h2>
        {entry.drills.map((d) => (
          <div key={d.id} className="lift">
            <div className="name">{nameOf(d.id)}</div>
            <span className="meta small">{d.hurt ? "stopped" : d.doneSec >= d.plannedSec ? "done" : d.doneSec > 0 ? "part" : d.skipped ? "skipped" : "not done"}</span>
          </div>
        ))}
      </section>

      <button type="button" className="btn primary big" onClick={() => dispatch({ type: "mobilityDismiss" })}>
        Done
      </button>
    </main>
  );
}
