import React from "react";

export function Seg<T extends string | number>(props: {
  value: T | undefined;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}): React.ReactElement {
  return (
    <div className="seg" role="group" aria-label={props.label}>
      {props.options.map((o) => (
        <button key={String(o.value)} type="button" aria-pressed={props.value === o.value} onClick={() => props.onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Choice<T extends string>(props: {
  value: T | undefined;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
  label: string;
}): React.ReactElement {
  return (
    <div className="choice" role="group" aria-label={props.label}>
      {props.options.map((o) => (
        <button key={o.value} type="button" aria-pressed={props.value === o.value} onClick={() => props.onChange(o.value)}>
          <b>{o.label}</b>
          {o.hint ? <span>{o.hint}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Toggle(props: { id: string; label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }): React.ReactElement {
  return (
    <div className="toggle">
      <label htmlFor={props.id} className="grow">
        <span style={{ fontWeight: 700 }}>{props.label}</span>
        {props.hint ? <span className="meta small" style={{ display: "block" }}>{props.hint}</span> : null}
      </label>
      <input id={props.id} type="checkbox" role="switch" className="switch" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} />
    </div>
  );
}

export function Stepper(props: {
  label: string;
  value: string;
  unit: string;
  onDec: () => void;
  onInc: () => void;
  decDisabled?: boolean;
  incDisabled?: boolean;
}): React.ReactElement {
  return (
    <div className="stepper" role="group" aria-label={props.label}>
      <button type="button" aria-label={`Less ${props.label.toLowerCase()}`} onClick={props.onDec} disabled={props.decDisabled}>
        −
      </button>
      <div className="value" aria-live="polite">
        <b>{props.value}</b>
        <span>{props.unit}</span>
      </div>
      <button type="button" aria-label={`More ${props.label.toLowerCase()}`} onClick={props.onInc} disabled={props.incDisabled}>
        +
      </button>
    </div>
  );
}

export function Sheet(props: { title: string; onClose: () => void; children: React.ReactNode }): React.ReactElement {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && props.onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.onClose]);
  return (
    <div className="scrim" onClick={props.onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={props.title} onClick={(e) => e.stopPropagation()}>
        <div className="spread">
          <h2 className="h2">{props.title}</h2>
          <button type="button" className="btn ghost" onClick={props.onClose}>
            Close
          </button>
        </div>
        {props.children}
      </div>
    </div>
  );
}

/** A small rising curve: the RepCurve mark. */
export function CurveMark(props: { size?: number }): React.ReactElement {
  const s = props.size ?? 28;
  return (
    <svg width={s} height={s} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--cobalt)" />
      <path d="M6 24 C 12 23, 15 19, 17 15 S 22 8, 26 7" fill="none" stroke="var(--cobalt-ink)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="26" cy="7" r="2.6" fill="var(--cobalt-ink)" />
    </svg>
  );
}
