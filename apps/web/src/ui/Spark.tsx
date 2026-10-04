import React, { useState } from "react";

export interface SparkPoint {
  x: number;
  y: number;
  label: string;
}

/** A small single-series trend line with an emphasised latest value and a tap/hover readout. */
export function Spark(props: { points: SparkPoint[]; width?: number; height?: number; title: string }): React.ReactElement | null {
  const { points } = props;
  const w = props.width ?? 132;
  const h = props.height ?? 44;
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0) return null;
  const pad = 6;
  const ys = points.map((p) => p.y);
  let lo = Math.min(...ys);
  let hi = Math.max(...ys);
  if (hi - lo < 1e-6) {
    lo -= 1;
    hi += 1;
  }
  const sx = (i: number) => (points.length === 1 ? w - pad : pad + (i * (w - 2 * pad)) / (points.length - 1));
  const sy = (y: number) => h - pad - ((y - lo) / (hi - lo)) * (h - 2 * pad);
  const d = points.map((p, i) => `${i ? "L" : "M"}${sx(i).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ");
  const last = points.length - 1;
  const shown = hover ?? last;
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const fx = ((e.clientX - r.left) / r.width) * w;
    let best = 0;
    points.forEach((_, i) => {
      if (Math.abs(sx(i) - fx) < Math.abs(sx(best) - fx)) best = i;
    });
    setHover(best);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={`${props.title}: ${points[0]!.label} to ${points[last]!.label}`}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
        style={{ touchAction: "pan-y", cursor: "crosshair" }}
      >
        <line x1={pad} x2={w - pad} y1={h - pad} y2={h - pad} stroke="var(--seam)" strokeWidth="1" />
        <path d={d} fill="none" stroke="var(--cobalt)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {hover !== null ? <line x1={sx(hover)} x2={sx(hover)} y1={pad / 2} y2={h - pad} stroke="var(--graphite)" strokeWidth="1" strokeDasharray="2 2" /> : null}
        <circle cx={sx(shown)} cy={sy(points[shown]!.y)} r="4.5" fill="var(--cobalt)" stroke="var(--sheet)" strokeWidth="2" />
      </svg>
      <span className="meta small num spark-label" aria-live="polite">{points[shown]!.label}</span>
    </div>
  );
}
