import React, { useState } from "react";
import { DEFAULT_REMINDER_TIME, remindersCalendar, suggestedDays, WEEKDAY_SHORT, type Reminders } from "../model/calendar";
import type { Core } from "../model/types";
import { openCalendarFile } from "../platform/download";
import { storageKey } from "../platform/channel";
import { useStore } from "../store/useAppStore";

/** The app's own address, for the link in each reminder. */
const appUrl = () => `${location.origin}${location.pathname}`;

/**
 * Reminders through the phone's calendar: pick the days and a time, add them once, and the
 * calendar's own alert does the reminding. No account or server needed.
 */
export function ReminderSettings(props: { core: Core }): React.ReactElement {
  const { dispatch } = useStore();
  const saved = props.core.settings.reminders;
  const [days, setDays] = useState<number[]>(saved?.days ?? suggestedDays(props.core.profile.daysPerWeek));
  const [time, setTime] = useState(saved?.time ?? DEFAULT_REMINDER_TIME);
  const [msg, setMsg] = useState<string | null>(null);
  const toggle = (d: number) => setDays((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d].sort()));
  // Monday first, Sunday last.
  const order = [1, 2, 3, 4, 5, 6, 0];

  const add = async () => {
    const r: Reminders = { days, time };
    const ics = remindersCalendar(r, props.core.profile.minutesPerSession, appUrl(), new Date());
    const result = await openCalendarFile("repcurve-reminders.ics", ics);
    if (result === "failed") {
      setMsg("Couldn't open your calendar from here. Try again from Safari, or add a repeating event yourself.");
      return;
    }
    dispatch({ type: "settings", settings: { reminders: r } });
    setMsg(
      result === "opened"
        ? "Tap Add All to put them in your calendar. Your calendar's alert reminds you at that time."
        : "Open the downloaded file to add them to your calendar.",
    );
  };

  return (
    <section className="card stack">
      <h2 className="h3">Reminders</h2>
      <p className="meta small">
        Your phone's calendar reminds you on your training days. Changed your mind? Delete the old RepCurve event in your calendar, then add the new days here.
      </p>
      <div className="row-wrap" role="group" aria-label="Training days">
        {order.map((d) => (
          <button key={d} type="button" className="chip" aria-pressed={days.includes(d)} onClick={() => toggle(d)}>
            {WEEKDAY_SHORT[d]}
          </button>
        ))}
      </div>
      <div className="field">
        <label htmlFor="remind-time">Reminder time</label>
        <input id="remind-time" className="input" type="time" value={time} onChange={(e) => e.target.value && setTime(e.target.value)} />
      </div>
      <button type="button" className="btn primary" disabled={days.length === 0} onClick={() => void add()}>
        {saved ? "Add to my calendar again" : "Add to my calendar"}
      </button>
      {saved ? (
        <span className="meta small">
          Added for {saved.days.map((d) => WEEKDAY_SHORT[d]).join(", ")} at {saved.time}.
        </span>
      ) : null}
      {msg ? <span className="meta small" role="status">{msg}</span> : null}
    </section>
  );
}

const DISMISSED = storageKey("remindersPromptDismissed");

function dismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED) === "1";
  } catch {
    return false;
  }
}

/**
 * After the first workout, offer reminders in one tap on the suggested days, until they're set up
 * or turned down.
 */
export function ReminderPrompt(props: { core: Core }): React.ReactElement | null {
  const { dispatch } = useStore();
  const [hidden, setHidden] = useState(dismissed);
  const [msg, setMsg] = useState<string | null>(null);
  if (props.core.settings.reminders || (hidden && !msg)) return msg ? <div className="banner good" role="status">{msg}</div> : null;
  const r: Reminders = { days: suggestedDays(props.core.profile.daysPerWeek), time: DEFAULT_REMINDER_TIME };
  const hide = () => {
    try {
      localStorage.setItem(DISMISSED, "1");
    } catch {
      // per-device convenience only
    }
    setHidden(true);
  };
  const add = async () => {
    const result = await openCalendarFile("repcurve-reminders.ics", remindersCalendar(r, props.core.profile.minutesPerSession, appUrl(), new Date()));
    if (result === "failed") return setMsg("Couldn't open your calendar from here. Settings → Reminders has other days and times.");
    dispatch({ type: "settings", settings: { reminders: r } });
    setMsg(result === "opened" ? "Tap Add All to put them in your calendar." : "Open the downloaded file to add them to your calendar.");
  };
  return (
    <div className="banner info">
      <b>Want a reminder on training days?</b>
      Your phone's calendar can nudge you on {r.days.map((d) => WEEKDAY_SHORT[d]).join(", ")} at {r.time}. Other days and times are in Settings.
      <div className="row-wrap" style={{ marginTop: 10 }}>
        <button type="button" className="btn small" onClick={() => void add()}>Add to my calendar</button>
        <button type="button" className="btn small ghost" onClick={hide}>Not now</button>
      </div>
    </div>
  );
}
