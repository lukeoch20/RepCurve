import React, { useState } from "react";
import { clearCrashLog, copyCrashLog, crashLog, crashLogText } from "../platform/crashLog";

/** Settings: the errors kept on this device, to copy and send to whoever helps with RepCurve. */
export function ErrorLogSettings(): React.ReactElement {
  const [count, setCount] = useState(() => crashLog().length);
  const [msg, setMsg] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);

  const copy = async () => {
    if (await copyCrashLog()) setMsg("Error log copied. Paste it into a message to whoever helps you with RepCurve.");
    else setText(crashLogText());
  };

  return (
    <section className="card stack">
      <h2 className="h3">Error log</h2>
      <p className="meta small">
        {count === 0 ? "No errors recorded on this device." : `${count} recent error${count === 1 ? "" : "s"} recorded on this device. Nothing is sent anywhere.`}
      </p>
      <div className="row-wrap">
        <button type="button" className="btn small" onClick={() => void copy()}>Copy error log</button>
        {count > 0 ? (
          <button type="button" className="btn small ghost" onClick={() => { clearCrashLog(); setCount(0); setText(null); setMsg("Error log cleared."); }}>
            Clear
          </button>
        ) : null}
      </div>
      {msg ? <p className="meta small" role="status">{msg}</p> : null}
      {text !== null ? (
        <div className="field">
          <label htmlFor="error-log">Couldn't copy, so here's the log to copy by hand</label>
          <textarea id="error-log" className="input" readOnly value={text} onFocus={(e) => e.currentTarget.select()} />
        </div>
      ) : null}
    </section>
  );
}
