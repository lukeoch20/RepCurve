import React, { useState } from "react";
import type { Aim } from "@repcurve/shared";
import { AIM_LABEL, AIM_OPTIONS, tipAfter, tipsFor, type AimTip } from "../model/aimTips";
import type { Core, SessionRecord } from "../model/types";
import { useStore } from "../store/useAppStore";
import { Choice, Sheet, Toggle } from "./common";

/** A tip's reasoning, cautions and sources, as "Learn more" and the full list show them. */
function TipDetails(props: { tip: AimTip }): React.ReactElement {
  const { tip } = props;
  return (
    <>
      {tip.more.map((p) => (
        <p key={p.slice(0, 24)} className="prose">{p}</p>
      ))}
      {tip.caution ? <p className="banner adjust">{tip.caution}</p> : null}
      <section className="howto sources">
        <h3 className="eyebrow">The research</h3>
        <ul className="howto-list">
          {tip.sources.map((s) => (
            <li key={s.url} className="meta small">
              <a href={s.url} target="_blank" rel="noreferrer">{s.cite}</a>
            </li>
          ))}
        </ul>
      </section>
      <p className="meta small">General guidance, not medical advice.</p>
    </>
  );
}

/** Asks someone set up before aims existed what they want most, so tips can follow it. */
function AskAim(props: { core: Core }): React.ReactElement {
  const { dispatch } = useStore();
  return (
    <section className="card stack" aria-labelledby="ask-aim-title">
      <h2 className="h3" id="ask-aim-title">What do you most want from training?</h2>
      <p className="meta small">You'll get a tip for it after each workout, with the research behind it. Your plan stays as it is.</p>
      <Choice
        label="Main aim"
        value={undefined}
        options={AIM_OPTIONS}
        onChange={(aim: Aim) => dispatch({ type: "setup", profile: { ...props.core.profile, aim }, now: Date.now() })}
      />
    </section>
  );
}

/** After a workout: the next tip for the person's aim, with "Learn more". */
export function AimTipCard(props: { core: Core; record: SessionRecord; history: SessionRecord[] }): React.ReactElement | null {
  const [open, setOpen] = useState(false);
  const aim = props.core.profile.aim;
  if (props.core.settings.aimTips === false) return null;
  if (!aim) return <AskAim core={props.core} />;
  const tip = tipAfter(aim, props.record, props.history);
  return (
    <section className="card stack aim-tip" aria-labelledby="aim-tip-title">
      <p className="eyebrow">Tip for your aim · {AIM_LABEL[aim]}</p>
      <h2 className="h3" id="aim-tip-title">{tip.title}</h2>
      <p className="prose">{tip.short}</p>
      <button type="button" className="btn small" style={{ alignSelf: "flex-start" }} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        Learn more
      </button>
      {open ? (
        <Sheet title={tip.title} onClose={() => setOpen(false)}>
          <TipDetails tip={tip} />
        </Sheet>
      ) : null}
    </section>
  );
}

/** Settings: tips after workouts on or off, and every tip for the person's aim. */
export function AimTipsSettings(props: { core: Core }): React.ReactElement {
  const { dispatch } = useStore();
  const [browsing, setBrowsing] = useState(false);
  const aim = props.core.profile.aim;
  const on = props.core.settings.aimTips !== false;
  return (
    <section className="card stack">
      <h2 className="h3">Tips for your aim</h2>
      <p className="meta small">
        {aim ? <>Your aim: <b>{AIM_LABEL[aim]}</b>. Change it under Edit profile and schedule.</> : "Pick your aim after your next workout, or under Edit profile and schedule."}
      </p>
      <Toggle id="aim-tips" label="A tip after each workout" hint="Science-based advice for your aim, outside the plan itself" checked={on} onChange={(aimTips) => dispatch({ type: "settings", settings: { aimTips } })} />
      {aim ? (
        <button type="button" className="btn" style={{ alignSelf: "flex-start" }} aria-haspopup="dialog" onClick={() => setBrowsing(true)}>
          See all {tipsFor(aim).length} tips
        </button>
      ) : null}
      {browsing && aim ? (
        <Sheet title={`Tips: ${AIM_LABEL[aim]}`} onClose={() => setBrowsing(false)}>
          <div className="aim-tip-list">
            {tipsFor(aim).map((t) => (
              <details key={t.id}>
                <summary>{t.title}</summary>
                <div className="stack">
                  <p className="prose">{t.short}</p>
                  <TipDetails tip={t} />
                </div>
              </details>
            ))}
          </div>
        </Sheet>
      ) : null}
    </section>
  );
}
