import { beforeEach, describe, expect, it, vi } from "vitest";

// The update state is module-wide, so each test gets a fresh copy of the module.
let update: typeof import("./update");
beforeEach(async () => {
  vi.resetModules();
  update = await import("./update");
});

describe("app updates", () => {
  it("wait for the person: a new version being ready reloads nothing by itself", () => {
    const reload = vi.fn(() => Promise.resolve());
    const heard = vi.fn();
    update.onUpdateReady(heard);
    expect(update.updateReady()).toBe(false);
    update.setUpdateReady(reload);
    expect(update.updateReady()).toBe(true);
    expect(heard).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
  });

  it("are never offered or applied while a session is under way", () => {
    const reload = vi.fn(() => Promise.resolve());
    update.setUpdateReady(reload);
    expect(update.updateOffered(true)).toBe(false);
    update.applyUpdate(true);
    expect(reload).not.toHaveBeenCalled();
    // Once the session is over, the button appears and works.
    expect(update.updateOffered(false)).toBe(true);
    update.applyUpdate(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("do nothing when there's no new version, and survive a failed reload", async () => {
    expect(update.updateOffered(false)).toBe(false);
    expect(() => update.applyUpdate()).not.toThrow();
    const failing = vi.fn(() => Promise.reject(new Error("offline")));
    update.setUpdateReady(failing);
    update.applyUpdate();
    await Promise.resolve();
    expect(failing).toHaveBeenCalledTimes(1);
    // Still ready: the button stays to try again.
    expect(update.updateOffered(false)).toBe(true);
  });

  it("stop telling a screen that has gone", () => {
    const heard = vi.fn();
    const stop = update.onUpdateReady(heard);
    stop();
    update.setUpdateReady(() => Promise.resolve());
    expect(heard).not.toHaveBeenCalled();
  });
});
