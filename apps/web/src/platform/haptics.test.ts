import { beforeEach, describe, expect, it } from "vitest";
import { carriesTick, haptic, PULSE, setHaptics, tapPulse, ticksFor, TICKS } from "./haptics";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1";
const IPAD = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Safari/605.1.15";
const PIXEL = "Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36";

/** Records what would have been sent to the phone's vibration motor. */
function motor(): { sent: unknown[]; vibrate: (p: number | number[]) => void } {
  const sent: unknown[] = [];
  return { sent, vibrate: (p) => void sent.push(p) };
}

/** A tap: `during` is what the tap's own handlers do; the pulse is decided once they have run. */
function tap(m: ReturnType<typeof motor>, during: () => void = () => {}): void {
  let finish = (): void => {};
  tapPulse(
    (run) => {
      finish = run;
    },
    () => haptic("tap", m.vibrate),
  );
  during();
  finish();
}

beforeEach(() => setHaptics(true, null));

describe("which kind of tick a device gets", () => {
  it("vibrates wherever the Vibration API exists", () => {
    expect(ticksFor({ vibrate: true, switchControl: false, userAgent: PIXEL })).toBe("vibrate");
  });
  it("uses the switch on an iPhone that has the switch control", () => {
    expect(ticksFor({ vibrate: false, switchControl: true, userAgent: IPHONE })).toBe("switch");
  });
  it("does nothing on an older iPhone, an iPad or a Mac", () => {
    expect(ticksFor({ vibrate: false, switchControl: false, userAgent: IPHONE })).toBe("none");
    expect(ticksFor({ vibrate: false, switchControl: true, userAgent: IPAD })).toBe("none");
  });
  it("is nothing where there's no page at all", () => {
    expect(TICKS).toBe("none");
    expect(carriesTick(null)).toBe(false);
  });
});

describe("buzzes", () => {
  it("are short for a tap, longer for a set, and a pattern for a session", () => {
    const m = motor();
    haptic("tap", m.vibrate);
    haptic("set", m.vibrate);
    haptic("session", m.vibrate);
    expect(m.sent).toEqual([15, 30, [40, 70, 40, 70, 120]]);
    expect(PULSE.tap).toBeLessThan(PULSE.set as number);
  });
  it("stop when the setting is off, and the page is told so the tap labels hide", () => {
    const m = motor();
    const html = { dataset: {} as Record<string, string> };
    const doc = { documentElement: html } as unknown as Document;
    setHaptics(false, doc);
    expect(html.dataset["haptics"]).toBe("off");
    haptic("set", m.vibrate);
    tap(m);
    expect(m.sent).toEqual([]);
    setHaptics(true, doc);
    expect("haptics" in html.dataset).toBe(false);
    haptic("set", m.vibrate);
    expect(m.sent).toEqual([30]);
  });
  it("never throw, and do nothing where the phone can't", () => {
    expect(() =>
      haptic("set", () => {
        throw new Error("no motor");
      }),
    ).not.toThrow();
    expect(() => haptic("set", null)).not.toThrow();
    expect(() => haptic("set")).not.toThrow();
  });
});

describe("one tap, one buzz", () => {
  it("a tap that does nothing else gets the short pulse", () => {
    const m = motor();
    tap(m);
    expect(m.sent).toEqual([15]);
  });
  it("a tap that logs a set gets the set's buzz, not both", () => {
    const m = motor();
    tap(m, () => haptic("set", m.vibrate));
    expect(m.sent).toEqual([30]);
  });
  it("a buzz from before the tap doesn't swallow the tap's pulse", () => {
    const m = motor();
    haptic("session", m.vibrate);
    tap(m);
    expect(m.sent).toEqual([[40, 70, 40, 70, 120], 15]);
  });
  it("a label passing its click on to a checkbox is still one tap", () => {
    const m = motor();
    let finish = (): void => {};
    const after = (run: () => void): void => {
      finish = run;
    };
    const buzz = (): void => haptic("tap", m.vibrate);
    tapPulse(after, buzz); // the click on the label
    tapPulse(() => {
      throw new Error("the second click of the same tap must not be waited on");
    }, buzz); // the click it passes to the checkbox
    finish();
    expect(m.sent).toEqual([15]);
    tap(m);
    expect(m.sent).toEqual([15, 15]);
  });
});
