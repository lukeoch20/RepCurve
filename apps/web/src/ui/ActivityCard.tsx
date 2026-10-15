import React, { useState } from "react";
import { WHO_AEROBIC_MAX, WHO_AEROBIC_MIN, WHO_STRENGTH_DAYS, extraCredit, weekActivity } from "../model/activity";
import type { Core, SessionRecord } from "../model/types";
import { useStore } from "../store/useAppStore";
import { Toggle } from "./common";

const KINDS = ["Walk", "Run", "Bike", "Swim", "Sport", "Other"];

/** This week against the WHO activity guidelines: aerobic minutes and strength days. */
export function ActivityCard(props: { core: Core; history: SessionRecord[]; now: number }): React.ReactElement {
  const { dispatch } = useStore();
  const w = weekActivity(props.core, props.history, props.now);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("Walk");
  const [minutes, setMinutes] = useState("30");
  const [vigorous, setVigorous] = useState(false);
  const mins = Number(minutes);
  const valid = Number.isFinite(mins) && mins >= 1 && mins <= 600;
  const share = Math.min(1, w.aerobic / WHO_AEROBIC_MIN);
  return (
    <section className="card stack">
      <div className="card-head">
        <h2 className="h3">This week's activity</h2>
        <span className="meta small">WHO guidelines</span>
      </div>
      <div className="stack" style={{ gap: 6 }}>
        <div className="spread">
          <span>Heart and lungs</span>
          <span className="num"><b>{w.aerobic}</b> of {WHO_AEROBIC_MIN} min</span>
        </div>
        <div className="meter" role="img" aria-label={`${w.aerobic} of ${WHO_AEROBIC_MIN} minutes`}>
          <i style={{ width: `${share * 100}%` }} />
        </div>
        <span className="meta small">
          {w.aerobic >= WHO_AEROBIC_MAX
            ? "Past the top of the range: extra benefits level off from here."
            : w.aerobic >= WHO_AEROBIC_MIN
              ? "Target met. Up to 300 minutes brings extra benefit."
              : "Moderate minutes count once, vigorous ones (breathing hard) double. Any amount beats none."}
        </span>
      </div>
      <div className="spread">
        <span>Strength days</span>
        <span className="row" style={{ gap: 6 }} role="img" aria-label={`${w.strengthDays} of ${WHO_STRENGTH_DAYS} strength days`}>
          {Array.from({ length: Math.max(WHO_STRENGTH_DAYS, w.strengthDays) }, (_, i) => (
            <i key={i} className={`dot${i < w.strengthDays ? " on" : ""}`} />
          ))}
        </span>
      </div>
      {w.extras.length > 0 ? (
        <div className="stack" style={{ gap: 4 }}>
          {w.extras.map((a) => (
            <div key={a.at} className="spread meta small">
              <span>{a.name} · {a.minutes} min{a.vigorous ? " · vigorous" : ""} (counts {extraCredit(a)})</span>
              <button type="button" className="btn ghost small" onClick={() => dispatch({ type: "removeActivity", at: a.at })}>Remove</button>
            </div>
          ))}
        </div>
      ) : null}
      {adding ? (
        <div className="stack">
          <div className="row-wrap" role="group" aria-label="Activity">
            {KINDS.map((k) => (
              <button key={k} type="button" className="chip" aria-pressed={name === k} onClick={() => setName(k)}>{k}</button>
            ))}
          </div>
          <div className="field">
            <label htmlFor="extra-min">Minutes</label>
            <input id="extra-min" className="input num" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          </div>
          <Toggle id="extra-vig" label="Vigorous" hint="Breathing hard, only a few words at a time" checked={vigorous} onChange={setVigorous} />
          <div className="row">
            <button type="button" className="btn" onClick={() => setAdding(false)}>Cancel</button>
            <button
              type="button"
              className="btn primary"
              disabled={!valid}
              onClick={() => {
                dispatch({ type: "addActivity", activity: { at: Date.now(), name, minutes: Math.round(mins), vigorous } });
                setAdding(false);
              }}
            >
              Add
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn" onClick={() => setAdding(true)}>Log other activity</button>
      )}
    </section>
  );
}
