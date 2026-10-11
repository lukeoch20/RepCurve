import { describe, expect, it } from "vitest";
import { nextTip, TIPS, type TipId } from "./tips";

const all = new Set<TipId>(TIPS.map((t) => t.id));

describe("tutorial tips", () => {
  it("come in tutorial order, skipping ones already seen", () => {
    expect(nextTip(all, new Set(), false)).toBe("today.welcome");
    expect(nextTip(all, new Set(["today.welcome"]), false)).toBe("today.week");
  });

  it("only show for something on screen", () => {
    expect(nextTip(new Set<TipId>(["run.switch", "run.rest"]), new Set(), false)).toBe("run.switch");
    expect(nextTip(new Set<TipId>(), new Set(), false)).toBeNull();
  });

  it("stop when turned off or all seen", () => {
    expect(nextTip(all, new Set(), true)).toBeNull();
    expect(nextTip(all, new Set(TIPS.map((t) => t.id)), false)).toBeNull();
  });

  it("have unique ids and short, plain text", () => {
    expect(new Set(TIPS.map((t) => t.id)).size).toBe(TIPS.length);
    for (const t of TIPS) {
      expect(t.title.length).toBeLessThanOrEqual(40);
      // Fits a phone card without scrolling.
      expect(t.body.length).toBeLessThanOrEqual(240);
    }
  });
});
