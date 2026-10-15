import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { whatRepCurveKnows } from "../model/knows";
import { plural } from "../model/format";
import type { Core, SessionRecord } from "../model/types";
import { useStore } from "../store/useAppStore";
import { Icon } from "./common";

/** Opens the "What RepCurve knows" screen from anywhere in the tabs. */
const OpenKnows = createContext<() => void>(() => {});
export const KnowsOpener = OpenKnows.Provider;

/** The way in, from Settings (a button) or Progress (`card`). */
export function KnowsLink(props: { card?: boolean }): React.ReactElement {
  const open = useContext(OpenKnows);
  const button = (
    <button type="button" className="btn" onClick={open}>
      What RepCurve knows about you
      <Icon name="chevronRight" size={18} />
    </button>
  );
  if (!props.card) return button;
  return (
    <section className="card stack">
      <h2 className="h3">What RepCurve has learned</h2>
      <p className="meta small">Your working weights, what hurt, what you swapped out and how much you do each week. Fix anything that's wrong.</p>
      {button}
    </section>
  );
}

export function Knows(props: { core: Core; history: SessionRecord[]; onClose: () => void }): React.ReactElement {
  const { core, history } = props;
  const { dispatch, actionError } = useStore();
  // A confirmation waits for the change to land in the saved setup; a refused or failed change shows none.
  const [pending, setPending] = useState<{ msg: string; core: Core; error: string | null } | null>(null);
  const [msg, setShown] = useState<string | null>(null);
  const setMsg = (m: string) => setPending({ msg: m, core, error: actionError });
  useEffect(() => {
    if (!pending) return;
    if (core !== pending.core) {
      setShown(pending.msg);
      setPending(null);
    } else if (actionError && actionError !== pending.error) {
      setShown(null);
      setPending(null);
    }
  }, [core, actionError, pending]);
  const day = Math.floor(Date.now() / 86_400_000);
  // Rebuilt when the data changes, and at least daily (cautions lapse with time).
  const k = useMemo(() => whatRepCurveKnows(core, history, day * 86_400_000), [core, history, day]);

  return (
    <div className="stack-lg">
      <header className="stack" style={{ gap: 6 }}>
        <button type="button" className="link-btn" onClick={props.onClose}>
          <Icon name="chevronLeft" size={14} /> Back
        </button>
        <p className="eyebrow">Your profile</p>
        <h1 className="title">What RepCurve knows</h1>
        <p className="meta">All of it comes from what you've logged, and it shapes every session. If something's wrong, fix it here.</p>
      </header>

      {msg ? <div className="banner good" role="status">{msg}</div> : null}

      <section className="card stack" aria-labelledby="knows-level">
        <h2 className="h3" id="knows-level">Your level</h2>
        <p>
          Started as: <b>{k.level.started}</b>.<br />
          Weekly volume set for: <b>{k.level.volume}</b>, {k.level.target[0]}–{k.level.target[1]} hard sets per muscle.
        </p>
        <p className="meta small">
          {k.level.next
            ? `Steps up to ${k.level.next.level} after ${plural(k.level.next.sessions, "more strength session")}.`
            : "This is the top step for where you started."}
        </p>
      </section>

      <section className="card" aria-labelledby="knows-sets">
        <h2 className="h3" id="knows-sets" style={{ marginBottom: 6 }}>Sets each week</h2>
        <p className="meta small">Hard sets per muscle in a week of your plan now. A muscle that helps out counts half.</p>
        {k.weeklySets.map((m) => (
          <div key={m.muscle} className="lift">
            <div className="name">{m.name}</div>
            <span className="num">{m.sets}</span>
          </div>
        ))}
      </section>

      <section className="card stack" aria-labelledby="knows-pain">
        <h2 className="h3" id="knows-pain">Pain</h2>
        {k.cautions.length === 0 ? <p className="meta">Nothing flagged right now.</p> : null}
        {k.cautions.map((c) => (
          <div key={c.area} className="stack" style={{ gap: 4 }}>
            <b>{c.title}</b>
            <span className="meta small">{c.detail} {c.changes}</span>
            {c.lifts ? <span className="meta small">{c.lifts}</span> : null}
            <button
              type="button"
              className="btn small"
              style={{ alignSelf: "flex-start" }}
              aria-label={`${c.area}: it's fine now`}
              onClick={() => {
                dispatch({ type: "cautionFine", area: c.area, now: Date.now() });
                setMsg(`Got it: your ${c.area.toLowerCase()} is fine now. If it hurts again, flag it and the check-ins come back.`);
              }}
            >
              It's fine now
            </button>
          </div>
        ))}
      </section>

      <section className="card stack" aria-labelledby="knows-swaps">
        <h2 className="h3" id="knows-swaps">Exercises you swapped out</h2>
        {k.swaps.length === 0 ? <p className="meta">Nothing to remember yet. When you swap an exercise and say why, it shows here.</p> : null}
        {k.swaps.map((s) => (
          <div key={s.exerciseId} className="stack" style={{ gap: 4 }}>
            <b>{s.name}</b>
            <span className="meta small">{s.what}</span>
            <button
              type="button"
              className="btn small"
              style={{ alignSelf: "flex-start" }}
              aria-label={`${s.name}: ${s.action.toLowerCase()}`}
              onClick={() => {
                dispatch({ type: "forgetSwaps", exerciseId: s.exerciseId, now: Date.now() });
                setMsg(s.action === "Bring it back" ? `${s.name} is back in your plan.` : `Forgotten. ${s.name} is treated like any other exercise.`);
              }}
            >
              {s.action}
            </button>
          </div>
        ))}
      </section>

      {k.soreness.length > 0 ? (
        <section className="card" aria-labelledby="knows-sore">
          <h2 className="h3" id="knows-sore" style={{ marginBottom: 6 }}>Soreness</h2>
          <p className="meta small">From the "Still sore?" check-ins. Very sore means one set fewer that day, at the same weight.</p>
          {k.soreness.map((s) => (
            <div key={s.group} className="lift">
              <div>
                <div className="name">{s.name}</div>
                <div className="now">{s.text}</div>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <section className="card" aria-labelledby="knows-weights">
        <h2 className="h3" id="knows-weights" style={{ marginBottom: 6 }}>Working weights</h2>
        {k.weights.length === 0 ? <p className="meta">Finish a session and your weights show here.</p> : (
          <p className="meta small">What each exercise starts at next time. If one's way off, re-test it: next time its first set is a test set that sets it again.</p>
        )}
        {k.weights.map((w) => (
          <div key={w.exerciseId} className="lift">
            <div>
              <div className="name">{w.name}</div>
              <div className="now">{w.now}</div>
              <div className="now">{w.trend}</div>
            </div>
            {w.canRetest ? (
              <button
                type="button"
                className="btn small"
                aria-label={`Re-test ${w.name}`}
                onClick={() => {
                  dispatch({ type: "retest", exerciseId: w.exerciseId });
                  setMsg(`Next time, ${w.name} starts with a test set.`);
                }}
              >
                Re-test
              </button>
            ) : null}
          </div>
        ))}
      </section>
    </div>
  );
}
