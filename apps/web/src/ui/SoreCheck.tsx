import React from "react";
import { SORE_GROUP_NAME, sorenessSummary, type SessionPlan, type SoreLevel } from "@repcurve/engine";
import type { Muscle } from "@repcurve/shared";
import { currentSoreCheck, soreFrom, soreQuestionFor } from "../model/soreness";
import type { Core, SessionRecord } from "../model/types";
import { useStore } from "../store/useAppStore";
import { Seg } from "./common";

const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/**
 * "Still sore from yesterday's session?", asked on Today when today's plan works muscles a session in
 * the last three days worked. Not sore or a bit sore keeps the plan; very sore takes a set off the
 * exercises for those muscles and keeps their weight. The answer is saved with the session.
 */
export function SoreCheckCard(props: { core: Core; history: SessionRecord[]; plan: SessionPlan; now: number }): React.ReactElement | null {
  const { core, plan, now } = props;
  const { dispatch } = useStore();
  const question = soreQuestionFor(plan, props.history, now);
  if (!question) return null;
  const asked = question.groups;
  const check = currentSoreCheck(core, now);
  const level = check?.level;
  const picked = (check?.answers ?? []).filter((a) => a.level !== "none" && asked.includes(a.group)).map((a) => a.group);
  const answer = (next: SoreLevel, groups: Muscle[]) => dispatch({ type: "soreness", asked, level: next, picked: groups, now: Date.now() });
  const onLevel = (next: SoreLevel) => answer(next, picked.length > 0 ? picked : asked.length === 1 ? asked : []);
  const toggle = (g: Muscle) => answer(level ?? "very", picked.includes(g) ? picked.filter((x) => x !== g) : [...picked, g]);
  const summary = sorenessSummary(plan);

  return (
    <section className="card stack" aria-labelledby="sore-q">
      <div className="stack" style={{ gap: 4 }}>
        <h2 className="h3" id="sore-q">Still sore from {soreFrom(question.since, now)}?</h2>
        <p className="meta small">Today works your {list(asked.map((g) => SORE_GROUP_NAME[g].toLowerCase()))} again.</p>
      </div>
      <Seg
        label="How sore"
        value={level}
        onChange={onLevel}
        options={[
          { value: "none", label: "Not sore" },
          { value: "bit", label: "A bit" },
          { value: "very", label: "Very" },
        ]}
      />
      {(level === "bit" || level === "very") && asked.length > 1 ? (
        <div className="field">
          <span className="label">Where?</span>
          <div className="row-wrap" role="group" aria-label="Where it's sore">
            {asked.map((g) => (
              <button key={g} type="button" className="chip" aria-pressed={picked.includes(g)} onClick={() => toggle(g)}>
                {SORE_GROUP_NAME[g]}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {level === undefined ? (
        <p className="meta small">Soreness a day or two after training is normal and isn't a reason to skip.</p>
      ) : level === "none" ? (
        <p className="meta small">Good. Today's plan is as normal.</p>
      ) : level === "bit" ? (
        <p className="meta small">A bit sore is normal, and training through it is fine. The plan stays as it is; the warm-up helps.</p>
      ) : summary ? (
        <p className="meta small" role="status">{summary} The rest of the plan is as normal.</p>
      ) : (
        <p className="meta small">Pick where it's very sore.</p>
      )}
    </section>
  );
}
