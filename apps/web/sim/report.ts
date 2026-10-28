import { request, systemPrompt, type Create, type Ledger, type ModelConfig, type Note } from "./agent";
import type { Persona } from "./personas";

export interface VisitLog {
  visit: number;
  /** When it started, in the person's words and time zone. */
  at: string;
  /** Days since the first visit. */
  day: number;
  steps: number;
  /** Minutes that passed in the app during the visit. */
  minutes: number;
  endedBy: string;
  diary: string;
  screenshot: string;
}

export interface Interview {
  rating: number;
  would_keep_using: "yes" | "maybe" | "no";
  verdict: string;
  liked: string[];
  frustrations: { issue: string; severity: "minor" | "moderate" | "major"; where: string }[];
  confusing: string[];
  bugs: string[];
  wishes: string[];
  quote: string;
}

export interface PersonaRun {
  persona: Persona;
  visits: VisitLog[];
  notes: Note[];
  quit: string | null;
  stats: { workouts: number; skipped: number; minutes: number; setUp: boolean };
  /** What they sent through the app's own feedback form. */
  feedback: { username: string | null; message: string }[];
  /** Errors the page threw while they used it. */
  errors: string[];
  interview: Interview | null;
}

const list = { type: "array", items: { type: "string" } };
const INTERVIEW_SCHEMA = {
  type: "object",
  properties: {
    rating: { type: "integer", description: "1 (awful) to 10 (love it)" },
    would_keep_using: { type: "string", enum: ["yes", "maybe", "no"] },
    verdict: { type: "string", description: "Two or three sentences on whether RepCurve works for you and why." },
    liked: list,
    frustrations: {
      type: "array",
      items: {
        type: "object",
        properties: { issue: { type: "string" }, severity: { type: "string", enum: ["minor", "moderate", "major"] }, where: { type: "string", description: "The screen or moment" } },
        required: ["issue", "severity", "where"],
        additionalProperties: false,
      },
    },
    confusing: list,
    bugs: list,
    wishes: list,
    quote: { type: "string", description: "One sentence you'd say to a friend about RepCurve." },
  },
  required: ["rating", "would_keep_using", "verdict", "liked", "frustrations", "confusing", "bugs", "wishes", "quote"],
  additionalProperties: false,
};

function history(run: PersonaRun): string {
  const visits = run.visits.map((v) => `Visit ${v.visit} (${v.at}, ${v.minutes} min): ${v.diary}`).join("\n");
  const notes = run.notes.map((n) => `- visit ${n.visit}, ${n.kind}${n.screen ? ` on "${n.screen}"` : ""}: ${n.text}`).join("\n");
  return `Your visits:\n${visits || "(none)"}\n\nNotes you made along the way:\n${notes || "(none)"}${run.quit ? `\n\nYou stopped using the app: ${run.quit}` : ""}`;
}

/** The person's own view at the end, in a fixed shape. */
export async function interview(create: Create, ledger: Ledger, cfg: ModelConfig, run: PersonaRun): Promise<Interview | null> {
  const res = await create(
    request(cfg, cfg.reportEffort, {
      max_tokens: 8000,
      system: [{ type: "text", text: systemPrompt(run.persona), cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: `Your time trying RepCurve is over. Here's what you wrote down:\n\n${history(run)}\n\nNow the makers are interviewing you. Answer as ${run.persona.name}, honestly and specifically, from what you actually experienced. Point to screens and moments. Leave a list empty rather than padding it.`,
        },
      ],
      output_config: { format: { type: "json_schema", schema: INTERVIEW_SCHEMA } },
    }),
  );
  ledger.add(res);
  if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") return null;
  const text = res.content.find((b) => b.type === "text");
  try {
    return text && text.type === "text" ? (JSON.parse(text.text) as Interview) : null;
  } catch {
    return null;
  }
}

export interface RunMeta {
  started: string;
  model: string;
  effort: string;
  baseUrl: string;
  startDay: string;
  spent: number;
  calls: number;
  stoppedEarly: string | null;
}

/** Reads across everyone's experience for the issues that matter most. */
export async function synthesize(create: Create, ledger: Ledger, cfg: ModelConfig, runs: PersonaRun[]): Promise<string> {
  const data = runs.map((r) => ({
    persona: `${r.persona.name}: ${r.persona.summary}`,
    workouts_saved: r.stats.workouts,
    workouts_skipped: r.stats.skipped,
    quit: r.quit,
    visits: r.visits.map((v) => ({ visit: v.visit, day: v.day, minutes: v.minutes, ended_by: v.endedBy, diary: v.diary })),
    notes: r.notes,
    sent_in_app_feedback: r.feedback.map((f) => f.message),
    app_errors: r.errors,
    exit_interview: r.interview,
  }));
  const res = await create(
    request(cfg, cfg.reportEffort, {
      max_tokens: 16000,
      system:
        "You are a UX researcher writing up a usability study of RepCurve, a phone app for short strength workouts. The participants were simulated: AI personas using the real app in a browser over several weeks of fast-forwarded time. Write for the app's solo developer, who will decide what to fix next. Be concrete and evidence-led, quote participants, cite visit numbers, and never invent findings that aren't in the data. Treat findings as hypotheses to confirm with real people, and say when only one persona hit something.",
      messages: [
        {
          role: "user",
          content: `Study data (JSON):\n${JSON.stringify(data, null, 1)}\n\nWrite the report body in Markdown, starting at level-2 headings (the title is added separately):\n## Summary: 3 to 5 bullets.\n## Scorecard: a table with persona, rating /10, would keep using, workouts saved, one-line verdict.\n## Top issues: ranked by how much they'd cost real users. For each: a short title, severity, who hit it, evidence (quotes with visit numbers), and a suggested fix.\n## What worked\n## Confusing moments\n## Bugs and errors: include app errors from the data.\n## Next steps: a prioritized list of what to change or test.`,
        },
      ],
    }),
  );
  ledger.add(res);
  if (res.stop_reason === "refusal") return "_The model declined to write the summary. The per-persona sections below have the raw findings._";
  const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  return res.stop_reason === "max_tokens" ? `${text}\n\n_(The summary was cut off at its length limit.)_` : text;
}

const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ");

export function renderReport(meta: RunMeta, runs: PersonaRun[], synthesis: string): string {
  const out: string[] = [];
  out.push(`# RepCurve simulated users: ${meta.started.slice(0, 10)}`, "");
  out.push(
    `AI personas used the real app in a browser, with the app's clock fast-forwarded between visits. Treat what they found as leads to check with real people, not as user research.`,
    "",
    `- App: ${meta.baseUrl}`,
    `- Model: ${meta.model} (effort ${meta.effort}), ${meta.calls} requests, about $${meta.spent.toFixed(2)}`,
    `- Simulated from ${meta.startDay}; people: ${runs.map((r) => r.persona.name).join(", ")}`,
    ...(meta.stoppedEarly ? [`- Stopped early: ${meta.stoppedEarly}`] : []),
    "",
    synthesis,
    "",
    "---",
    "",
    "# Per person",
  );
  for (const r of runs) {
    const p = r.persona;
    out.push("", `## ${p.name}`, "", `${p.summary}. Saved ${r.stats.workouts} workout${r.stats.workouts === 1 ? "" : "s"} (${r.stats.minutes} active minutes), skipped ${r.stats.skipped}.${r.quit ? ` **Quit:** ${r.quit}` : ""}`, "");
    if (r.interview) {
      const i = r.interview;
      out.push(`**${i.rating}/10, would keep using: ${i.would_keep_using}.** ${i.verdict}`, "", `> ${i.quote}`, "");
      const section = (title: string, items: string[]) => (items.length ? out.push(`**${title}**`, "", ...items.map((x) => `- ${x}`), "") : 0);
      section("Liked", i.liked);
      section("Frustrations", i.frustrations.map((f) => `(${f.severity}) ${f.issue} _(${f.where})_`));
      section("Confusing", i.confusing);
      section("Bugs", i.bugs);
      section("Wishes", i.wishes);
    } else out.push("_No exit interview._", "");
    out.push("**Visits**", "", "| # | When | Minutes | Steps | Ended | Diary |", "|---|---|---|---|---|---|");
    for (const v of r.visits) out.push(`| [${v.visit}](${v.screenshot}) | ${cell(v.at)} | ${v.minutes} | ${v.steps} | ${v.endedBy} | ${cell(v.diary)} |`);
    out.push("");
    if (r.notes.length) {
      out.push("**Notes as they went**", "");
      for (const n of r.notes) out.push(`- visit ${n.visit}, _${n.kind}_${n.screen ? ` on "${n.screen}"` : ""}: ${n.text}`);
      out.push("");
    }
    if (r.feedback.length) out.push("**Sent through the app's feedback form**", "", ...r.feedback.map((f) => `- ${f.username ? `${f.username}: ` : ""}${f.message}`), "");
    if (r.errors.length) out.push("**App errors**", "", ...r.errors.map((e) => `- \`${cell(e)}\``), "");
  }
  return `${out.join("\n")}\n`;
}
