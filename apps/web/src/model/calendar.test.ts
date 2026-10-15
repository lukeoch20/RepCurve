import { describe, expect, it } from "vitest";
import { firstOccurrence, remindersCalendar, suggestedDays, validTime } from "./calendar";

describe("calendar reminders", () => {
  it("spreads training days through the week", () => {
    expect(suggestedDays(3)).toEqual([1, 3, 5]);
    expect(suggestedDays(4)).toEqual([1, 2, 4, 5]);
    expect(suggestedDays(9)).toHaveLength(7);
  });

  it("starts on the next chosen day that's still ahead", () => {
    // Tuesday 13 Oct 2026, 08:00 local.
    const tue8 = new Date(2026, 9, 13, 8, 0);
    expect(firstOccurrence({ days: [1, 3, 5], time: "07:00" }, tue8).getDay()).toBe(3);
    expect(firstOccurrence({ days: [2], time: "07:00" }, tue8).getDate()).toBe(20);
    expect(firstOccurrence({ days: [2], time: "18:30" }, tue8).getDate()).toBe(13);
  });

  it("writes one weekly event on the chosen days, with an alarm and a fixed id", () => {
    const ics = remindersCalendar({ days: [5, 1, 3], time: "07:00" }, 20, "https://example.com/app/", new Date(2026, 9, 13, 8, 0));
    expect(ics).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR\r\n");
    expect(ics).toContain("DTSTART:20261014T070000\r\n");
    expect(ics).toContain("DURATION:PT20M\r\n");
    expect(ics).toContain("BEGIN:VALARM");
    expect(ics).toContain("UID:workout-reminders@repcurve");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(ics.split("\r\n").every((l) => l.length <= 75)).toBe(true);
  });

  it("accepts only 24-hour times", () => {
    expect(validTime("07:00")).toBe(true);
    expect(validTime("7:00")).toBe(false);
    expect(validTime("24:00")).toBe(false);
  });
});
