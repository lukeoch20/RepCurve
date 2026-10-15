import React, { useId, useState } from "react";

/** Paragraphs shown up front: what the week is, how the days split, and whether the volume is enough. */
const SUMMARY = 3;

/** The engine's account of a plan: the summary first, the rest behind "How this plan works". */
export function PlanExplanation(props: { lines: string[] }): React.ReactElement {
  const [open, setOpen] = useState(false);
  const id = useId();
  const rest = props.lines.slice(SUMMARY);
  return (
    <div className="stack">
      <div>
        {props.lines.slice(0, SUMMARY).map((p, k) => (
          <p key={k} className="prose">{p}</p>
        ))}
      </div>
      {rest.length > 0 ? (
        <>
          <button type="button" className="btn ghost" style={{ alignSelf: "flex-start" }} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
            How this plan works
          </button>
          <div id={id} hidden={!open}>
            {rest.map((p, k) => (
              <p key={k} className="prose">{p}</p>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
