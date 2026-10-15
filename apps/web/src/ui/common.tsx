import React from "react";
import { createPortal } from "react-dom";
import { IS_TEST } from "../platform/channel";
import { useFocusTrap } from "./focusTrap";
import { PIXEL_ICONS } from "./pixelIcons";

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
  options: { value: T; label: string; hint?: string; disabled?: boolean }[];
  onChange: (v: T) => void;
  label: string;
}): React.ReactElement {
  return (
    <div className="choice" role="group" aria-label={props.label}>
      {props.options.map((o) => (
        // An unavailable option stays focusable so its reason can be reached and read.
        <button
          key={o.value}
          type="button"
          aria-pressed={props.value === o.value}
          aria-disabled={o.disabled || undefined}
          onClick={() => {
            if (!o.disabled) props.onChange(o.value);
          }}
        >
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
  const dialog = React.useRef<HTMLDivElement>(null);
  // Focus stays inside while it's open (it moves in again when the content changes title),
  // Escape closes it, and focus goes back to whatever opened it.
  useFocusTrap(dialog, { onEscape: props.onClose, contentKey: props.title });
  // Rendered at the end of <body> so it never inherits styles from where it was opened.
  return createPortal(
    <div className="scrim" onClick={props.onClose}>
      <div ref={dialog} tabIndex={-1} className="sheet" role="dialog" aria-modal="true" aria-label={props.title} onClick={(e) => e.stopPropagation()}>
        <div className="spread">
          <h2 className="h2">{props.title}</h2>
          <button type="button" className="btn ghost" onClick={props.onClose}>
            Close
          </button>
        </div>
        {props.children}
      </div>
    </div>,
    document.body,
  );
}

/** The RepCurve mark: a rising curve. RepCurve Test shows it with the colours swapped. */
export function CurveMark(props: { size?: number }): React.ReactElement {
  const s = props.size ?? 28;
  const [tile, curve] = IS_TEST ? ["var(--card)", "var(--accent)"] : ["var(--accent)", "var(--accent-ink)"];
  return (
    <svg width={s} height={s} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="0.5" y="0.5" width="31" height="31" rx="8.5" fill={tile} stroke={IS_TEST ? "var(--accent)" : tile} strokeWidth="1" />
      <path d="M6 24 C 12 23, 15 19, 17 15 S 22 8, 26 7" fill="none" stroke={curve} strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export const ICONS = {
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
  rope: "M4.5 3h3v6h-3zM16.5 3h3v6h-3zM6 9c0 12 12 12 12 0",
  gym: "M3 10v4M6 8v8M18 8v8M21 10v4M6 12h12",
  pairs: "M5 8v8M9 8v8M15 8v8M19 8v8M5 12h4M15 12h4",
  core: "M12 4v16M7 8h10M7 16h10M9 12h6",
  barbell: "M2 12h20M5 8v8M8 6v12M16 6v12M19 8v8",
  cable: "M5 3v18M5 5h9l4 4M18 9v6M16 15h4M5 21h4",
  machine: "M5 3v18h14M9 7h6v10H9zM9 10h6M9 13h6",
  bike: "M6 14a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM18 14a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 17l4-7h6l2 7M10 10l-1-3h-2M16 10l-1-4h2",
  rower: "M3 18h18M6 18v-3M18 18v-3M8 13l6-4 5 1M14 9a1.5 1.5 0 1 0 0-.01",
  stairs: "M4 20h5v-4h4v-4h4V8h3",
  elliptical: "M5 18a7 3 0 0 0 14 0 7 3 0 0 0-14 0M8 18 10 5M10 5h4",
  anchor: "M4 4h6v16H4zM10 12h4c2 0 3 2 6 2M18 12l2 2-2 2",
  slider: "M4 15a4 2 0 0 0 7 0 4 2 0 0 0-7 0M13 15a4 2 0 0 0 7 0 4 2 0 0 0-7 0M7 13V9M17 13V9",
  suspension: "M12 3v5M12 8l-5 9M12 8l5 9M5 17h4M15 17h4",
  // Day emblems: press up into a bar, pull a bar down, a star jump, head and shoulders, hips and legs
  push: "M5 3v4M19 3v4M5 5h14M12 21V8M8 12l4-4 4 4",
  pull: "M4 4h16M8 4v6M16 4v6M12 8v12M8.5 16.5 12 20l3.5-3.5",
  fullBody: "M14 4.5a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM12 7.5v7M4 7l8 4 8-4M7 21l5-6.5 5 6.5",
  upper: "M14 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM4 20v-5a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v5M9 20v-4M15 20v-4",
  lower: "M6 4h12M7 4 6 12l1.5 7M17 4l1 8-1.5 7M11 4l-.5 8 .5 7M13 4l.5 8-.5 7M4 20h7M13 20h7",
  pause: "M8 5v14M16 5v14",
  play: "M7 5v14l11-7z",
} as const;

export type IconName = keyof typeof ICONS;

/** Line icons; the Pixel Press style shows the pixel versions instead (see pixel.css). */
export function Icon(props: { name: IconName; size?: number; strokeWidth?: number }): React.ReactElement {
  const s = props.size ?? 22;
  return (
    <>
      <svg className="icon-line" width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={props.strokeWidth ?? 1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={ICONS[props.name]} />
      </svg>
      <svg className="icon-pixel" width={s} height={s} viewBox="0 0 12 12" fill="currentColor" shapeRendering="crispEdges" aria-hidden="true">
        <path d={PIXEL_ICONS[props.name]} />
      </svg>
    </>
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
