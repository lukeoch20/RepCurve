import React, { useMemo, useState } from "react";
import { EXERCISES, GROUPS, SOURCES, findExercise, getHowTo, ladderExercises } from "@repcurve/exercises";
import type { Exercise, Tier } from "@repcurve/shared";
import { itemLabel } from "../model/equipment";
import { Seg, Sheet } from "./common";

const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/** "gluteus_maximus" → "gluteus maximus". */
const anatomy = (x: string) => x.replace(/_/g, " ");

export const TIER_LABEL: Record<Tier, string | null> = { default: null, optional: "Optional", advanced: "Advanced", retired: "Retired" };

const BASIS: Record<string, string> = {
  direct: "Tested directly: training studies used this exercise or its exact comparison.",
  pattern: "Backed by the movement: studies of the pattern and the muscles it loads, applied to this version.",
  coverage: "Here for coverage: a practical option with little direct research of its own.",
};

const SOURCE = new Map(SOURCES.map((s) => [s.id, s]));

/** What an exercise needs, in words: "a barbell and plates and a rack, or dumbbells". */
function needsText(e: Exercise): string | null {
  const sets = e.requires.filter((s) => s.length > 0).map((s) => list(s.map(itemLabel)));
  if (sets.length === 0) return null;
  return sets.join(", or ");
}

function TierTag(props: { tier: Tier }): React.ReactElement | null {
  const label = TIER_LABEL[props.tier];
  return label ? <span className="example-tag">{label}</span> : null;
}

/** How to do an exercise: what it works, setup, steps, what to feel, what to avoid, and why it's here. */
export function ExerciseInfo(props: { exerciseId: string; onClose: () => void }): React.ReactElement {
  // Easier, harder and same-job exercises open in place, so keep the shown exercise here.
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
  const needs = needsText(e);
  // Rungs either side on its progression track; exercises at the same rung are listed as the same job.
  const ladder = ladderExercises(e.ladder).filter((x) => x.tier !== "retired");
  const easier = [...ladder].reverse().find((x) => x.ladderLevel < e.ladderLevel);
  const harder = ladder.find((x) => x.ladderLevel > e.ladderLevel);
  const sameJob = EXERCISES.filter((x) => x.family === e.family && x.id !== e.id && x.tier !== "retired" && x !== easier && x !== harder);
  const sources = [...(e.evidence?.direct ?? []), ...(e.evidence?.context ?? [])].map((s) => SOURCE.get(s)).filter((s) => s !== undefined);

  return (
    <Sheet title={e.name} onClose={props.onClose}>
      <div className="row-wrap" style={{ gap: 6 }}>
        <span className="example-tag">{e.group}</span>
        <TierTag tier={e.tier} />
      </div>
      {e.tier === "retired" ? <p className="banner adjust">No longer planned or offered: the evidence review found safer, better options for the same job.</p> : null}
      <p className="meta">
        Works your {list(e.targets.prime.map(anatomy))}
        {e.targets.secondary.length > 0 ? `, with help from your ${list(e.targets.secondary.map(anatomy))}` : ""}.
        {e.targets.stabilizers.length > 0 ? ` Your ${list(e.targets.stabilizers.map(anatomy))} hold you steady.` : ""}
        {needs ? ` Needs ${needs}.` : " No equipment needed."}
        {e.unilateral ? " One side at a time." : ""}
      </p>
      {how && e.cue ? <p className="prose"><b style={{ fontWeight: 600 }}>In short:</b> {e.cue}</p> : null}
      {how ? (
        <>
          <section className="howto">
            <h3 className="eyebrow">Setup</h3>
            <p className="prose">{how.setup}</p>
          </section>
          <section className="howto">
            <h3 className="eyebrow">{e.loadType === "time" ? "Each hold" : "Each rep"}</h3>
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
      {e.note || e.evidence ? (
        <section className="howto">
          <h3 className="eyebrow">Why it's here</h3>
          {e.note ? <p className="prose">{e.note}</p> : null}
          {e.evidence ? <p className="meta small">{BASIS[e.evidence.basis]}</p> : null}
          {sources.length > 0 ? (
            <details className="sources">
              <summary className="meta small">Sources ({sources.length})</summary>
              <ul className="howto-list">
                {sources.map((s) => (
                  <li key={s.id}>
                    <a href={s.url} target="_blank" rel="noreferrer">{s.authors} ({s.year})</a>, {s.title}. <i>{s.journal}</i>.{" "}
                    <span className="meta small">{s.finding}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
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
      {sameJob.length > 0 ? (
        <div className="field">
          <span className="label">Same job, other ways</span>
          <div className="row-wrap">
            {sameJob.map((x) => (
              <button key={x.id} type="button" className="chip" onClick={() => setId(x.id)}>
                {x.name}
                {TIER_LABEL[x.tier] ? <span className="meta small"> · {TIER_LABEL[x.tier]!.toLowerCase()}</span> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {id !== props.exerciseId ? (
        <button type="button" className="btn ghost" style={{ alignSelf: "flex-start" }} onClick={() => setId(props.exerciseId)}>
          Back to {findExercise(props.exerciseId)?.name ?? "the exercise"}
        </button>
      ) : null}
      <p className="meta small">Sharp or lasting pain means stop. Tap "It hurt" and RepCurve stops that exercise for today, then checks in before it next comes up.</p>
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

/** Every exercise in the app by muscle group: what yours can do, or everything. */
export function ExerciseLibrary(props: { available: Set<string>; onClose: () => void }): React.ReactElement {
  const [group, setGroup] = useState(GROUPS[0]!);
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [open, setOpen] = useState<string | null>(null);
  const shown = useMemo(
    () => EXERCISES.filter((e) => e.group === group && e.tier !== "retired" && (scope === "all" || props.available.has(e.id))),
    [group, scope, props.available],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of EXERCISES) if (e.tier !== "retired" && (scope === "all" || props.available.has(e.id))) c[e.group] = (c[e.group] ?? 0) + 1;
    return c;
  }, [scope, props.available]);
  return (
    <Sheet title="Exercise library" onClose={props.onClose}>
      <Seg label="Which exercises" value={scope} onChange={setScope} options={[{ value: "mine", label: "With my equipment" }, { value: "all", label: "Everything" }]} />
      <div className="row-wrap" role="group" aria-label="Muscle group">
        {GROUPS.map((g) => (
          <button key={g} type="button" className="chip" aria-pressed={g === group} onClick={() => setGroup(g)}>
            {g} <span className="num">{counts[g] ?? 0}</span>
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="meta">Nothing for this group with your equipment. Switch to Everything to see what would add one.</p>
      ) : (
        <ul className="library-list">
          {shown.map((e) => (
            <li key={e.id}>
              <button type="button" className="library-row" onClick={() => setOpen(e.id)}>
                <span>{e.name}</span>
                <TierTag tier={e.tier} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="meta small">Optional and advanced exercises are never planned on their own; pick them with Swap during a session.</p>
      {open ? <ExerciseInfo exerciseId={open} onClose={() => setOpen(null)} /> : null}
    </Sheet>
  );
}
