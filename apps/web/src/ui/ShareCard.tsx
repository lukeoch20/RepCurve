import React, { useEffect, useState } from "react";
import type { ShareCard } from "../model/share";
import { APP_NAME } from "../platform/channel";
import { canShareFile, shareOrSaveFile } from "../platform/download";
import { Sheet } from "./common";

const SIZE = 1080;

/** The current look's colours and fonts, read from the page so the card wears whatever look is on. */
function lookTokens(): Record<"bg" | "card" | "ink" | "muted" | "line" | "accent" | "accentInk" | "chart" | "chrome" | "chromeInk" | "display" | "body", string> {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  const accent = v("--accent") || "#1e5b3b";
  const accentInk = v("--accent-ink") || "#ffffff";
  return {
    bg: v("--bg") || "#f4f5f2",
    card: v("--card") || "#ffffff",
    ink: v("--ink") || "#161a17",
    muted: v("--muted") || "#6a726c",
    line: v("--line") || "#e3e6e1",
    accent,
    accentInk,
    chart: v("--chart") || accent,
    // Classic has no header band of its own: the band is its accent.
    chrome: v("--chrome") || accent,
    chromeInk: v("--chrome") ? v("--chrome-ink") || accentInk : accentInk,
    display: v("--font-display") || "Georgia, serif",
    body: v("--font-body") || "system-ui, sans-serif",
  };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draws the card: a header band with the app's name, the curve or weekly bars, and the totals. */
export function drawShareCard(card: ShareCard, canvas: HTMLCanvasElement): void {
  const t = lookTokens();
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const pad = 60;
  const inner = SIZE - pad * 2;
  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // The card and its header band.
  ctx.save();
  roundRect(ctx, pad, pad, inner, inner, 28);
  ctx.fillStyle = t.card;
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = t.chrome;
  ctx.fillRect(pad, pad, inner, 130);
  ctx.restore();
  roundRect(ctx, pad, pad, inner, inner, 28);
  ctx.strokeStyle = t.line;
  ctx.lineWidth = 3;
  ctx.stroke();

  // The rising-curve mark and the name.
  ctx.strokeStyle = t.chromeInk;
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(pad + 50, pad + 92);
  ctx.bezierCurveTo(pad + 80, pad + 90, pad + 92, pad + 70, pad + 100, pad + 58);
  ctx.bezierCurveTo(pad + 108, pad + 46, pad + 118, pad + 36, pad + 136, pad + 34);
  ctx.stroke();
  ctx.fillStyle = t.chromeInk;
  ctx.font = `700 56px ${t.display}`;
  ctx.textBaseline = "middle";
  ctx.fillText(APP_NAME, pad + 166, pad + 66);

  const left = pad + 60;
  const right = SIZE - pad - 60;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = t.ink;
  ctx.font = `600 54px ${t.display}`;
  ctx.fillText(card.heading, left, pad + 230, right - left);
  ctx.fillStyle = t.muted;
  ctx.font = `400 34px ${t.body}`;
  ctx.fillText(card.subheading, left, pad + 285, right - left);
  if (card.big) {
    ctx.fillStyle = t.chart;
    ctx.font = `700 96px ${t.body}`;
    ctx.textAlign = "right";
    ctx.fillText(card.big, right, pad + 270);
    ctx.textAlign = "left";
  }

  // The chart.
  const top = pad + 340;
  const bottom = pad + 690;
  ctx.strokeStyle = t.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left, bottom);
  ctx.lineTo(right, bottom);
  ctx.stroke();
  if (card.line && card.line.length > 0) {
    const lo = Math.min(...card.line);
    const hi = Math.max(...card.line);
    const span = hi - lo || 1;
    const x = (i: number) => (card.line!.length === 1 ? (left + right) / 2 : left + ((right - left) * i) / (card.line!.length - 1));
    const y = (v: number) => (hi === lo ? (top + bottom) / 2 : bottom - 20 - ((bottom - top - 40) * (v - lo)) / span);
    ctx.beginPath();
    card.line.forEach((v, i) => (i === 0 ? ctx.moveTo(x(i), y(v)) : ctx.lineTo(x(i), y(v))));
    ctx.lineTo(x(card.line.length - 1), bottom);
    ctx.lineTo(x(0), bottom);
    ctx.closePath();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = t.chart;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    card.line.forEach((v, i) => (i === 0 ? ctx.moveTo(x(i), y(v)) : ctx.lineTo(x(i), y(v))));
    ctx.strokeStyle = t.chart;
    ctx.lineWidth = 9;
    ctx.lineJoin = "round";
    ctx.stroke();
    const last = card.line.length - 1;
    ctx.beginPath();
    ctx.arc(x(last), y(card.line[last]!), 16, 0, Math.PI * 2);
    ctx.fillStyle = t.chart;
    ctx.fill();
  } else if (card.bars && card.bars.length > 0) {
    const max = Math.max(1, ...card.bars);
    const slot = (right - left) / card.bars.length;
    ctx.fillStyle = t.chart;
    card.bars.forEach((n, i) => {
      const h = ((bottom - top - 20) * n) / max;
      if (h > 0) ctx.fillRect(left + i * slot + slot * 0.15, bottom - h, slot * 0.7, h);
    });
  }

  // The totals.
  const col = (right - left) / card.stats.length;
  card.stats.forEach((s, i) => {
    ctx.fillStyle = t.ink;
    ctx.font = `700 72px ${t.body}`;
    ctx.fillText(s.value, left + i * col, pad + 810, col - 20);
    ctx.fillStyle = t.muted;
    ctx.font = `400 32px ${t.body}`;
    ctx.fillText(s.label, left + i * col, pad + 860, col - 20);
  });
}

/** Waits (briefly) for the look's fonts, so the card isn't drawn in a fallback. */
async function fontsReady(): Promise<void> {
  try {
    const t = lookTokens();
    await Promise.race([
      Promise.all([document.fonts.load(`700 56px ${t.display}`, APP_NAME), document.fonts.load(`700 72px ${t.body}`, "0123456789")]),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch {
    // draw with what's there
  }
}

/** The card as a PNG file. */
export async function shareCardFile(card: ShareCard): Promise<File | null> {
  await fontsReady();
  const canvas = document.createElement("canvas");
  drawShareCard(card, canvas);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  return blob ? new File([blob], `repcurve-progress-${new Date().toISOString().slice(0, 10)}.png`, { type: "image/png" }) : null;
}

/** The card ready to share: a preview, then the share sheet (or a download) from a tap. */
export function ShareSheet(props: { card: ShareCard; onClose: () => void }): React.ReactElement {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let gone = false;
    let made: string | null = null;
    void shareCardFile(props.card).then((f) => {
      if (gone) return;
      if (!f) {
        setMsg("Couldn't make the picture on this device.");
        return;
      }
      made = URL.createObjectURL(f);
      setFile(f);
      setUrl(made);
    });
    return () => {
      gone = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [props.card]);
  const share = async () => {
    if (!file) return;
    const r = await shareOrSaveFile(file, `My ${APP_NAME} progress`);
    if (r === "downloaded") setMsg("Picture saved to your downloads.");
    else if (r === "failed") setMsg("Couldn't share it here. Press and hold the picture to save it.");
    else if (r === "saved") props.onClose();
  };
  return (
    <Sheet title="Share your progress" onClose={props.onClose}>
      {url ? <img className="share-preview" src={url} alt={`${props.card.heading}: ${props.card.subheading}${props.card.big ? `, ${props.card.big}` : ""}`} /> : <p className="meta">Making the picture…</p>}
      <p className="meta small">Just the numbers you see here: nothing else about you.</p>
      {msg ? <p className="meta small" role="status">{msg}</p> : null}
      <button type="button" className="btn primary big" disabled={!file} onClick={() => void share()}>
        {file && canShareFile(file) ? "Share" : "Save picture"}
      </button>
    </Sheet>
  );
}
