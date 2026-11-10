/**
 * Simulated users: AI personas use RepCurve Test in a real browser over weeks of fast-forwarded
 * time, then say what they made of it. See sim/README.md.
 *
 *   pnpm --filter @repcurve/web sim --personas dana --visits 2
 */
import Anthropic from "@anthropic-ai/sdk";
import { chromium, devices, type Browser } from "@playwright/test";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { fakeBackend } from "../e2e/backend";
import { Ledger, runVisit, type Create, type ModelConfig, type Note } from "./agent";
import { appStats, describeTime, pass, preparePage, snapshot, wallClock } from "./observe";
import { PERSONAS, type Persona } from "./personas";
import { interview, renderReport, synthesize, type PersonaRun, type VisitLog } from "./report";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
type Effort = (typeof EFFORTS)[number];

const HELP = `Simulated users for RepCurve Test.

  pnpm --filter @repcurve/web sim [options]

  --personas <ids>     comma-separated: ${PERSONAS.map((p) => p.id).join(", ")} (default: all)
  --visits <n>         most visits per person (default 6)
  --days <n>           simulated days to cover (default 28)
  --steps <n>          most model turns per visit (default 60)
  --concurrency <n>    people using the app at once (default 2)
  --model <id>         default claude-opus-5-5 (or SIM_MODEL)
  --effort <level>     effort for steps in the app: low, medium, high, xhigh, max (default low)
  --report-effort <l>  effort for interviews and the report (default medium)
  --max-cost <usd>     stop starting visits near this spend (default 40)
  --start <date>       first simulated day, YYYY-MM-DD (default 2026-11-02, a Monday)
  --base-url <url>     the app (default http://127.0.0.1:4173/test/; built and served for you)
  --no-build           don't rebuild the test app first
  --no-fallbacks       don't send fallbacks: "default"
  --headed             show the browser
  --dry-run            no model calls: open the app as the first person and print what the model would be shown
  --help`;

const { values: args } = parseArgs({
  options: {
    personas: { type: "string" },
    visits: { type: "string", default: "6" },
    days: { type: "string", default: "28" },
    steps: { type: "string", default: "60" },
    concurrency: { type: "string", default: "2" },
    model: { type: "string", default: process.env["SIM_MODEL"] ?? "claude-opus-5-5" },
    effort: { type: "string", default: "low" },
    "report-effort": { type: "string", default: "medium" },
    "max-cost": { type: "string", default: "40" },
    start: { type: "string", default: "2026-11-02" },
    "base-url": { type: "string", default: "http://127.0.0.1:4173/test/" },
    "no-build": { type: "boolean", default: false },
    "no-fallbacks": { type: "boolean", default: false },
    headed: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
});

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function positive(name: string, value: string | undefined): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) fail(`--${name} needs a positive number.`);
  return n;
}

function effort(name: string, value: string | undefined): Effort {
  if (!EFFORTS.includes(value as Effort)) fail(`--${name} must be one of ${EFFORTS.join(", ")}.`);
  return value as Effort;
}

if (args.help) {
  console.log(HELP);
  process.exit(0);
}

const chosen = args.personas ? args.personas.split(",").map((s) => s.trim().toLowerCase()) : PERSONAS.map((p) => p.id);
const people = chosen.map((id) => PERSONAS.find((p) => p.id === id) ?? fail(`No persona "${id}". Try: ${PERSONAS.map((p) => p.id).join(", ")}`));
const opts = {
  visits: Math.round(positive("visits", args.visits)),
  days: Math.round(positive("days", args.days)),
  steps: Math.round(positive("steps", args.steps)),
  concurrency: Math.round(positive("concurrency", args.concurrency)),
  maxCost: positive("max-cost", args["max-cost"]),
  start: /^\d{4}-\d{2}-\d{2}$/.test(args.start ?? "") ? args.start! : fail("--start must look like 2026-11-02."),
  base: args["base-url"]!,
};
const cfg: ModelConfig = { model: args.model!, effort: effort("effort", args.effort), reportEffort: effort("report-effort", args["report-effort"]), fallbacks: !args["no-fallbacks"] };

if (!args["dry-run"] && !process.env["ANTHROPIC_API_KEY"]) {
  fail("ANTHROPIC_API_KEY isn't set. Add it to this environment (see sim/README.md), or try --dry-run to check the setup without calling the model.");
}

// ---------------------------------------------------------------- the app

const isLocal = (url: string) => ["127.0.0.1", "localhost"].includes(new URL(url).hostname);
const reachable = (url: string) =>
  fetch(url, { signal: AbortSignal.timeout(2000) })
    .then((r) => r.ok)
    .catch(() => false);

/** Builds RepCurve Test and serves it, unless it's already being served (or is elsewhere). */
async function startApp(base: string): Promise<ChildProcess | null> {
  if (isLocal(base) && !args["no-build"]) {
    console.log("Building RepCurve Test…");
    const built = spawnSync("pnpm", ["build:test"], { cwd: WEB, stdio: ["ignore", "ignore", "inherit"] });
    if (built.status !== 0) fail("The test build failed.");
  }
  if (await reachable(base)) return null;
  if (!isLocal(base)) fail(`Can't reach ${base}.`);
  if (!existsSync(join(WEB, "dist", "test", "index.html"))) fail("There's no test build. Run without --no-build, or: pnpm --filter @repcurve/web build:test");
  const u = new URL(base);
  const server = spawn(process.execPath, [join(WEB, "node_modules", "vite", "bin", "vite.js"), "preview", "--port", u.port || "4173", "--strictPort", "--host", u.hostname], { cwd: WEB, stdio: "ignore" });
  for (let i = 0; i < 60; i++) {
    if (await reachable(base)) return server;
    await new Promise((r) => setTimeout(r, 500));
  }
  server.kill();
  fail(`Started a preview server but ${base} didn't answer.`);
}

// ---------------------------------------------------------------- simulated time

function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** When the person opens the app on a given day: their usual time, a few minutes either way. */
function visitTime(p: Persona, start: string, day: number, visit: number): number {
  const date = addDays(start, day);
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const [h, m] = p.byWeekday?.[weekday] ?? p.usual;
  return wallClock(date, h, m + ((visit * 7) % 15), p.timeZone);
}

function opening(p: Persona, visit: number, when: string, day: number, prevDay: number | null, diary: VisitLog[], screen: string): string {
  const lines = [`It's ${when}.`];
  lines.push(visit === 1 ? "You've just opened RepCurve on your phone for the first time." : "You're opening RepCurve again.");
  if (prevDay !== null) for (const e of p.life) if (e.away && e.to < day && e.to >= prevDay) lines.push(`Since your last visit: ${e.text}`);
  for (const e of p.life) if (!e.away && day >= e.from && day <= e.to) lines.push(e.text);
  if (diary.length) lines.push("", "Your diary so far:", ...diary.map((v) => `- Visit ${v.visit}, ${v.at}: ${v.diary}`));
  lines.push("", `Screen:\n${screen}`);
  return lines.join("\n");
}

// ---------------------------------------------------------------- one person

let stopping: string | null = null;

async function simulate(browser: Browser, p: Persona, create: Create, ledger: Ledger, out: string): Promise<PersonaRun> {
  const { defaultBrowserType: _webkit, ...phone } = devices["iPhone 13"];
  const context = await browser.newContext({ ...phone, locale: "en-US", timezoneId: p.timeZone, serviceWorkers: "block", acceptDownloads: true });
  await preparePage(context);
  const origin = new URL(opts.base).origin;
  // Only the app itself loads: nothing else on the internet is touched.
  await context.route("**/*", (route) => (new URL(route.request().url()).origin === origin ? route.fallback() : route.abort("blockedbyclient")));
  const page = await context.newPage();
  // Usernames and feedback go to a stand-in for the backend, never the real one.
  const db = await fakeBackend(page);

  const run: PersonaRun = { persona: p, visits: [], notes: [] as Note[], quit: null, stats: { workouts: 0, skipped: 0, minutes: 0, setUp: false }, feedback: [], errors: [], interview: null };
  const events: string[] = [];
  let visit = 0;
  page.on("pageerror", (e) => run.errors.push(`visit ${visit}: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource|ERR_BLOCKED_BY_CLIENT/.test(m.text())) run.errors.push(`visit ${visit} (console): ${m.text().slice(0, 300)}`);
  });
  page.on("dialog", (d) => {
    // Leaving the page between visits isn't something the person sees.
    if (d.type() !== "beforeunload") events.push(`The phone showed a pop-up saying "${d.message()}", and you tapped OK`);
    void d.accept();
  });
  page.on("download", (d) => {
    const file = join(out, "downloads", `${p.id}-${d.suggestedFilename()}`);
    mkdirSync(dirname(file), { recursive: true });
    void d.saveAs(file).then(() => events.push(`Your phone saved a file called ${d.suggestedFilename()}`));
  });
  context.on("page", (other) => {
    if (other === page) return;
    events.push(`A link opened ${other.url()} in a new tab; you glance at it and come back to RepCurve`);
    void other.close();
  });

  const transcript = join(out, `${p.id}.jsonl`);
  const log = (entry: Record<string, unknown>) => appendFileSync(transcript, `${JSON.stringify({ t: new Date().toISOString(), ...entry })}\n`);
  const appNow = () => page.evaluate(() => Date.now());

  try {
    let day = 0;
    let prevDay: number | null = null;
    const first = visitTime(p, opts.start, 0, 1);
    await page.clock.install({ time: first - 1000 });
    // Paused: the app's time moves only as the person acts and waits, not while the model thinks.
    await page.clock.pauseAt(first);
    await page.goto(opts.base);
    for (visit = 1; visit <= opts.visits; visit++) {
      if (visit > 1) {
        await page.clock.fastForward(visitTime(p, opts.start, day, visit) - (await appNow()));
        await page.reload();
      }
      await pass(page, 1000);
      const began = await appNow();
      const when = describeTime(began, p.timeZone);
      const outcome = await runVisit({
        create,
        ledger,
        cfg,
        persona: p,
        page,
        visit,
        maxSteps: opts.steps,
        opening: opening(p, visit, when, day, prevDay, run.visits, await snapshot(page)),
        now: async () => describeTime(await appNow(), p.timeZone),
        events,
        notes: run.notes,
        log,
        stopping: () => stopping !== null,
      });
      const ended = await appNow();
      const shot = join("screens", `${p.id}-${String(visit).padStart(2, "0")}.png`);
      await page.screenshot({ path: join(out, shot) });
      const minutes = Math.round((ended - began) / 60000);
      run.visits.push({ visit, at: when, day, steps: outcome.steps, minutes, endedBy: outcome.endedBy, diary: outcome.diary, screenshot: shot });
      log({ type: "visit", visit, day, outcome });
      console.log(`[${p.name}] visit ${visit} · ${when} · ${outcome.steps} steps · ${minutes} min in the app · ended by ${outcome.endedBy} · $${ledger.spent.toFixed(2)} spent so far`);
      if (outcome.quit) {
        run.quit = outcome.quit;
        break;
      }
      if (stopping || ledger.over) break;

      let next = day + (outcome.comeBackInDays ?? p.rhythm);
      for (;;) {
        const away = p.life.find((e) => e.away && next >= e.from && next <= e.to);
        if (away) next = away.to + 1;
        // A visit that ran past the next one's usual time pushes it to the day after.
        else if (visitTime(p, opts.start, next, visit + 1) <= ended) next++;
        else break;
      }
      if (next > opts.days) break;
      prevDay = day;
      day = next;
    }
  } catch (e) {
    const message = (e as Error).message;
    run.errors.push(`harness: ${message}`);
    console.error(`[${p.name}] stopped: ${message}`);
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) stopping ??= `the API key was refused (${message})`;
  }

  run.stats = await appStats(page).catch(() => run.stats);
  run.feedback = db.feedback.map((f) => ({ username: f.username, message: f.message }));
  await context.close();
  if (!stopping?.startsWith("the API key") && run.visits.length) {
    run.interview = await interview(create, ledger, cfg, run).catch((e: Error) => {
      run.errors.push(`harness (interview): ${e.message}`);
      return null;
    });
  }
  return run;
}

async function pool<T, R>(items: T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]!);
      }
    }),
  );
  return results;
}

// ---------------------------------------------------------------- the run

async function dryRun(browser: Browser): Promise<void> {
  const p = people[0]!;
  const context = await browser.newContext({ ...(({ defaultBrowserType: _w, ...d }) => d)(devices["iPhone 13"]), locale: "en-US", timezoneId: p.timeZone, serviceWorkers: "block" });
  await preparePage(context);
  const page = await context.newPage();
  await fakeBackend(page);
  const first = visitTime(p, opts.start, 0, 1);
  await page.clock.install({ time: first - 1000 });
  await page.clock.pauseAt(first);
  await page.goto(opts.base);
  await pass(page, 1000);
  const when = describeTime(await page.evaluate(() => Date.now()), p.timeZone);
  console.log(`\nWhat ${p.name} is shown at the start of visit 1:\n\n${opening(p, 1, when, 0, null, [], await snapshot(page))}\n`);
  await context.close();
  console.log("Dry run: nothing was sent to the model. Set ANTHROPIC_API_KEY and leave out --dry-run to run it for real.");
}

async function main(): Promise<void> {
  const server = await startApp(opts.base);
  const browser = await chromium.launch({ headless: !args.headed });
  try {
    if (args["dry-run"]) return await dryRun(browser);

    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const out = join(WEB, "sim-runs", stamp);
    mkdirSync(join(out, "screens"), { recursive: true });
    const ledger = new Ledger(opts.maxCost, cfg.model);
    // Always the public API with the key given for this: hosted shells (Claude Code's cloud
    // sessions among them) can set ANTHROPIC_BASE_URL for their own use.
    const client = new Anthropic({ apiKey: process.env["ANTHROPIC_API_KEY"] ?? null, baseURL: process.env["SIM_API_URL"] ?? "https://api.anthropic.com", maxRetries: 4 });
    const create: Create = async (params) => {
      try {
        return await client.beta.messages.create(params);
      } catch (e) {
        // Not every model takes server-side fallbacks; carry on without them if this one doesn't.
        if (cfg.fallbacks && e instanceof Anthropic.BadRequestError && /fallback/i.test(e.message)) {
          cfg.fallbacks = false;
          console.warn(`${cfg.model} didn't accept fallbacks: "default", so the run carries on without them.`);
          const { fallbacks: _f, betas: _b, ...rest } = params;
          return client.beta.messages.create(rest);
        }
        throw e;
      }
    };
    process.on("SIGINT", () => {
      if (stopping) process.exit(130);
      stopping = "stopped by hand";
      console.log("\nStopping after the current step, then writing the report. Ctrl-C again to quit now.");
    });

    console.log(`Simulating ${people.map((p) => p.name).join(", ")}: up to ${opts.visits} visits each over ${opts.days} days, on ${cfg.model} (effort ${cfg.effort}). Budget $${opts.maxCost}.`);
    console.log(`Writing to ${relative(process.cwd(), out)}\n`);
    const runs = await pool(people, opts.concurrency, (p) => simulate(browser, p, create, ledger, out));

    if (ledger.over) stopping ??= `the budget of $${opts.maxCost} was reached`;
    console.log("\nWriting the report…");
    const synthesis = stopping?.startsWith("the API key") ? "_No summary: the API key was refused._" : await synthesize(create, ledger, cfg, runs).catch((e: Error) => `_The summary failed: ${e.message}_`);
    const meta = { started: stamp, model: cfg.model, effort: cfg.effort, baseUrl: opts.base, startDay: opts.start, spent: ledger.spent, calls: ledger.calls, stoppedEarly: stopping };
    writeFileSync(join(out, "report.md"), renderReport(meta, runs, synthesis));
    writeFileSync(join(out, "run.json"), JSON.stringify({ meta, tokens: ledger.tokens, runs }, null, 1));
    console.log(`\nDone: ${relative(process.cwd(), join(out, "report.md"))}`);
    console.log(`${ledger.calls} requests, about $${ledger.spent.toFixed(2)} (${(ledger.tokens.cacheRead / 1e6).toFixed(1)}M cached input tokens, ${(ledger.tokens.output / 1e6).toFixed(2)}M output tokens).`);
  } finally {
    await browser.close();
    server?.kill();
  }
}

await main();
