import { describe, expect, it } from "vitest";
import { exportBackup, parseBackup } from "./backup";
import { EMPTY_DATA } from "./types";

describe("backups", () => {
  it("round-trips", () => {
    const text = exportBackup(EMPTY_DATA, 0);
    const r = parseBackup(text);
    expect(r.ok).toBe(true);
  });
  it("rejects other JSON and garbage with a clear message", () => {
    expect(parseBackup("{}")).toEqual({ ok: false, error: "That isn't a RepCurve backup file." });
    expect(parseBackup("nope").ok).toBe(false);
  });
});
