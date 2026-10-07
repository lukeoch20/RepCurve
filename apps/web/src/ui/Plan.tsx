import React, { useMemo, useState } from "react";
import { MUSCLES } from "@repcurve/engine";
import { loadUnitsFor } from "@repcurve/shared";
import { plural } from "../model/format";
import { currentProgram, weekSessions } from "../model/plan";
import type { Core, SessionRecord } from "../model/types";
import { Icon } from "./common";
import { SessionRow, WeekStrip } from "./Week";

const MUSCLE_NAMES: Record<string, string> = {
  quads: "Quads", glutes: "Glutes", hamstrings: "Hamstrings", chest: "Chest", shoulders: "Shoulders",
  triceps: "Triceps", biceps: "Biceps", back: "Back", core: "Core", calves: "Calves",
};

/** One line on what the engine changed after the latest session, so adjustments are visible. */
function adjustmentSummary(history: SessionRecord[]): { title: string; detail: string } {
  const last = [...history].reverse().find((r) => !r.skipped && r.kind === "strength" && r.changes.length > 0);
  if (!last) return { title: "Adjusts as you go", detail: "Weights, reps and exercises update after every session from what you log." };
  const acted = last.changes.filter((c) => c.action !== "skipped");
  const up = acted.filter((c) => ["load_up", "ladder_up", "widen_range", "add_rep"].includes(c.action)).length;
  const down = acted.filter((c) => ["load_down", "ladder_down", "pain"].includes(c.action)).length;
  const parts = [up > 0 ? `${plural(up, "exercise")} moved up` : "", down > 0 ? `${plural(down, "exercise")} eased off` : ""].filter(Boolean);
  return {
    title: "Auto-adjusted for you",
    detail: parts.length > 0 ? `After your last session: ${parts.join(", ")}.` : "After your last session your plan held steady: same weights and targets.",
  };
}

export function Plan(props: { core: Core; history: SessionRecord[] }): React.ReactElement {
  const { core, history } = props;
  // Volume comes from the sessions as the user gets them now, so progress that changes them shows here.
  const program = useMemo(() => currentProgram(core), [core]);
  const { week, sessions } = useMemo(() => weekSessions(core, history, Date.now()), [core, history]);
  const units = loadUnitsFor(core.profile, core.equipment);
  const adjusted = adjustmentSummary(history);
  const [explainOpen, setExplainOpen] = useState(false);
  const [lo, hi] = program.volumeTarget;
  const max = Math.max(hi + 4, ...MUSCLES.map((m) => program.weeklyVolume[m]));
  return (
    <div className="stack-lg">
      <header className="stack" style={{ gap: 6 }}>
        <h1 className="title">Your plan</h1>
        <p className="meta">
          Built for your goals, equipment and schedule: {core.profile.daysPerWeek} × {core.profile.minutesPerSession} minutes a week.
        </p>
      </header>

      <section className="card stack" style={{ gap: 14 }}>
        <span className="eyebrow">Week {week}</span>
        <WeekStrip slots={sessions} />
      </section>

      <section className="session-list" aria-label={`Week ${week} sessions`}>
        {sessions.map((s, i) => (
          <SessionRow key={s.index} session={s} position={i} units={units} />
        ))}
      </section>

      <section className="card tint" style={{ display: "grid", gridTemplateColumns: "36px 1fr", gap: 12, alignItems: "start" }}>
        <span className="glyph" style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--card)" }} aria-hidden="true">
          <Icon name="trendUp" size={18} />
        </span>
        <div>
          <b style={{ color: "var(--accent)", fontWeight: 600 }}>{adjusted.title}</b>
          <p className="meta small" style={{ marginTop: 2 }}>{adjusted.detail}</p>
        </div>
      </section>

      <section className="card stack">
        <h2 className="h3">How this plan works</h2>
        {(explainOpen ? program.explanation : program.explanation.slice(0, 1)).map((p, i) => (
          <p className="prose" key={i}>{p}</p>
        ))}
        {program.explanation.length > 1 ? (
          <button type="button" className="btn ghost" style={{ alignSelf: "flex-start" }} onClick={() => setExplainOpen(!explainOpen)} aria-expanded={explainOpen}>
            {explainOpen ? "Show less" : "Read more"}
          </button>
        ) : null}
      </section>

      <section className="card stack">
        <h2 className="h3">Hard sets per muscle, per week</h2>
        <p className="meta small">The shaded band is the useful range for your level ({lo}–{hi}). Secondary muscles count as half a set.</p>
        <div className="muscles">
          {MUSCLES.filter((m) => program.weeklyVolume[m] > 0).map((m) => {
            const v = program.weeklyVolume[m];
            return (
              <div className="muscle" key={m}>
                <span>{MUSCLE_NAMES[m]}</span>
                <span className="bar" role="img" aria-label={`${MUSCLE_NAMES[m]}: ${v} sets`}>
                  <span className="band" style={{ left: `${(lo / max) * 100}%`, width: `${((hi - lo) / max) * 100}%` }} />
                  <i style={{ width: `${(v / max) * 100}%` }} />
                </span>
                <span className="v">{Number.isInteger(v) ? v : v.toFixed(1)}</span>
              </div>
            );
          })}
        </div>
      </section>
      <p className="meta small">
        Plan numbers come from training research: weekly hard sets drive muscle growth with diminishing returns, sets taken close to failure count most, and short sessions work when the weekly total is there.
      </p>
    </div>
  );
}
