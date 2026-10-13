import React, { useEffect, useRef, useState } from "react";
import { parseBackup } from "../model/backup";
import { clock } from "../model/format";
import { EMPTY_DATA, REST_CHOICES, TRANSITION_CHOICES, type AppData, type Core } from "../model/types";
import { markBackedUp } from "../platform/backupReminder";
import { dropSafetyCopy, keepSafetyCopy, safetyCopy } from "../platform/safetyCopy";
import { applyStyle, loadStyle, saveStyle, STYLES, type StyleId } from "../platform/style";
import { useStore } from "../store/useAppStore";
import { Seg, Toggle } from "./common";
import { useTips } from "./tips";
import { InstallCard } from "./Install";
import { backUp } from "./Backup";
import { ReminderSettings } from "./Reminders";

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
    const result = await backUp(data);
    if (!result) return;
    if (result.fallback) setBackupText(result.fallback);
    else setMsg({ tone: result.tone, text: result.text });
  };

  // The data as it was before the last restore, so the restore can be undone.
  const [undo, setUndo] = useState<{ savedAt: number; data: AppData } | null>(null);
  useEffect(() => {
    void safetyCopy().then(setUndo);
  }, []);
  const restore = async (d: AppData) => {
    // Keep what's here first: a restore replaces everything.
    const kept = await keepSafetyCopy(data, Date.now());
    await replaceWith(d, kept ? "Backup restored. What was here before is kept on this device: Undo restore brings it back." : "Backup restored.");
    setUndo(kept ? await safetyCopy() : null);
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
          <Toggle id="haptics" label="Vibrate when you finish a set" hint="On iPhone, a light tap (iOS 18 or newer)" checked={s.haptics} onChange={(haptics) => dispatch({ type: "settings", settings: { haptics } })} />
        </div>
      </section>

      <StyleSettings />

      <TipsSettings />

      <section className="card stack">
        <h2 className="h3">You and your equipment</h2>
        <div className="field">
          <span className="label">Body units</span>
          <Seg label="Units" value={units} onChange={setUnits} options={[{ value: "lb", label: "Pounds" }, { value: "kg", label: "Kilograms" }]} />
          {core.equipment.dumbbells.kind !== "none" ? (
            <span className="meta small">Weights always show in {core.equipment.dumbbells.unit}, as marked on your dumbbells. Change that under equipment.</span>
          ) : null}
        </div>
        <button type="button" className="btn" onClick={props.onEditSetup}>
          Edit profile, schedule and equipment
        </button>
        <p className="meta small">Your progress is kept when you change these.</p>
      </section>

      <InstallCard />

      <ReminderSettings core={core} />

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
        {undo ? (
          <div className="banner info">
            <b>Undo the last restore</b>
            Your data from before the restore on {new Date(undo.savedAt).toLocaleDateString()} is kept on this device ({undo.data.history.length} sessions).
            <div className="row-wrap" style={{ marginTop: 10 }}>
              <button
                type="button"
                className="btn small"
                onClick={() => {
                  const before = undo.data;
                  void replaceWith(before, "Restore undone: your data is back as it was.").then(async () => {
                    await dropSafetyCopy();
                    setUndo(null);
                  });
                }}
              >
                Undo restore
              </button>
              <button type="button" className="btn small ghost" onClick={() => void dropSafetyCopy().then(() => setUndo(null))}>
                Forget it
              </button>
            </div>
          </div>
        ) : null}
        {pendingImport ? (
          <div className="banner adjust">
            <b>Replace everything with this backup?</b>
            It has {pendingImport.history.length} sessions. What's here now will be replaced, and kept on this device so you can undo it.
            <div className="row" style={{ marginTop: 10 }}>
              <button type="button" className="btn" onClick={() => setPendingImport(null)}>Cancel</button>
              <button type="button" className="btn danger solid" onClick={() => {
                const d = pendingImport;
                setPendingImport(null);
                setImportText("");
                void restore(d);
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

/** The app's look, per device: Bluebird light (the default), Bluebird dark or Classic. */
function StyleSettings(): React.ReactElement {
  const [style, setStyle] = useState<StyleId>(loadStyle);
  const choose = (id: StyleId) => {
    setStyle(id);
    saveStyle(id);
    applyStyle(id);
  };
  return (
    <section className="card stack">
      <h2 className="h3">Style</h2>
      <div className="choice" role="group" aria-label="Style">
        {STYLES.map((o) => (
          <button key={o.id} type="button" aria-pressed={style === o.id} onClick={() => choose(o.id)}>
            <b>{o.name}</b>
            <span>{o.hint}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

/** Tutorial tips: on or off, and a way to see them all again. */
function TipsSettings(): React.ReactElement | null {
  const tips = useTips();
  const [replayed, setReplayed] = React.useState(false);
  if (!tips) return null;
  return (
    <section className="card stack">
      <h2 className="h3">Tips</h2>
      <Toggle
        id="tips"
        label="Show tips"
        hint="Short notes on lifting basics and the app, the first time you meet each thing"
        checked={!tips.state.off}
        onChange={(on) => {
          tips.setOff(!on);
          setReplayed(false);
        }}
      />
      <button
        type="button"
        className="btn"
        style={{ alignSelf: "flex-start" }}
        onClick={() => {
          tips.replay();
          setReplayed(true);
        }}
      >
        Show all tips again
      </button>
      {replayed ? <p className="meta small" role="status">Tips start again from the beginning, on each screen as you visit it.</p> : null}
    </section>
  );
}
