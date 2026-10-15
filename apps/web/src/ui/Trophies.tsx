import React, { useMemo, useState } from "react";
import { displayLoad, type Units } from "@repcurve/shared";
import { badges, equivalent, lifetimeMovedKg, liftLevel, monthCalendar, type Badge, type Challenge } from "../model/gamify";
import type { LiftSeries } from "../model/progress";
import type { Core, SessionRecord } from "../model/types";
import { Icon, Sheet } from "./common";

const TIER_LABEL = { bronze: "Bronze", silver: "Silver", gold: "Gold", platinum: "Platinum" } as const;

/** Pixel Press medal sprite on a 12 × 12 grid of 4-unit pixels: ribbon tabs, a stepped edge and the disc. */
const sprite = (rows: string[], on: string) =>
  rows
    .map((row, y) => [...row.matchAll(new RegExp(`${on}+`, "g"))].map((m) => `M${m.index! * 4} ${y * 4}h${m[0].length * 4}v4h-${m[0].length * 4}z`).join(""))
    .join("");
const MEDAL_SPRITE = [
  "...rr..rr...",
  "...rr..rr...",
  "...eeeeee...",
  "..effffffe..",
  ".effffffffe.",
  ".effffffffe.",
  ".effffffffe.",
  ".effffffffe.",
  ".effffffffe.",
  "..effffffe..",
  "...eeeeee...",
  "............",
];
const PX_RIBBON = sprite(MEDAL_SPRITE, "r");
const PX_EDGE = sprite(MEDAL_SPRITE, "e");
const PX_FILL = sprite(MEDAL_SPRITE, "f");

/** A medal: tier colour and a short mark when earned, an outline while locked. */
export function Medal(props: { badge: Pick<Badge, "mark" | "tier" | "earned">; size?: number }): React.ReactElement {
  const s = props.size ?? 48;
  const on = !!props.badge.earned;
  return (
    <svg width={s} height={s} viewBox="0 0 48 48" aria-hidden="true" className={`medal ${on ? props.badge.tier : "locked"}`}>
      <path className="ribbon" d="M15 2h7l4 14h-7zM33 2h-7l-4 14h7z" />
      <circle className="disc" cx="24" cy="29" r="16" />
      <circle className="rim" cx="24" cy="29" r="12.5" fill="none" />
      <text className="mark" x="24" y="33.5" textAnchor="middle" fontSize={props.badge.mark.length > 2 ? 9 : 12} fontWeight="700">
        {props.badge.mark}
      </text>
      {/* Cut Like a Diamond: the mark on a plate in the tier's metal, over a cut diamond (drawn by the
          style) when earned, or over this outline while locked. */}
      <g className="dm">
        <path className="dm-outline" d="M13 9h22l10 12-21 24L3 21z M3 21h42 M13 9l5 12 6 24 6-24 5-12 M18 21l6-12 6 12" />
        <rect className="dm-plate" x={props.badge.mark.length > 2 ? 10 : 13} y="24" width={props.badge.mark.length > 2 ? 28 : 22} height="13" rx="3" />
        <text className="dm-mark" x="24" y="34" textAnchor="middle" fontSize={props.badge.mark.length > 2 ? 9 : 11} fontWeight="700">
          {props.badge.mark}
        </text>
      </g>
      {/* The Pixel Press sprite: shown instead of the round medal in that style. */}
      <g className="px" shapeRendering="crispEdges">
        <path className="px-ribbon" d={PX_RIBBON} />
        <path className="px-edge" d={PX_EDGE} />
        <path className="px-fill" d={PX_FILL} />
        <text className="px-mark" x="24" y="31" textAnchor="middle" fontSize={props.badge.mark.length > 2 ? 9 : 11}>
          {props.badge.mark}
        </text>
      </g>
    </svg>
  );
}

const shortDate = (t: number) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

/** Every badge: earned ones first (newest first), then the ones closest to being earned. */
export function TrophyShelf(props: { core: Core; history: SessionRecord[] }): React.ReactElement {
  const all = useMemo(() => badges(props.history, props.core), [props.history, props.core]);
  const [open, setOpen] = useState<Badge | null>(null);
  const [showAll, setShowAll] = useState(false);
  const earned = all.filter((b) => b.earned).sort((a, b) => b.earned!.at - a.earned!.at);
  const locked = all.filter((b) => !b.earned).sort((a, b) => b.progress!.have / b.progress!.need - a.progress!.have / a.progress!.need);
  const shown = showAll ? [...earned, ...locked] : [...earned, ...locked].slice(0, 9);
  return (
    <section className="card stack" style={{ gap: 12 }}>
      <div className="card-head">
        <h2 className="h3">Trophies</h2>
        <span className="meta small num">{earned.length} of {all.length} earned</span>
      </div>
      <div className="trophies">
        {shown.map((b) => (
          <button key={b.id} type="button" className={`trophy${b.earned ? "" : " locked"}`} onClick={() => setOpen(b)} aria-label={`${b.name}: ${b.earned ? `earned ${shortDate(b.earned.at)}` : `locked, ${b.progress!.have} of ${b.progress!.need}`}`}>
            <Medal badge={b} />
            <span className="trophy-name">{b.name}</span>
            {b.earned ? null : <span className="trophy-bar" aria-hidden="true"><i style={{ width: `${(b.progress!.have / b.progress!.need) * 100}%` }} /></span>}
          </button>
        ))}
      </div>
      {all.length > 9 ? (
        <button type="button" className="btn ghost" style={{ alignSelf: "flex-start" }} onClick={() => setShowAll(!showAll)} aria-expanded={showAll}>
          {showAll ? "Show fewer" : `Show all ${all.length}`}
        </button>
      ) : null}
      {open ? (
        <Sheet title={open.name} onClose={() => setOpen(null)}>
          <div style={{ display: "flex", justifyContent: "center" }}><Medal badge={open} size={96} /></div>
          <p className="prose" style={{ textAlign: "center" }}>{open.how}.</p>
          <p className="meta" style={{ textAlign: "center" }}>
            {open.earned ? `${TIER_LABEL[open.tier]} · earned ${shortDate(open.earned.at)}` : `${TIER_LABEL[open.tier]} · ${open.progress!.have.toLocaleString()} of ${open.progress!.need.toLocaleString()} so far`}
          </p>
        </Sheet>
      ) : null}
    </section>
  );
}

/** This month's goal as a bar. Compact for Today. */
export function ChallengeCard(props: { challenge: Challenge; compact?: boolean }): React.ReactElement {
  const c = props.challenge;
  const pct = Math.min(1, c.done / c.target);
  const left = c.target - c.done;
  const line = c.complete
    ? `Done! ${c.done} workouts this month.`
    : `${left} to go · ${c.daysLeft} ${c.daysLeft === 1 ? "day" : "days"} left`;
  return (
    <section className={props.compact ? "challenge compact" : "card stack challenge"} style={props.compact ? undefined : { gap: 10 }} aria-label={`${c.month} challenge`}>
      <div className="spread">
        <span className={props.compact ? "eyebrow" : "h3"}>{c.month} challenge</span>
        <span className="num" style={{ fontWeight: 600 }}>{c.done}/{c.target}</span>
      </div>
      <div className="challenge-bar" role="progressbar" aria-valuemin={0} aria-valuemax={c.target} aria-valuenow={Math.min(c.done, c.target)} aria-label={`${c.done} of ${c.target} workouts`}>
        <i style={{ width: `${pct * 100}%` }} />
      </div>
      <span className="meta small">{line}</span>
    </section>
  );
}

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/** A month of workouts: filled days for lifting, ringed days for cardio. */
export function CalendarCard(props: { history: SessionRecord[]; now: number }): React.ReactElement {
  const today = new Date(props.now);
  const [ym, setYm] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const firstDone = props.history.filter((r) => !r.skipped).reduce((t, r) => Math.min(t, r.finishedAt), props.now);
  const earliest = new Date(firstDone);
  const atStart = ym.y < earliest.getFullYear() || (ym.y === earliest.getFullYear() && ym.m <= earliest.getMonth());
  const atEnd = ym.y > today.getFullYear() || (ym.y === today.getFullYear() && ym.m >= today.getMonth());
  const weeks = monthCalendar(props.history, ym.y, ym.m, props.now);
  const count = weeks.flat().filter((d) => d && (d.strength || d.cardio)).length;
  const label = new Date(ym.y, ym.m, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const step = (dir: number) => setYm(({ y, m }) => ({ y: m + dir < 0 ? y - 1 : m + dir > 11 ? y + 1 : y, m: (m + dir + 12) % 12 }));
  return (
    <section className="card stack" style={{ gap: 10 }}>
      <div className="card-head">
        <h2 className="h3">Calendar</h2>
        <div className="row" style={{ gap: 4, alignItems: "center" }}>
          <button type="button" className="btn small ghost" aria-label="Previous month" disabled={atStart} onClick={() => step(-1)}><Icon name="chevronLeft" size={16} /></button>
          <span className="meta small" style={{ minWidth: "7.5rem", textAlign: "center" }}>{label}</span>
          <button type="button" className="btn small ghost" aria-label="Next month" disabled={atEnd} onClick={() => step(1)}><Icon name="chevronRight" size={16} /></button>
        </div>
      </div>
      <div className="calendar" role="img" aria-label={`${label}: ${count} days with a workout`}>
        {WEEKDAYS.map((d, i) => <span key={i} className="cal-head" aria-hidden="true">{d}</span>)}
        {weeks.flat().map((d, i) =>
          d ? (
            <span key={i} className={`cal-day${d.strength ? " lift" : d.cardio ? " cardio" : ""}${d.today ? " today" : ""}`}>
              {d.day}
            </span>
          ) : (
            <span key={i} aria-hidden="true" />
          ),
        )}
      </div>
      <p className="meta small"><span className="cal-key lift" /> lifting <span className="cal-key cardio" /> cardio · {count} workout {count === 1 ? "day" : "days"} in {label.split(" ")[0]}</p>
    </section>
  );
}

/** Every lift's best, with its level. */
export function RecordsWall(props: { lifts: LiftSeries[]; units: Units }): React.ReactElement {
  const [showAll, setShowAll] = useState(false);
  const rows = props.lifts.map((l) => {
    const best = Math.max(...l.points.map((p) => p.y));
    const value = l.metric === "e1rm" ? displayLoad(Math.round(best * 10) / 10, props.units) : best;
    return { l, value, level: liftLevel(l), unit: l.metric === "e1rm" ? `${props.units} est. max` : "reps" };
  });
  const shown = showAll ? rows : rows.slice(0, 5);
  return (
    <section className="card stack" style={{ gap: 4 }}>
      <div className="card-head">
        <h2 className="h3">Personal records</h2>
        <span className="meta small">best so far · level</span>
      </div>
      {shown.map(({ l, value, level, unit }) => (
        <div key={l.id} className="lift">
          <div>
            <div className="name">{l.name}</div>
            <div className="now num">{Math.round(value * 10) / 10} {unit}</div>
          </div>
          <span className="level-chip num" aria-label={`Level ${level}`}>Lv {level}</span>
        </div>
      ))}
      {rows.length > 5 ? (
        <button type="button" className="btn ghost" style={{ alignSelf: "flex-start" }} onClick={() => setShowAll(!showAll)} aria-expanded={showAll}>
          {showAll ? "Show fewer" : `Show all ${rows.length}`}
        </button>
      ) : null}
      <p className="meta small">Each lift levels up with every 5% on its estimated max, or 2 more reps on bodyweight moves.</p>
    </section>
  );
}

/** Everything you've lifted, in everyday objects. */
export function LifetimeCard(props: { history: SessionRecord[]; units: Units }): React.ReactElement | null {
  const kg = lifetimeMovedKg(props.history);
  if (kg <= 0) return null;
  const like = equivalent(kg);
  return (
    <section className="card stack" style={{ gap: 4 }}>
      <span className="eyebrow">Lifted in total</span>
      <span className="hero-num num">{Math.round(displayLoad(kg, props.units)).toLocaleString()} {props.units}</span>
      {like ? <span className="meta">That's {like}.</span> : null}
    </section>
  );
}
