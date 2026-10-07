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

/** The RepCurve mark: a rising curve. */
export function CurveMark(props: { size?: number }): React.ReactElement {
  const s = props.size ?? 28;
  return (
    <svg width={s} height={s} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      <path d="M6 24 C 12 23, 15 19, 17 15 S 22 8, 26 7" fill="none" stroke="var(--accent-ink)" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

const ICONS = {
  today: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  plan: "M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5zM4 10h16M8.5 3v4M15.5 3v4",
  progress: "M5 20V13M10 20V8M15 20v-5M20 20V5",
  settings: "M4 7h10M18 7h2M4 17h4M12 17h8M14 4.5v5M8 14.5v5",
  chevronRight: "m9 5 7 7-7 7",
  chevronLeft: "m15 5-7 7 7 7",
  check: "m5 12.5 4.5 4.5L19 7.5",
  arrowRight: "M5 12h14m-6-6 6 6-6 6",
  trendUp: "m4 16 5-5 4 4 7-7M15 8h5v5",
  alert: "M12 8v5m0 3.5v.01M10.3 4.2 2.8 17.5A2 2 0 0 0 4.5 20.5h15a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z",
  dumbbell: "M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11",
  run: "M13.5 5.5a1.5 1.5 0 1 0 0-.01M10 21l2.5-5.5L15 17v4M8 11l3-3 3 1.5 2.5 2.5M12.5 15.5 11 11",
  bench: "M3 13h18M6 13v6M18 13v6M5 9h8",
  treadmill: "M4 17h13l3-9M7 17v3M16 17v3M15 5h3",
  mat: "M4 8h13a3 3 0 0 1 0 6H4zM4 14v3h13",
  wheel: "M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM3 12h3M18 12h3",
  bar: "M3 6h18M6 6v2M18 6v2M9 10h6v4H9z",
  band: "M5 8c4 0 4 8 8 8s4-8 6-8M5 6v4M19 6v4",
  pairs: "M5 8v8M9 8v8M15 8v8M19 8v8M5 12h4M15 12h4",
  core: "M12 4v16M7 8h10M7 16h10M9 12h6",
  pause: "M8 5v14M16 5v14",
  play: "M7 5v14l11-7z",
} as const;

export type IconName = keyof typeof ICONS;

export function Icon(props: { name: IconName; size?: number; strokeWidth?: number }): React.ReactElement {
  const s = props.size ?? 22;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={props.strokeWidth ?? 1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[props.name]} />
    </svg>
  );
}

/** A circular countdown: the green arc is the time left. */
export function TimerRing(props: { fraction: number; size: number }): React.ReactElement {
  const r = props.size / 2 - 5;
  const c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, props.fraction));
  return (
    <svg width={props.size} height={props.size} viewBox={`0 0 ${props.size} ${props.size}`} aria-hidden="true">
      <circle cx={props.size / 2} cy={props.size / 2} r={r} fill="none" stroke="var(--sunk)" strokeWidth="6" />
      <circle
        cx={props.size / 2}
        cy={props.size / 2}
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${c * f} ${c}`}
        transform={`rotate(-90 ${props.size / 2} ${props.size / 2})`}
      />
    </svg>
  );
}
