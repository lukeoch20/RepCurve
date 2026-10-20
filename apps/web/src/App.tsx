import React, { useEffect, useMemo, useState } from "react";
import { loadUnitsFor } from "@repcurve/shared";
import { CardioRunner } from "./ui/CardioRunner";
import { Finished } from "./ui/Finished";
import { Knows, KnowsOpener } from "./ui/Knows";
import { Onboarding } from "./ui/Onboarding";
import { Plan } from "./ui/Plan";
import { Progress } from "./ui/Progress";
import { SessionRunner } from "./ui/SessionRunner";
import { Settings } from "./ui/Settings";
import { Setups, SetupsOpener, type SetupsRoute } from "./ui/Setups";
import { Today } from "./ui/Today";
import { TipsProvider } from "./ui/tips";
import { CurveMark, Icon } from "./ui/common";
import { ErrorBoundary } from "./ui/ErrorBoundary";
import { EMPTY_DATA } from "./model/types";
import { findSetup, scheduleEquipment } from "./model/setups";
import { sessionCore } from "./model/session";
import { applyUpdate, onUpdateReady, updateOffered, updateReady } from "./platform/update";
import { dropSafetyCopy } from "./platform/safetyCopy";
import { IS_TEST, storageKey } from "./platform/channel";
import { StoreContext, useAppStore } from "./store/useAppStore";
import { STORAGE_FULL } from "./store/persistence";
import { BackupButton } from "./ui/Backup";

type Tab = "today" | "plan" | "progress" | "settings";
const TABS: { id: Tab; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "plan", label: "Plan" },
  { id: "progress", label: "Progress" },
  { id: "settings", label: "Settings" },
];

function rememberedTab(): Tab {
  try {
    const t = localStorage.getItem(storageKey("tab")) as Tab | null;
    return t && TABS.some((x) => x.id === t) ? t : "today";
  } catch {
    return "today";
  }
}

export function App(): React.ReactElement {
  const store = useAppStore();
  const [tab, setTab] = useState<Tab>(rememberedTab);
  const [editingSetup, setEditingSetup] = useState(false);
  // "What RepCurve knows", opened from Settings or Progress, over the tab it came from.
  const [knows, setKnows] = useState(false);
  // Training setups, opened from Today's setup picker or from Settings, over the tab it came from.
  const [setupsAt, setSetupsAt] = useState<SetupsRoute | null>(null);
  // Today's setup picker, opened again on the way back from the setups screen, with a note if any.
  const [pickerAgain, setPickerAgain] = useState<{ note: string | null } | null>(null);
  const [update, setUpdate] = useState(updateReady);
  useEffect(() => onUpdateReady(() => setUpdate(true)), []);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey("tab"), tab);
    } catch {
      // per-device convenience only
    }
  }, [tab]);

  const { core, active, history } = store.data;
  // A workout in progress shows the equipment it started with, however setups change meanwhile.
  const runCore = useMemo(() => (core && active ? sessionCore(core, active) : core), [core, active?.setup]);

  let body: React.ReactElement;
  if (!store.ready) {
    body = (
      <main className="app stack" style={{ paddingTop: 48, alignItems: "center" }}>
        <CurveMark size={48} />
        <p className="meta">Loading your training…</p>
      </main>
    );
  } else if (!core || editingSetup) {
    body = (
      <Onboarding
        {...(core ? { initial: { profile: core.profile, equipment: scheduleEquipment(core.setups), logged: core.state.strengthSessionsLogged }, onCancel: () => setEditingSetup(false) } : {})}
        onDone={(profile, setups) => {
          store.dispatch({ type: "setup", profile, ...(setups ? { setups } : {}), now: Date.now() });
          setEditingSetup(false);
          setTab("today");
        }}
      />
    );
  } else if (store.finished) {
    // Weights in the units of the setup the session was done with.
    const done = store.finished.setup ? findSetup(core.setups, store.finished.setup.id)?.equipment : undefined;
    body = <Finished record={store.finished} core={core} history={history} units={loadUnitsFor(core.profile, done ?? core.equipment)} />;
  } else if (active) {
    body = active.plan.kind === "cardio" ? <CardioRunner core={runCore!} active={active} /> : <SessionRunner core={runCore!} active={active} />;
  } else {
    body = (
      <>
        <main className="app">
          {knows ? (
            <Knows core={core} history={history} onClose={() => { setKnows(false); window.scrollTo(0, 0); }} />
          ) : setupsAt ? (
            <Setups
              core={core}
              start={setupsAt.add ? "add" : "list"}
              onClose={(note) => {
                if (setupsAt.from === "today") setPickerAgain({ note: note ?? null });
                setSetupsAt(null);
                window.scrollTo(0, 0);
              }}
            />
          ) : (
            <KnowsOpener value={() => { setKnows(true); window.scrollTo(0, 0); }}>
              <SetupsOpener value={(route) => { setSetupsAt(route); window.scrollTo(0, 0); }}>
                {tab === "today" ? <Today core={core} history={history} picker={pickerAgain} onPickerShown={() => setPickerAgain(null)} /> : null}
                {tab === "plan" ? <Plan core={core} history={history} /> : null}
                {tab === "progress" ? <Progress core={core} history={history} /> : null}
                {tab === "settings" ? <Settings core={core} onEditSetup={() => setEditingSetup(true)} /> : null}
              </SetupsOpener>
            </KnowsOpener>
          )}
        </main>
        <div className="tabbar">
          <nav aria-label="Sections">
            {TABS.map((t) => (
              <button key={t.id} type="button" aria-current={tab === t.id ? "page" : undefined} onClick={() => { setTab(t.id); setKnows(false); setSetupsAt(null); setPickerAgain(null); window.scrollTo(0, 0); }}>
                <Icon name={t.id} size={22} strokeWidth={tab === t.id ? 2 : 1.7} />
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </>
    );
  }

  return (
    <StoreContext.Provider value={store}>
      {IS_TEST ? (
        <div className="test-strip" role="note">
          <CurveMark size={16} />
          RepCurve Test · separate data
        </div>
      ) : null}
      {store.saveError ? (
        <div className="toast banner stop" role="alert">
          {store.saveError}
          {store.saveError === STORAGE_FULL ? <BackupButton label="Save a backup" /> : null}
          <button type="button" className="btn ghost" onClick={store.clearSaveError}>Dismiss</button>
        </div>
      ) : store.actionError ? (
        <div className="toast banner stop" role="alert">
          {store.actionError}
          <button type="button" className="btn ghost" onClick={store.clearActionError}>Dismiss</button>
        </div>
      ) : store.notice ? (
        <div className="toast banner info" role="status">
          {store.notice}
          <button type="button" className="btn ghost" onClick={store.clearNotice}>OK</button>
        </div>
      ) : null}
      {store.storageWarning ? (
        <div className="banner stop storage-warning" role="alert">{store.storageWarning}</div>
      ) : null}
      {update && updateOffered(active !== null) ? (
        <div className="banner info storage-warning" role="status">
          <b>A new version of RepCurve is ready</b>
          <button type="button" className="btn" onClick={() => applyUpdate(store.data.active !== null)}>Update now</button>
        </div>
      ) : null}
      <TipsProvider>
        <ErrorBoundary
          data={store.data}
          onReset={async () => {
            // As in Settings: the copy kept to undo a restore goes too, so the data can't come back.
            // The error log stays, in case the person still wants to report the crash.
            await dropSafetyCopy();
            await store.replaceAll(EMPTY_DATA);
          }}
        >
          {body}
        </ErrorBoundary>
      </TipsProvider>
    </StoreContext.Provider>
  );
}
