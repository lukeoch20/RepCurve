import React, { useMemo, useState } from "react";
import { displayLoad, loadUnitsFor } from "@repcurve/shared";
import type { Units } from "@repcurve/shared";
import { dayLabel } from "../model/format";
import { weekStreak } from "../model/plan";
import { change, inRange, liftForecast, liftSeries, weeklyAdherence, type LiftSeries, type Range } from "../model/progress";
import { userProjection, weeksSince } from "../model/projection";
import type { Core, SessionRecord } from "../model/types";
import { Seg } from "./common";
import { ProjectionCard } from "./ProjectionCard";
import { ShareBars, TrendChart } from "./charts";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const shortDate = (t: number) => new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });
const pct = (share: number) => `${share >= 0 ? "+" : "−"}${Math.abs(Math.round(share * 100))}%`;

export function Progress(props: { core: Core; history: SessionRecord[] }): React.ReactElement {
  const { core, history } = props;
  const now = Date.now();
  const units = loadUnitsFor(core.profile, core.equipment);
  const lifts = useMemo(() => liftSeries(history), [history]);
  const [range, setRange] = useState<Range>("12w");
  const [liftId, setLiftId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const lift = lifts.find((l) => l.id === liftId) ?? lifts[0] ?? null;
  const done = history.filter((r) => !r.skipped);
  const minutes = done.reduce((n, r) => n + r.activeMinutes, 0);
  const streak = weekStreak(history, now);
  // Recomputed at least hourly, so weeks-in and adherence stay current.
  const hour = Math.floor(now / 3_600_000);
  const projection = useMemo(() => userProjection(core, history, hour * 3_600_000), [core, history, hour]);

  return (
    <div className="stack-lg">
      <header className="stack" style={{ gap: 6 }}>
        <p className="eyebrow">Progress</p>
        <h1 className="title">Your curve so far</h1>
      </header>

      <Seg
        label="Time range"
        value={range}
        onChange={setRange}
        options={[
          { value: "4w", label: "4W" },
          { value: "12w", label: "12W" },
          { value: "all", label: "All" },
        ]}
      />

      <div className="stats">
        <div className="stat"><b className="num">{done.length}</b><span>sessions</span></div>
        <div className="stat"><b className="num">{minutes}</b><span>minutes</span></div>
        <div className="stat"><b className="num">{streak}</b><span>week streak</span></div>
      </div>

      {lift ? (
        <StrengthTrend lifts={lifts} lift={lift} onLift={setLiftId} range={range} now={now} units={units} />
      ) : (
        <section className="card stack">
          <h2 className="h3">Strength trend</h2>
          <p className="meta">Finish your first session and your lifts appear here.</p>
        </section>
      )}

      {lifts.length > 0 ? <Records lifts={lifts} units={units} /> : null}

      <Adherence history={history} core={core} range={range} now={now} />

      {lift && lift.metric === "e1rm" ? (
        <Forecast lift={lift} core={core} history={history} now={now} units={units} projection={projection} />
      ) : null}

      <ProjectionCard projection={projection} units={core.profile.units} />

      <section className="card">
        <h2 className="h3" style={{ marginBottom: 6 }}>History</h2>
        {history.length === 0 ? <p className="meta">No sessions yet.</p> : null}
        {[...history].reverse().slice(0, showAll ? 200 : 8).map((r) => (
          <div key={r.id} className="lift">
            <div>
              <div className="name">{r.name}{r.skipped ? " · skipped" : ""}</div>
              <div className="now">
                {dayLabel(r.finishedAt, now)} · {r.activeMinutes} min
                {r.kind === "strength" && !r.skipped ? ` · ${r.sets.length} sets` : ""}
                {r.cardio ? ` · effort ${r.cardio.effort}/10` : ""}
              </div>
            </div>
            <span className="meta small num">#{r.index + 1}</span>
          </div>
        ))}
        {history.length > 8 ? (
          <button type="button" className="btn ghost" onClick={() => setShowAll(!showAll)} aria-expanded={showAll}>
            {showAll ? "Show fewer" : `Show all ${history.length}`}
          </button>
        ) : null}
      </section>
    </div>
  );
}

function valueOf(l: LiftSeries, y: number, units: Units): number {
  return l.metric === "e1rm" ? displayLoad(Math.round(y * 10) / 10, units) : y;
}

function StrengthTrend(props: { lifts: LiftSeries[]; lift: LiftSeries; onLift: (id: string) => void; range: Range; now: number; units: Units }): React.ReactElement {
  const { lift, units } = props;
  const pts = inRange(lift.points, props.range, props.now);
  const shown = pts.length > 0 ? pts : lift.points.slice(-1);
  const unit = lift.metric === "e1rm" ? units : "reps";
  const share = change(shown);
  const points = shown.map((p) => ({ x: p.t, y: valueOf(lift, p.y, units), label: `${valueOf(lift, p.y, units)} ${unit} · ${shortDate(p.t)}` }));
  const first = shown[0]!.t;
  const last = shown[shown.length - 1]!.t;
  const xTicks = first === last ? [{ x: first, label: shortDate(first) }] : [{ x: first, label: shortDate(first) }, { x: (first + last) / 2, label: shortDate((first + last) / 2) }, { x: last, label: shortDate(last) }];
  return (
    <section className="card">
      <div className="card-head">
        <h2 className="h3">Strength trend</h2>
        <select className="input" style={{ width: "auto", minHeight: 36, borderRadius: 999, fontSize: "0.84rem", maxWidth: "11rem" }} aria-label="Lift" value={lift.id} onChange={(e) => props.onLift(e.target.value)}>
          {props.lifts.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </div>
      <div className="hero-num">{share === null ? "—" : pct(share)}</div>
      <p className="meta small" style={{ marginBottom: 8 }}>
        {lift.metric === "e1rm" ? "Estimated one-rep max" : "Best set, reps"} · {share === null ? "one session so far" : `since ${shortDate(first)}`}
      </p>
      <TrendChart title={`${lift.name}: ${lift.metric === "e1rm" ? "estimated one-rep max" : "best set"} by session`} points={points} xTicks={xTicks} unit={unit} />
    </section>
  );
}

function Records(props: { lifts: LiftSeries[]; units: Units }): React.ReactElement {
  const top = props.lifts.slice(0, 3);
  return (
    <section className="card">
      <div className="card-head">
        <h2 className="h3">Personal records</h2>
        <span className="meta small">best so far</span>
      </div>
      <div className="records">
        {top.map((l) => {
          const best = Math.max(...l.points.map((p) => p.y));
          const gain = valueOf(l, best, props.units) - valueOf(l, l.points[0]!.y, props.units);
          const unit = l.metric === "e1rm" ? props.units : "reps";
          return (
            <div className="record" key={l.id}>
              <div className="what" title={l.name}>{l.name}</div>
              <b>
                {valueOf(l, best, props.units)} <span style={{ fontSize: "0.8rem", fontWeight: 500 }}>{unit}</span>
              </b>
              <div className="delta">{gain > 0 ? `+${Math.round(gain * 10) / 10} since first` : "first best"}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Adherence(props: { history: SessionRecord[]; core: Core; range: Range; now: number }): React.ReactElement | null {
  const weeks = weeklyAdherence(props.history, props.core.profile.daysPerWeek, props.now);
  const shown = inRange(weeks, props.range, props.now);
  if (shown.length === 0) return null;
  const done = shown.reduce((n, w) => n + Math.min(w.done, w.planned), 0);
  const planned = shown.reduce((n, w) => n + w.planned, 0);
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="h3">Adherence</h2>
          <p className="meta small">Sessions done out of {props.core.profile.daysPerWeek} a week</p>
        </div>
        <span className="hero-num" style={{ fontSize: "1.6rem" }}>{Math.round((done / Math.max(1, planned)) * 100)}%</span>
      </div>
      <ShareBars
        title="Share of planned sessions done, by week"
        bars={shown.map((w) => ({
          label: shortDate(w.t),
          value: w.done / w.planned,
          tip: `Week of ${shortDate(w.t)}: ${w.done} of ${w.planned}`,
        }))}
      />
    </section>
  );
}

function Forecast(props: { lift: LiftSeries; core: Core; history: SessionRecord[]; now: number; units: Units; projection: ReturnType<typeof userProjection> }): React.ReactElement {
  const { lift, units } = props;
  const current = lift.points[lift.points.length - 1]!.y;
  const weeksIn = weeksSince(props.core.startedAt, props.now);
  const band = liftForecast(current, props.projection, weeksIn);
  const v = (kg: number) => displayLoad(Math.round(kg * 10) / 10, units);
  const recent = lift.points.slice(-6).map((p) => ({ x: (p.t - props.now) / WEEK_MS, y: v(p.y), label: `${v(p.y)} ${units} · ${shortDate(p.t)}` }));
  const at = (w: number) => band.find((b) => b.weeksAhead === w)!;
  const lowEnd = Math.round(v(at(8).mid));
  const highEnd = Math.round(v(at(12).mid));
  return (
    <section className="card">
      <h2 className="h3">Your 8–12 week forecast</h2>
      <p className="meta small" style={{ marginBottom: 10 }}>
        {lift.name}, if it follows your projected strength curve from your training, consistency and recent sessions.
      </p>
      <p style={{ margin: "0 0 8px" }}>
        <b className="num">{Math.round(v(current))} {units}</b> <span className="meta">now</span>
        <span className="meta"> → </span>
        <b className="num">{lowEnd === highEnd ? lowEnd : `${lowEnd}–${highEnd}`} {units}</b> <span className="meta">in 8–12 weeks</span>
      </p>
      <TrendChart
        title={`${lift.name}: recent estimated one-rep max and the projected range for the next 12 weeks`}
        points={recent}
        band={band.map((b) => ({
          x: b.weeksAhead,
          lo: v(b.lo),
          mid: v(b.mid),
          hi: v(b.hi),
          label: b.weeksAhead === 0 ? `${v(b.mid)} ${units} now` : `${b.weeksAhead} wks: ~${Math.round(v(b.mid))} ${units} (${Math.round(v(b.lo))}–${Math.round(v(b.hi))})`,
        }))}
        xTicks={[
          { x: 0, label: "Now" },
          { x: 4, label: "4 wks" },
          { x: 8, label: "8 wks" },
          { x: 12, label: "12 wks" },
        ]}
        unit={units}
      />
      <p className="meta small" style={{ marginTop: 8 }}>Dashed line: most likely. Shaded: the range for about 8 in 10 people like you.</p>
    </section>
  );
}
