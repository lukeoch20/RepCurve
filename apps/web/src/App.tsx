import React, { useEffect, useState } from "react";
import { CardioRunner } from "./ui/CardioRunner";
import { Finished } from "./ui/Finished";
import { Onboarding } from "./ui/Onboarding";
import { Plan } from "./ui/Plan";
import { Progress } from "./ui/Progress";
import { SessionRunner } from "./ui/SessionRunner";
import { Settings } from "./ui/Settings";
import { Today } from "./ui/Today";
import { CurveMark } from "./ui/common";
import { ErrorBoundary } from "./ui/ErrorBoundary";
import { EMPTY_DATA } from "./model/types";
import { applyUpdate, onUpdateReady, updateReady } from "./platform/update";
import { StoreContext, useAppStore } from "./store/useAppStore";

type Tab = "today" | "plan" | "progress" | "settings";
const TABS: { id: Tab; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "plan", label: "Plan" },
  { id: "progress", label: "Progress" },
  { id: "settings", label: "Settings" },
];

function rememberedTab(): Tab {
  try {
    const t = localStorage.getItem("repcurve.tab") as Tab | null;
    return t && TABS.some((x) => x.id === t) ? t : "today";
  } catch {
    return "today";
  }
}

export function App(): React.ReactElement {
  const store = useAppStore();
  const [tab, setTab] = useState<Tab>(rememberedTab);
  const [editingSetup, setEditingSetup] = useState(false);
  const [update, setUpdate] = useState(updateReady);
  useEffect(() => onUpdateReady(() => setUpdate(true)), []);

  useEffect(() => {
    try {
      localStorage.setItem("repcurve.tab", tab);
    } catch {
      // per-device convenience only
    }
  }, [tab]);

  const { core, active, history } = store.data;

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
        {...(core ? { initial: { profile: core.profile, equipment: core.equipment }, onCancel: () => setEditingSetup(false) } : {})}
        onDone={(profile, equipment) => {
          store.dispatch({ type: "setup", profile, equipment, now: Date.now() });
          setEditingSetup(false);
          setTab("today");
        }}
      />
    );
  } else if (store.finished) {
    body = <Finished record={store.finished} units={core.profile.units} />;
  } else if (active) {
    body = active.plan.kind === "cardio" ? <CardioRunner core={core} active={active} /> : <SessionRunner core={core} active={active} />;
  } else {
    body = (
      <>
        <main className="app">
          {tab === "today" ? <Today core={core} history={history} /> : null}
          {tab === "plan" ? <Plan core={core} /> : null}
          {tab === "progress" ? <Progress core={core} history={history} /> : null}
          {tab === "settings" ? <Settings core={core} onEditSetup={() => setEditingSetup(true)} /> : null}
        </main>
        <div className="tabbar">
          <nav aria-label="Sections">
            {TABS.map((t) => (
              <button key={t.id} type="button" aria-current={tab === t.id ? "page" : undefined} onClick={() => { setTab(t.id); window.scrollTo(0, 0); }}>
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
      {store.saveError ? (
        <div className="toast banner stop" role="alert">
          {store.saveError}
          <button type="button" className="btn ghost" onClick={store.clearSaveError}>Dismiss</button>
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
      {update && !active ? (
        <div className="banner info storage-warning" role="status">
          <b>A new version of RepCurve is ready</b>
          <button type="button" className="btn" onClick={applyUpdate}>Update now</button>
        </div>
      ) : null}
      <ErrorBoundary data={store.data} onReset={() => store.replaceAll(EMPTY_DATA)}>
        {body}
      </ErrorBoundary>
    </StoreContext.Provider>
  );
}
