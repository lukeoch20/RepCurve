import { describe, expect, it } from "vitest";
import { backupDue } from "./backupReminder";

const DAY = 86_400_000;
const T = Date.UTC(2026, 9, 1);
const sessions = (n: number, from = T) => Array.from({ length: n }, (_, i) => from + i * DAY);

describe("backup nudges for data kept only on this device", () => {
  it("first asks after the third session, not a month in", () => {
    expect(backupDue("device", sessions(2), T + 2 * DAY, null)).toBeNull();
    expect(backupDue("device", sessions(3), T + 3 * DAY, null)).toBe("first");
  });

  it("then asks after a month or twelve more sessions, whichever comes first", () => {
    const last = T + 3 * DAY;
    expect(backupDue("device", sessions(5), T + 10 * DAY, last)).toBeNull();
    expect(backupDue("device", sessions(5), last + 30 * DAY, last)).toBe("due");
    expect(backupDue("device", sessions(16), T + 16 * DAY, last)).toBe("due");
  });

  it("never asks when the data is kept in the person's Claude account", () => {
    expect(backupDue("claude", sessions(20), T + 90 * DAY, null)).toBeNull();
  });
});
