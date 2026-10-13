/**
 * Workout reminders without a server: a calendar file with one repeating event on the chosen
 * weekdays. The phone's own calendar does the reminding, alarm included, and the person can move
 * or delete it there like any other event.
 */

export interface Reminders {
  /** Weekdays to train, 0 = Sunday … 6 = Saturday. */
  days: number[];
  /** Local time of day, "HH:MM". */
  time: string;
}

const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Weekdays spread through the week for a number of days, starting Monday. */
export function suggestedDays(daysPerWeek: number): number[] {
  const byCount: Record<number, number[]> = {
    1: [1],
    2: [1, 4],
    3: [1, 3, 5],
    4: [1, 2, 4, 5],
    5: [1, 2, 3, 4, 5],
    6: [1, 2, 3, 4, 5, 6],
    7: [0, 1, 2, 3, 4, 5, 6],
  };
  return byCount[Math.min(7, Math.max(1, Math.round(daysPerWeek)))]!;
}

export const DEFAULT_REMINDER_TIME = "07:00";

export function validTime(t: unknown): t is string {
  return typeof t === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}

const pad = (n: number) => String(n).padStart(2, "0");
/** Local date and time with no zone ("floating"), so the event stays at the same clock time wherever the phone is. */
const floating = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const escapeText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

/** The first chosen weekday at the chosen time that's still ahead of `now`. */
export function firstOccurrence(r: Reminders, now: Date): Date {
  const [h, m] = r.time.split(":").map(Number) as [number, number];
  for (let i = 0; i < 8; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, h, m);
    if (r.days.includes(d.getDay()) && d.getTime() > now.getTime()) return d;
  }
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, h, m);
}

/** An iCalendar file (RFC 5545) with one weekly event on the chosen days and an alarm at its start. */
export function remindersCalendar(r: Reminders, minutes: number, appUrl: string, now: Date): string {
  const days = [...new Set(r.days)].filter((d) => d >= 0 && d <= 6).sort();
  const start = firstOccurrence({ ...r, days }, now);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//RepCurve//Workout reminders//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    // A fixed id: adding the file again updates the same event instead of making a second one.
    "UID:workout-reminders@repcurve",
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${floating(start)}`,
    `DURATION:PT${Math.max(5, Math.round(minutes))}M`,
    `RRULE:FREQ=WEEKLY;BYDAY=${days.map((d) => BYDAY[d]).join(",")}`,
    `SUMMARY:${escapeText("RepCurve workout")}`,
    `DESCRIPTION:${escapeText(`About ${Math.round(minutes)} minutes. Open RepCurve for today's session: ${appUrl}`)}`,
    `URL:${appUrl}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText("Time for your RepCurve workout")}`,
    "TRIGGER:PT0M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** Lines longer than 75 octets continue on the next line after a space (RFC 5545 §3.1). */
function fold(line: string): string {
  const bytes = new TextEncoder();
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    const limit = out.length === 0 ? 75 : 74;
    if (bytes.encode(cur + ch).length > limit) {
      out.push(cur);
      cur = "";
    }
    cur += ch;
  }
  out.push(cur);
  return out.join("\r\n ");
}
