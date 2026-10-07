import React, { useState } from "react";
import { findExercise, getHowTo, ladderExercises } from "@repcurve/exercises";
import type { EquipmentItem, Muscle } from "@repcurve/shared";
import { Sheet } from "./common";

const MUSCLE: Record<Muscle, string> = {
  quads: "quads", glutes: "glutes", hamstrings: "hamstrings", chest: "chest", shoulders: "shoulders",
  triceps: "triceps", biceps: "biceps", back: "back", core: "core", calves: "calves",
};
const EQUIPMENT: Record<EquipmentItem, string> = {
  dumbbells: "dumbbells", bench: "a bench or sturdy chair", pullup_bar: "a pull-up bar", ab_roller: "an ab roller",
  bands: "a resistance band", mat: "a mat", treadmill: "a treadmill",
};

const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/** How to do an exercise: what it works, setup, steps, what to feel, what to avoid. */
export function ExerciseInfo(props: { exerciseId: string; onClose: () => void }): React.ReactElement {
  // Easier and harder versions can be opened in place, so keep the shown exercise here.
  const [id, setId] = useState(props.exerciseId);
  const e = findExercise(id);
  const how = getHowTo(id);
  if (!e) {
    return (
      <Sheet title="Exercise" onClose={props.onClose}>
        <p className="meta">This exercise is no longer in the library.</p>
      </Sheet>
    );
  }
  const needs = (e.requires[0] ?? []).map((r) => EQUIPMENT[r] ?? r);
  const ladder = ladderExercises(e.ladder);
  const at = ladder.findIndex((x) => x.id === e.id);
  const easier = at > 0 ? ladder[at - 1] : undefined;
  const harder = at >= 0 && at < ladder.length - 1 ? ladder[at + 1] : undefined;

  return (
    <Sheet title={e.name} onClose={props.onClose}>
      <p className="meta">
        Works your {list(e.primary.map((m) => MUSCLE[m]))}
        {e.secondary.length > 0 ? `, with help from your ${list(e.secondary.map((m) => MUSCLE[m]))}` : ""}.
        {needs.length > 0 ? ` Needs ${list(needs)}.` : " No equipment needed."}
        {e.unilateral ? " One side at a time." : ""}
      </p>
      {how ? (
        <>
          <section className="howto">
            <h3 className="eyebrow">Setup</h3>
            <p className="prose">{how.setup}</p>
          </section>
          <section className="howto">
            <h3 className="eyebrow">Each rep</h3>
            <ol className="howto-steps">
              {how.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </section>
          <section className="howto">
            <h3 className="eyebrow">Feel for</h3>
            <ul className="howto-list">
              {how.cues.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </section>
          <section className="howto">
            <h3 className="eyebrow">Avoid</h3>
            <ul className="howto-list avoid">
              {how.mistakes.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </section>
        </>
      ) : e.cue ? (
        <p className="prose">{e.cue}</p>
      ) : null}
      {easier || harder ? (
        <div className="row-wrap">
          {easier ? (
            <button type="button" className="chip" onClick={() => setId(easier.id)}>
              Easier: {easier.name}
            </button>
          ) : null}
          {harder ? (
            <button type="button" className="chip" onClick={() => setId(harder.id)}>
              Harder: {harder.name}
            </button>
          ) : null}
        </div>
      ) : null}
      {id !== props.exerciseId ? (
        <button type="button" className="btn ghost" style={{ alignSelf: "flex-start" }} onClick={() => setId(props.exerciseId)}>
          Back to {findExercise(props.exerciseId)?.name ?? "the exercise"}
        </button>
      ) : null}
      <p className="meta small">Sharp or lasting pain means stop. Log the set with "It hurt" and RepCurve swaps the exercise next time.</p>
    </Sheet>
  );
}

/** An exercise name that opens its how-to guide. */
export function ExerciseName(props: { id: string; name: string; className?: string }): React.ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={`exercise-link${props.className ? ` ${props.className}` : ""}`} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {props.name}
      </button>
      {open ? <ExerciseInfo exerciseId={props.id} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
