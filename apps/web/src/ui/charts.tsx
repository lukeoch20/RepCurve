import React, { useState } from "react";

/**
 * Small, quiet charts in one accent: hairline solid grid, 2px lines, ringed end dots,
 * a 10% wash under the line, a crosshair readout on touch, and a hidden table for screen readers.
 */

export interface Pt {
  x: number;
  y: number;
  /** Readout text for this point, e.g. "142 lb · 3 Oct". */
  label: string;
}

export interface BandPt {
  x: number;
  lo: number;
  mid: number;
  hi: number;
  label: string;
}

const W = 320;

function niceTicks(lo: number, hi: number, count = 4): number[] {
  if (hi - lo < 1e-9) {
    lo -= 1;
    hi += 1;
  }
  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  // The first tick sits at or below the data, the last at or above it.
  const first = Math.floor(lo / step) * step;
  const last = Math.ceil(hi / step - 1e-9) * step;
  const out: number[] = [];
  for (let v = first; v <= last + step * 0.001; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
}

const fmt = (v: number) => (Math.abs(v) >= 100 ? String(Math.round(v)) : String(Math.round(v * 10) / 10));

/** A trend line of observed values, optionally continued by a projected median with its range. */
export function TrendChart(props: {
  title: string;
  points: Pt[];
  band?: BandPt[];
  xTicks: { x: number; label: string }[];
  height?: number;
  unit?: string;
  /** Wash under the observed line (off when a projection follows it). */
  wash?: boolean;
}): React.ReactElement {
  const { points, band = [] } = props;
  const wash = props.wash ?? band.length === 0;
  const H = props.height ?? 168;
  const pad = { l: 34, r: 12, t: 26, b: 22 };
  const [hover, setHover] = useState<number | null>(null);

  const xs = [...points.map((p) => p.x), ...band.map((b) => b.x), ...props.xTicks.map((t) => t.x)];
  const ys = [...points.map((p) => p.y), ...band.flatMap((b) => [b.lo, b.hi])];
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const span = Math.max(...ys) - Math.min(...ys);
  const ticks = niceTicks(Math.min(...ys) - span * 0.08, Math.max(...ys) + span * 0.08);
  const y0 = ticks[0]!;
  const y1 = ticks[ticks.length - 1]!;
  const sx = (x: number) => pad.l + (x1 === x0 ? 0.5 : (x - x0) / (x1 - x0)) * (W - pad.l - pad.r);
  const sy = (y: number) => H - pad.b - ((y - y0) / (y1 - y0 || 1)) * (H - pad.t - pad.b);

  const line = (pts: { x: number; y: number }[]) => pts.map((p, i) => `${i ? "L" : "M"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ");
  const area = wash && points.length > 1 ? `${line(points)} L${sx(points[points.length - 1]!.x).toFixed(1)},${H - pad.b} L${sx(points[0]!.x).toFixed(1)},${H - pad.b} Z` : "";
  const bandPath =
    band.length > 1
      ? `${band.map((b, i) => `${i ? "L" : "M"}${sx(b.x).toFixed(1)},${sy(b.hi).toFixed(1)}`).join(" ")} ${[...band]
          .reverse()
          .map((b) => `L${sx(b.x).toFixed(1)},${sy(b.lo).toFixed(1)}`)
          .join(" ")} Z`
      : "";

  // Everything the crosshair can land on, observed first then projected.
  const targets = [...points.map((p) => ({ x: p.x, y: p.y, label: p.label })), ...band.slice(points.length ? 1 : 0).map((b) => ({ x: b.x, y: b.mid, label: b.label }))];
  const last = points[points.length - 1];
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const fx = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    targets.forEach((t, i) => {
      if (Math.abs(sx(t.x) - fx) < Math.abs(sx(targets[best]!.x) - fx)) best = i;
    });
    setHover(best);
  };
  const shown = hover !== null ? targets[hover] : null;

  return (
    <div className="chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={props.title}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={sy(t)} y2={sy(t)} stroke="var(--line)" strokeWidth="1" />
            <text className="axis" x={pad.l - 6} y={sy(t) + 3} textAnchor="end">{fmt(t)}</text>
          </g>
        ))}
        {props.xTicks.map((t, i) => (
          <text key={i} className="axis" x={sx(t.x)} y={H - 6} textAnchor={i === 0 ? "start" : i === props.xTicks.length - 1 ? "end" : "middle"}>
            {t.label}
          </text>
        ))}
        {bandPath ? <path d={bandPath} fill="color-mix(in srgb, var(--chart) 16%, transparent)" /> : null}
        {band.length > 1 ? <path d={line(band.map((b) => ({ x: b.x, y: b.mid })))} fill="none" stroke="var(--chart)" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" /> : null}
        {area ? <path d={area} fill="var(--chart-wash)" /> : null}
        {points.length > 1 ? <path d={line(points)} fill="none" stroke="var(--chart)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /> : null}
        {points.length <= 12 && band.length === 0
          ? points.slice(0, -1).map((p, i) => <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="3" fill="var(--chart)" stroke="var(--card)" strokeWidth="2" />)
          : null}
        {band.length > 1
          ? band.slice(1).map((b, i) => <circle key={`b${i}`} cx={sx(b.x)} cy={sy(b.mid)} r="3" fill="var(--card)" stroke="var(--chart)" strokeWidth="2" />)
          : null}
        {last ? (
          <>
            <circle cx={sx(last.x)} cy={sy(last.y)} r="5" fill="var(--chart)" stroke="var(--card)" strokeWidth="2" />
            <EndLabel x={sx(last.x)} y={sy(last.y)} text={`${fmt(last.y)}${props.unit ? ` ${props.unit}` : ""}`} />
          </>
        ) : null}
        {shown ? <line x1={sx(shown.x)} x2={sx(shown.x)} y1={pad.t - 6} y2={H - pad.b} stroke="var(--muted)" strokeWidth="1" /> : null}
        {shown ? <circle cx={sx(shown.x)} cy={sy(shown.y)} r="5" fill="var(--chart)" stroke="var(--card)" strokeWidth="2" /> : null}
      </svg>
      {shown ? (
        <span className="chart-tip" style={{ left: `${(sx(shown.x) / W) * 100}%` }} aria-hidden="true">
          {shown.label}
        </span>
      ) : null}
      <table className="chart-table">
        <caption>{props.title}</caption>
        <tbody>
          {targets.map((t, i) => (
            <tr key={i}>
              <td>{t.label}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A value pill above a point, kept inside the plot. */
function EndLabel(props: { x: number; y: number; text: string }): React.ReactElement {
  const w = props.text.length * 6.2 + 14;
  const x = Math.min(W - w - 2, Math.max(2, props.x - w / 2));
  const y = Math.max(2, props.y - 26);
  return (
    <g aria-hidden="true">
      <rect x={x} y={y} width={w} height="18" rx="9" fill="var(--accent)" />
      <text x={x + w / 2} y={y + 12.5} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="var(--accent-ink)">
        {props.text}
      </text>
    </g>
  );
}

/** Columns of shares (0–1), e.g. sessions done out of planned, per week. */
export function ShareBars(props: { title: string; bars: { label: string; value: number; tip: string }[]; height?: number }): React.ReactElement {
  const H = props.height ?? 132;
  const pad = { l: 34, r: 8, t: 8, b: 20 };
  const n = Math.max(1, props.bars.length);
  const slot = (W - pad.l - pad.r) / n;
  const bw = Math.min(18, Math.max(4, slot - 2));
  const sy = (v: number) => H - pad.b - v * (H - pad.t - pad.b);
  const [hover, setHover] = useState<number | null>(null);
  const every = Math.ceil(n / 6);
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={props.title} onPointerLeave={() => setHover(null)}>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={sy(t)} y2={sy(t)} stroke="var(--line)" strokeWidth="1" />
            <text className="axis" x={pad.l - 6} y={sy(t) + 3} textAnchor="end">{t * 100}%</text>
          </g>
        ))}
        {props.bars.map((b, i) => {
          const cx = pad.l + slot * i + slot / 2;
          const h = Math.max(0, H - pad.b - sy(Math.min(1, b.value)));
          const r = Math.min(4, h / 2, bw / 2);
          const x = cx - bw / 2;
          const top = H - pad.b - h;
          // Rounded data end, square at the baseline.
          const d = h > 0 ? `M${x},${H - pad.b} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${H - pad.b} Z` : "";
          return (
            <g key={i} onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)}>
              <rect x={pad.l + slot * i} y={pad.t} width={slot} height={H - pad.t - pad.b} fill="transparent" />
              {d ? <path d={d} fill="var(--chart)" opacity={hover === null || hover === i ? 1 : 0.45} /> : null}
              {i % every === 0 ? (
                <text className="axis" x={cx} y={H - 5} textAnchor="middle">{b.label}</text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {hover !== null && props.bars[hover] ? (
        <span className="chart-tip" style={{ left: `${((pad.l + slot * hover + slot / 2) / W) * 100}%` }} aria-hidden="true">
          {props.bars[hover]!.tip}
        </span>
      ) : null}
      <table className="chart-table">
        <caption>{props.title}</caption>
        <tbody>
          {props.bars.map((b, i) => (
            <tr key={i}>
              <td>{b.tip}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
