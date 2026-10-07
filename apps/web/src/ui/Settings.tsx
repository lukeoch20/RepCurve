import React, { useRef, useState } from "react";
import { exportBackup, parseBackup } from "../model/backup";
import { clock } from "../model/format";
import { EMPTY_DATA, REST_CHOICES, TRANSITION_CHOICES, type AppData, type Core } from "../model/types";
import { markBackedUp } from "../platform/backupReminder";
import { backupFilename, saveTextFile } from "../platform/download";
import { useStore } from "../store/useAppStore";
import { Seg, Toggle } from "./common";

export function Settings(props: { core: Core; onEditSetup: () => void }): React.ReactElement {
  const { core } = props;
  const store = useStore();
  const { dispatch, data, storage } = store;
  const s = core.settings;
  const [msg, setMsg] = useState<{ tone: "good" | "stop"; text: string } | null>(null);
  const [backupText, setBackupText] = useState<string | null>(null);
  const [importText, setImportText] = useState("");
  const [pendingImport, setPendingImport] = useState<AppData | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const units = core.profile.units;
  const setUnits = (u: typeof units) => {
    if (u === units) return;
    dispatch({ type: "setup", profile: { ...core.profile, units: u }, equipment: core.equipment, now: Date.now() });
  };

  const exportNow = async () => {
    const text = exportBackup(data, Date.now());
    const result = await saveTextFile(backupFilename(), text);
    if (result === "saved") {
      markBackedUp(Date.now());
      setMsg({ tone: "good", text: "Backup saved." });
    } else if (result === "failed") setBackupText(text);
  };

  /** Restore or reset, reporting failures; the store reloads from storage either way. */
  const replaceWith = async (d: AppData, done: string) => {
    try {
      await store.replaceAll(d);
      setMsg({ tone: "good", text: done });
    } catch {
      setMsg({ tone: "stop", text: "That didn't finish saving, so some data may not have changed. What you see now is what's saved; check it and try again." });
    }
  };

  const copyBackup = async () => {
    if (!backupText) return;
    try {
      await navigator.clipboard.writeText(backupText);
      markBackedUp(Date.now());
      setMsg({ tone: "good", text: "Backup copied. Paste it somewhere safe, like a note to yourself." });
    } catch {
      setMsg({ tone: "stop", text: "Couldn't copy. Select the text below and copy it." });
    }
  };

  const readImport = (text: string) => {
    const r = parseBackup(text);
    if (!r.ok) setMsg({ tone: "stop", text: r.error });
    else {
      setPendingImport(r.data);
      setMsg(null);
    }
  };

  const where =
    storage === "claude"
      ? "Saved to your Claude account, private to you, so it follows you to any device where you open this page. Use one device at a time: if another device saves first, this one loads its version."
      : storage === "device"
        ? "Saved on this device only. Export a backup now and then."
        : "Not being saved: storage isn't available here. Export a backup before closing.";

  return (
    <div className="stack-lg">
      <header className="stack">
        <p className="eyebrow">Settings</p>
        <h1 className="title">Make it yours</h1>
      </header>

      {msg ? <div className={`banner ${msg.tone}`} role="status">{msg.text}</div> : null}

      <section className="card stack">
        <h2 className="h3">Rest timer</h2>
        <div className="field">
          <span className="label">Rest after each round</span>
          <div className="weights" role="group" aria-label="Rest after each round">
            {REST_CHOICES.map((sec) => (
              <button key={sec} type="button" className="chip num" aria-pressed={s.restSec === sec} onClick={() => dispatch({ type: "settings", settings: { restSec: sec } })}>
                {sec >= 60 ? clock(sec * 1000) : `${sec}s`}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="label">Switch time between the two exercises of a pair</span>
          <div className="weights" role="group" aria-label="Switch time">
            {TRANSITION_CHOICES.map((sec) => (
              <button key={sec} type="button" className="chip num" aria-pressed={s.transitionSec === sec} onClick={() => dispatch({ type: "settings", settings: { transitionSec: sec } })}>
                {sec}s
              </button>
            ))}
          </div>
        </div>
        <p className="meta small">Sessions are planned around these, so longer rests mean fewer rounds in the same time.</p>
        <div>
          <Toggle id="sound" label="Beep when rest is over" checked={s.sound} onChange={(sound) => dispatch({ type: "settings", settings: { sound } })} />
          <Toggle id="awake" label="Keep the screen on during workouts" hint="Where your phone allows it" checked={s.keepAwake} onChange={(keepAwake) => dispatch({ type: "settings", settings: { keepAwake } })} />
        </div>
      </section>

      <section className="card stack">
        <h2 className="h3">You and your equipment</h2>
        <div className="field">
          <span className="label">Units</span>
          <Seg label="Units" value={units} onChange={setUnits} options={[{ value: "lb", label: "Pounds" }, { value: "kg", label: "Kilograms" }]} />
        </div>
        <button type="button" className="btn" onClick={props.onEditSetup}>
          Edit profile, schedule and equipment
        </button>
        <p className="meta small">Your progress is kept when you change these.</p>
      </section>

      <section className="card stack">
        <h2 className="h3">Your data</h2>
        <p className="meta">{where}</p>
        <div className="row-wrap">
          <button type="button" className="btn" onClick={() => void exportNow()}>Export backup</button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>Import from file</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void f.text().then(readImport);
            e.target.value = "";
          }} />
        </div>
        {backupText ? (
          <div className="stack">
            <p className="meta small">Copy this backup and keep it somewhere safe.</p>
            <button type="button" className="btn primary" onClick={() => void copyBackup()}>Copy backup</button>
            <textarea className="input" readOnly value={backupText} aria-label="Backup" onFocus={(e) => e.currentTarget.select()} />
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="paste">Or paste a backup</label>
          <textarea id="paste" className="input" value={importText} onChange={(e) => setImportText(e.target.value)} placeholder='{"format":"repcurve-backup", …}' />
          <button type="button" className="btn" disabled={!importText.trim()} onClick={() => readImport(importText)}>Check backup</button>
        </div>
        {pendingImport ? (
          <div className="banner adjust">
            <b>Replace everything with this backup?</b>
            It has {pendingImport.history.length} sessions. What's here now will be replaced.
            <div className="row" style={{ marginTop: 10 }}>
              <button type="button" className="btn" onClick={() => setPendingImport(null)}>Cancel</button>
              <button type="button" className="btn danger solid" onClick={() => {
                const d = pendingImport;
                setPendingImport(null);
                setImportText("");
                void replaceWith(d, "Backup restored.");
              }}>Replace</button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="card stack">
        <h2 className="h3">Start over</h2>
        {confirmReset ? (
          <div className="banner stop">
            <b>Delete everything?</b>
            Your profile, progress and every logged session will be gone. Export a backup first if you might want it.
            <div className="row" style={{ marginTop: 10 }}>
              <button type="button" className="btn" onClick={() => setConfirmReset(false)}>Cancel</button>
              <button type="button" className="btn danger solid" onClick={() => void replaceWith(EMPTY_DATA, "Everything was deleted.")}>Delete everything</button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn danger" onClick={() => setConfirmReset(true)}>Reset all data</button>
        )}
      </section>

      <p className="meta small">RepCurve gives general fitness guidance, not medical advice. Stop any exercise that causes sharp or lasting pain.</p>
    </div>
  );
}
