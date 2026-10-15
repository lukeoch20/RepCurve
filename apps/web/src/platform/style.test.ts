import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { FAMILIES, keepLooks, keptLooks, PREVIEWS, previewVars, saveStyle, STYLES, versionLike, type StyleId } from "./style";

/** Custom properties per selector in a stylesheet (later rules win, as in the browser). */
function tokens(file: string): Map<string, Record<string, string>> {
  const css = readFileSync(new URL(`../${file}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const out = new Map<string, Record<string, string>>();
  for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const props: Record<string, string> = {};
    for (const [, name, value] of body!.matchAll(/(--[a-z-]+)\s*:\s*([^;]+);/g)) props[name!] = value!.trim();
    const key = selector!.trim();
    out.set(key, { ...out.get(key), ...props });
  }
  return out;
}

/** The tokens a fixed version ends up with, cascading the base sheet and the look's own as the app loads them. */
function resolved(id: Exclude<StyleId, "classic">): Record<string, string> {
  const [family, theme] = id.split("-") as [string, "light" | "dark"];
  const base = tokens("styles.css");
  const layers = [base.get(":root"), theme === "dark" ? base.get(':root[data-theme="dark"]') : undefined];
  if (family !== "classic") {
    const own = tokens(`${family}.css`);
    layers.push(own.get(`:root[data-style="${family}"]`), theme === "dark" ? own.get(`:root[data-style="${family}"][data-theme="dark"]`) : undefined);
  }
  return Object.assign({}, ...layers.filter(Boolean));
}

describe("style previews", () => {
  const fixed = STYLES.map((s) => s.id).filter((id): id is Exclude<StyleId, "classic"> => id !== "classic");

  it("cover every fixed version", () => {
    expect(Object.keys(PREVIEWS).sort()).toEqual([...fixed].sort());
  });

  it("use each version's own colours and fonts, exactly as its stylesheet has them", () => {
    for (const id of fixed) {
      const real = resolved(id);
      for (const [name, value] of Object.entries(PREVIEWS[id].tokens)) expect(`${id} ${name}: ${value}`).toBe(`${id} ${name}: ${real[name]}`);
    }
  });

  it("paint with nothing borrowed from the active look", () => {
    for (const id of fixed) {
      const vars = previewVars(id);
      for (const [name, value] of Object.entries(vars)) {
        expect(value, `${id} ${name}`).toBeTruthy();
        expect(value, `${id} ${name}`).not.toMatch(/var\(|transparent/);
      }
    }
    expect(previewVars("forge-light")["--pv-button"]).toBe("#a43f15");
    expect(previewVars("bluebird-light")["--pv-button"]).toBe("linear-gradient(#34793d, #286b32)");
    expect(previewVars("classic-dark")["--pv-head"]).toBe("#161b18");
  });
});

describe("looks kept on this device", () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    globalThis.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    } as Storage;
  });

  it("keep the style in use when looks became rewards, recorded once", () => {
    store.set("repcurve.style", "pixel-dark");
    expect([...keptLooks()]).toEqual(["pixel"]);
    // Recorded: a later change of style doesn't move it.
    store.set("repcurve.style", "bluebird-light");
    expect([...keptLooks()]).toEqual(["pixel"]);
  });

  it("start with the default for someone who never chose a style", () => {
    expect([...keptLooks()]).toEqual(["bluebird"]);
  });

  it("add every look used or earned, and never drop one", () => {
    store.set("repcurve.style", "gold-light");
    saveStyle("forge-dark");
    keepLooks(["diamond"]);
    expect([...keptLooks()].sort()).toEqual(["diamond", "forge", "gold"]);
  });

  it("survive a garbled entry", () => {
    store.set("repcurve.looks-kept", '["forge","nope",3]');
    expect([...keptLooks()]).toEqual(["forge"]);
  });
});

describe("trying a look", () => {
  const forge = FAMILIES.find((f) => f.id === "forge")!;
  it("keeps light or dark as now", () => {
    expect(versionLike(forge, "bluebird-dark", false)).toBe("forge-dark");
    expect(versionLike(forge, "pixel-light", true)).toBe("forge-light");
    expect(versionLike(forge, "classic", true)).toBe("forge-dark");
    expect(versionLike(forge, "classic", false)).toBe("forge-light");
  });
});
