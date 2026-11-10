import type { BrowserContext, Page } from "@playwright/test";

/**
 * Run before the first page opens. tsx keeps function names with a helper, __name, that the
 * functions sent into the page still call; the page needs its own.
 */
export async function preparePage(context: BrowserContext): Promise<void> {
  await context.addInitScript({ content: "globalThis.__name = globalThis.__name || ((f) => f);" });
}

/**
 * What a simulated person "sees": the page as text in reading order, with every control they can
 * use tagged [e1], [e2]… so they can say which one to tap. Tags are set on the elements as
 * data-sim-ref and renewed on every look, so only the latest screen's tags work.
 */
export async function snapshot(page: Page, maxChars = 10000): Promise<string> {
  const body = await page.evaluate(() => {
    const INTERACTIVE = "button, a[href], input:not([type=hidden]), textarea, select, summary, [role=button], [role=switch], [role=tab], [role=link], [role=checkbox], [role=radio], [role=menuitem], [role=option], [role=slider]";
    const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
    const clip = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
    const visible = (el: Element) => {
      if (el.closest("[aria-hidden=true], [inert]")) return false;
      const box = el.getBoundingClientRect();
      if (box.width === 0 && box.height === 0 && getComputedStyle(el).display !== "contents") return false;
      return el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
    };
    const labelled = (el: Element) => {
      const by = el.getAttribute("aria-labelledby");
      if (by) return clean(by.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? "").join(" "));
      return "";
    };
    const nameOf = (el: Element) => {
      const aria = clean(el.getAttribute("aria-label")) || labelled(el);
      if (aria) return aria;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
        const label = [...(el.labels ?? [])].map((l) => clean(l.textContent)).join(" ");
        return label || clean(el.getAttribute("placeholder")) || clean(el.getAttribute("title"));
      }
      return clean((el as HTMLElement).innerText) || clean(el.getAttribute("title")) || clean(el.querySelector("img, svg")?.getAttribute("aria-label"));
    };
    const roleOf = (el: Element) => {
      const role = el.getAttribute("role");
      if (role) return role;
      const tag = el.tagName.toLowerCase();
      if (tag === "a") return "link";
      if (tag === "summary") return "disclosure";
      if (tag === "select") return "select";
      if (tag === "textarea") return "text area";
      if (el instanceof HTMLInputElement) {
        if (el.type === "checkbox") return "checkbox";
        if (el.type === "radio") return "radio";
        if (el.type === "range") return "slider";
        if (el.type === "file") return "file picker";
        if (el.type === "number" || el.inputMode === "numeric" || el.inputMode === "decimal") return "number field";
        return "text field";
      }
      return tag;
    };
    const statesOf = (el: Element) => {
      const out: string[] = [];
      const a = (n: string) => el.getAttribute(n);
      if (a("aria-pressed") === "true" || a("aria-selected") === "true") out.push("selected");
      if (a("aria-checked") !== null || (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio"))) {
        const on = a("aria-checked") === "true" || (el instanceof HTMLInputElement && el.checked);
        out.push(roleOf(el) === "switch" ? (on ? "on" : "off") : on ? "checked" : "unchecked");
      }
      if (a("aria-expanded") !== null) out.push(a("aria-expanded") === "true" ? "expanded" : "collapsed");
      if (el.tagName === "SUMMARY") out.push((el.parentElement as HTMLDetailsElement | null)?.open ? "expanded" : "collapsed");
      if (a("aria-current") && a("aria-current") !== "false") out.push("current");
      if ((el as HTMLButtonElement).disabled || a("aria-disabled") === "true") out.push("disabled");
      if (a("aria-invalid") === "true") out.push("invalid");
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        if (el.type !== "checkbox" && el.type !== "radio") out.push(el.value ? `value "${clip(el.value, 60)}"` : "empty");
      }
      if (el instanceof HTMLSelectElement) {
        out.push(`chosen "${clean(el.selectedOptions[0]?.textContent)}"`);
        out.push(`options: ${[...el.options].map((o) => clean(o.textContent)).join(" | ")}`);
      }
      return out;
    };

    document.querySelectorAll("[data-sim-ref]").forEach((el) => el.removeAttribute("data-sim-ref"));
    // With a modal open, only it can be used.
    const dialogs = [...document.querySelectorAll("dialog:modal, [aria-modal=true]")].filter(visible);
    const root = (dialogs[dialogs.length - 1] as HTMLElement | undefined) ?? document.body;

    const lines: string[] = [];
    let line = "";
    let n = 0;
    const flush = () => {
      const t = clean(line);
      if (t) lines.push(t);
      line = "";
    };
    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        line += ` ${node.textContent ?? ""}`;
        return;
      }
      if (!(node instanceof Element)) return;
      const tag = node.tagName.toLowerCase();
      if (tag === "script" || tag === "style" || tag === "template" || tag === "noscript") return;
      if (!visible(node)) return;
      if (node.matches(INTERACTIVE)) {
        flush();
        const ref = `e${++n}`;
        node.setAttribute("data-sim-ref", ref);
        const states = statesOf(node);
        lines.push(`[${ref}] ${roleOf(node)} "${clip(nameOf(node))}"${states.length ? ` (${states.join(", ")})` : ""}`);
        return;
      }
      if (/^h[1-6]$/.test(tag)) {
        flush();
        lines.push(`${"#".repeat(Number(tag[1]))} ${clean((node as HTMLElement).innerText)}`);
        return;
      }
      if ((tag === "img" || tag === "svg" || node.getAttribute("role") === "img") && (node.getAttribute("aria-label") || node.getAttribute("alt"))) {
        line += ` (picture: ${clean(node.getAttribute("aria-label") || node.getAttribute("alt"))})`;
        return;
      }
      if (tag === "svg") return;
      // A field's label is already its name.
      if (node instanceof HTMLLabelElement && node.control && visible(node.control)) return;
      const block = !getComputedStyle(node).display.startsWith("inline");
      if (block) flush();
      node.childNodes.forEach(walk);
      if (block) flush();
    };
    walk(root);
    flush();
    const title = clean(root.getAttribute("aria-label")) || labelled(root);
    const where = root === document.body ? "" : `A pop-up${title ? ` ("${title}")` : ""} is open; only it can be used until it's closed.\n`;
    return `${where}${lines.join("\n")}`;
  });
  return body.length > maxChars ? `${body.slice(0, maxChars)}\n… (the rest of this long page is cut off here)` : body;
}

/** Outcome of an action, in words for the simulated person. */
export type Acted = { ok: true; text: string } | { ok: false; text: string };

const target = (page: Page, ref: string) => page.locator(`[data-sim-ref="${ref.replace(/[^a-z0-9]/gi, "")}"]`);

export async function tap(page: Page, ref: string): Promise<Acted> {
  const el = target(page, ref);
  if ((await el.count()) === 0) return { ok: false, text: `There's no ${ref} on the screen now. Use the tags from the latest screen.` };
  try {
    await el.click({ timeout: 4000 });
    return { ok: true, text: `Tapped ${ref}.` };
  } catch (e) {
    return { ok: false, text: `Couldn't tap ${ref}: ${(e as Error).message.split("\n")[0]}` };
  }
}

export async function type(page: Page, ref: string, text: string): Promise<Acted> {
  const el = target(page, ref);
  if ((await el.count()) === 0) return { ok: false, text: `There's no ${ref} on the screen now. Use the tags from the latest screen.` };
  try {
    const tag = await el.evaluate((n) => n.tagName);
    if (tag === "SELECT") await el.selectOption({ label: text }, { timeout: 4000 });
    else await el.fill(text, { timeout: 4000 });
    return { ok: true, text: `Entered "${text}" in ${ref}.` };
  } catch (e) {
    return { ok: false, text: `Couldn't enter text in ${ref}: ${(e as Error).message.split("\n")[0]}` };
  }
}

/** Lets the page's own time pass (timers, rest countdowns), then lets it settle. */
export async function pass(page: Page, ms: number): Promise<void> {
  await page.clock.runFor(Math.round(ms));
  await page.waitForTimeout(150);
}

/** The instant a wall-clock time falls on in a time zone, as ms since the epoch. */
export function wallClock(day: string, hour: number, minute: number, timeZone: string): number {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const guess = Date.UTC(y, m - 1, d, hour, minute);
  const first = guess - zoneOffset(guess, timeZone);
  // Once more in case the first guess landed across a daylight-saving change.
  return guess - zoneOffset(first, timeZone);
}

function zoneOffset(t: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(t));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - (t - (t % 1000));
}

/** "Monday, November 2, 2026, 7:05 AM" in the person's time zone. */
export function describeTime(t: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(t));
}

/** What the app has stored on the phone: workouts saved, skipped, and the profile's main facts. */
export async function appStats(page: Page, prefix = "repcurve-test"): Promise<{ workouts: number; skipped: number; minutes: number; setUp: boolean }> {
  return page.evaluate(async (dbName) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(dbName);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (!db.objectStoreNames.contains("data")) return { workouts: 0, skipped: 0, minutes: 0, setUp: false };
    const all = await new Promise<{ keys: IDBValidKey[]; values: unknown[] }>((resolve, reject) => {
      const store = db.transaction("data").objectStore("data");
      const keys = store.getAllKeys();
      const values = store.getAll();
      values.onsuccess = () => resolve({ keys: keys.result, values: values.result });
      values.onerror = () => reject(values.error);
    });
    db.close();
    let workouts = 0;
    let skipped = 0;
    let minutes = 0;
    all.keys.forEach((k, i) => {
      if (typeof k !== "string" || !k.startsWith("record:")) return;
      const r = all.values[i] as { skipped?: boolean; activeMinutes?: number };
      if (r.skipped) skipped++;
      else {
        workouts++;
        minutes += r.activeMinutes ?? 0;
      }
    });
    return { workouts, skipped, minutes: Math.round(minutes), setUp: all.keys.includes("core") };
  }, prefix);
}
