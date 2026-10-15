import React, { useEffect, useMemo, useState } from "react";
import { badges } from "../model/gamify";
import { closest, lookStatuses, lookUnlocks, nextLook, routesText, type LookStatus } from "../model/looks";
import type { Core, SessionRecord } from "../model/types";
import { IS_TEST } from "../platform/channel";
import { applyStyle, FAMILIES, keepLooks, keptLooks, loadStyle, previewVars, saveStyle, versionLike, type LookId, type StyleFamily, type StyleId } from "../platform/style";

/** Where each look stands for this history; looks earned here are kept on the device for good. */
export function useLooks(history: SessionRecord[], core: Pick<Core, "profile" | "startedAt">): Map<LookId, LookStatus> {
  const all = useMemo(() => badges(history, core), [history, core]);
  const statuses = useMemo(() => lookStatuses(all, keptLooks(), IS_TEST), [all]);
  useEffect(() => {
    keepLooks([...statuses.values()].filter((s) => s.openedBy).map((s) => s.id));
  }, [statuses]);
  return statuses;
}

/** A small padlock in the current look's colours. */
export function Lock(): React.ReactElement {
  return (
    <svg className="look-lock" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

/**
 * A look drawn in its own colours and fonts, whatever look is on: a header band with its name,
 * and a card with a line of text, its curve colour and its main button. Classic follows the
 * phone, so it shows light and dark side by side.
 */
export function LookPreview(props: { family: StyleFamily }): React.ReactElement {
  const f = props.family;
  const panes = (f.auto ? [f.light, f.dark] : [f.light]) as Exclude<StyleId, "classic">[];
  return (
    <span className={`look-preview${panes.length > 1 ? " two" : ""}`}>
      {panes.map((id, i) => (
        <span key={id} className="lp-pane" style={previewVars(id) as React.CSSProperties}>
          <span className="lp-head" aria-hidden={i > 0 || undefined}>{f.name}</span>
          <span className="lp-page" aria-hidden="true">
            <span className="lp-card">
              <span className="lp-text">
                <span className="lp-title">Today</span>
                <span className="lp-sub">20 min</span>
              </span>
              <svg className="lp-curve" width="28" height="16" viewBox="0 0 28 16">
                <path d="M2 14 C 9 13, 12 9, 15 7 S 22 2, 26 2" fill="none" stroke="var(--pv-chart)" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
              <span className="lp-button">Start</span>
            </span>
          </span>
        </span>
      ))}
    </span>
  );
}

/** Puts a look on in the version (light or dark) that matches the one in use now. */
export function tryLook(id: LookId): StyleId {
  const f = FAMILIES.find((x) => x.id === id)!;
  const phoneDark = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const v = versionLike(f, loadStyle(), phoneDark);
  saveStyle(v);
  applyStyle(v);
  return v;
}

/** Progress: the next look to earn and how close it is. */
export function NextLook(props: { history: SessionRecord[]; core: Core }): React.ReactElement | null {
  const statuses = useLooks(props.history, props.core);
  const next = nextLook(statuses);
  if (!next) return null;
  const near = closest(next);
  return (
    <section className="card stack next-look" style={{ gap: 8 }} aria-label="Next look">
      <div className="spread">
        <span className="h3">Next look: {next.name}</span>
        <Lock />
      </div>
      {near && near.badge.progress ? (
        <div className="challenge-bar" role="progressbar" aria-valuemin={0} aria-valuemax={near.badge.progress.need} aria-valuenow={near.badge.progress.have} aria-label={`${near.route.label}: ${near.badge.progress.have} of ${near.badge.progress.need}`}>
          <i style={{ width: `${near.share * 100}%` }} />
        </div>
      ) : null}
      <span className="meta small">Unlocks with: {routesText(next)}.{IS_TEST ? " Every look is open in the test app." : ""}</span>
    </section>
  );
}

/** Finish screen: a look this session opened, with a way to put it on. */
export function LookUnlocked(props: { record: SessionRecord; history: SessionRecord[]; core: Core }): React.ReactElement | null {
  const r = props.record;
  // What was kept before this session, so a look kept here already isn't announced as new.
  const [kept] = useState(keptLooks);
  const looks = useMemo(() => {
    const all = props.history.some((x) => x.id === r.id) ? props.history : [...props.history, r];
    return lookUnlocks(r.id, badges(all, props.core), kept);
  }, [r, props.history, props.core, kept]);
  const [on, setOn] = useState<LookId | null>(null);
  // A look announced here is kept straight away, so a restore or undo later can't lock it again.
  useEffect(() => {
    if (looks.length > 0) keepLooks(looks.map((l) => l.id));
  }, [looks]);
  if (looks.length === 0) return null;
  return (
    <section className="card stack look-unlocked" style={{ gap: 10 }} aria-label="New look">
      {looks.map((l) => (
        <div key={l.id} className="stack" style={{ gap: 10 }}>
          <h2 className="h3">New look unlocked: {l.name}</h2>
          <LookPreview family={FAMILIES.find((f) => f.id === l.id)!} />
          {on === l.id ? (
            <p className="meta small" role="status">{l.name} is on. Change it any time in Settings.</p>
          ) : (
            <button
              type="button"
              className="btn"
              style={{ alignSelf: "flex-start" }}
              onClick={() => {
                tryLook(l.id);
                setOn(l.id);
              }}
            >
              Try it
            </button>
          )}
        </div>
      ))}
    </section>
  );
}
