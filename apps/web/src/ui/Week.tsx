import React, { useState } from "react";
import type { SessionPlan } from "@repcurve/engine";
import type { Units } from "@repcurve/shared";
import { exerciseCount, type WeekSession, type WeekSlot } from "../model/plan";
import { plural } from "../model/format";
import { Icon } from "./common";
import { CardioLineup, Lineup } from "./Lineup";

const STATUS: Record<WeekSlot["status"], string> = { done: "done", skipped: "skipped", next: "up next", upcoming: "coming up" };

/** This week's sessions as a row of numbered circles: done, up next, or still to come. */
export function WeekStrip(props: { slots: WeekSlot[] }): React.ReactElement {
  return (
    <ol className="week" aria-label="This week's sessions" style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {props.slots.map((s, i) => (
        <li key={s.index} className={`week-day ${s.status}`} aria-label={`Session ${i + 1}: ${s.name}, ${STATUS[s.status]}`}>
          <span className="s" aria-hidden="true">{s.kind === "cardio" ? "Cardio" : "Lift"}</span>
          <span className="k" aria-hidden="true">{s.status === "done" ? <Icon name="check" size={16} strokeWidth={2.2} /> : i + 1}</span>
        </li>
      ))}
    </ol>
  );
}

export function sessionSummary(plan: SessionPlan): string {
  if (plan.kind === "cardio") return `${plan.cardio?.mode === "treadmill" ? "Treadmill" : "Walk or jog"} · ${plan.cardio?.totalMinutes ?? plan.budgetMinutes} min`;
  return `${plural(exerciseCount(plan), "exercise")} · ~${Math.round(plan.estimatedMinutes)} min`;
}

export function SessionGlyph(props: { plan: SessionPlan }): React.ReactElement {
  return (
    <span className="glyph" aria-hidden="true">
      <Icon name={props.plan.kind === "cardio" ? "run" : "dumbbell"} size={26} />
    </span>
  );
}

/** One session of the week; tap to see what's in it. */
export function SessionRow(props: { session: WeekSession; position: number; units: Units }): React.ReactElement {
  const { session, position } = props;
  const [open, setOpen] = useState(false);
  const when = session.status === "next" ? "Up next" : session.status === "done" ? "Done" : session.status === "skipped" ? "Skipped" : `Session ${position + 1}`;
  return (
    <div>
      <button
        type="button"
        className={`session-row${session.status === "next" ? " current" : ""}${session.status === "done" || session.status === "skipped" ? " done" : ""}`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <SessionGlyph plan={session.plan} />
        <span style={{ minWidth: 0 }}>
          <span className="when" style={{ display: "block" }}>{when}</span>
          <span className="name" style={{ display: "block" }}>{session.name}</span>
          <span className="sub" style={{ display: "block" }}>{sessionSummary(session.plan)}</span>
        </span>
        <span className="chev"><Icon name="chevronRight" size={18} /></span>
      </button>
      {open ? (
        <div className="session-detail card" style={{ marginTop: 6 }}>
          {session.plan.kind === "strength" ? <Lineup plan={session.plan} units={props.units} /> : <CardioLineup plan={session.plan} />}
        </div>
      ) : null}
    </div>
  );
}
