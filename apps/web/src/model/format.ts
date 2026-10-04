import { displayLoad, formatLoad } from "@repcurve/shared";
import type { LoadType, Rir, Units } from "@repcurve/shared";

export const EFFORT_OPTIONS: { rir: Rir; label: string; hint: string }[] = [
  { rir: 4, label: "Easy", hint: "4 or more reps left" },
  { rir: 3, label: "3 left", hint: "Could do 3 more" },
  { rir: 2, label: "2 left", hint: "Could do 2 more" },
  { rir: 1, label: "1 left", hint: "Maybe 1 more" },
  { rir: 0, label: "Max", hint: "Nothing left" },
];

export function effortLabel(rir: Rir): string {
  return EFFORT_OPTIONS.find((o) => o.rir === rir)?.label ?? `${rir} left`;
}

export function clock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function loadText(loadKg: number | null, loadType: LoadType, units: Units): string {
  return formatLoad(loadKg, loadType, units);
}

export function loadNumber(loadKg: number, units: Units): string {
  return String(displayLoad(loadKg, units));
}

export function repsUnit(loadType: LoadType): string {
  return loadType === "time" ? "s" : "reps";
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function dayLabel(t: number, now: number): string {
  const d = new Date(t);
  const today = new Date(now);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(today) - startOf(d)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
