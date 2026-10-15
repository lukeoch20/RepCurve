import type { LookId } from "../platform/style";
import type { Badge } from "./gamify";

/**
 * Looks as rewards. Bluebird and Classic are free; each other look opens with whichever of its
 * routes comes first: showing up, getting stronger or staying consistent. Every route is a badge,
 * so it's all worked out from the history and nothing new is stored, apart from the looks this
 * device keeps open for good (the one in use when this arrived, and any used or earned since).
 */

export interface Route {
  badgeId: string;
  /** e.g. "10 workouts" */
  label: string;
  /** How far there is to go, e.g. "3 to go". */
  left: (have: number, need: number) => string;
}

const toGo = (have: number, need: number) => `${need - have} to go`;
const weeksToGo = (have: number, need: number) => `${need - have} ${need - have === 1 ? "week" : "weeks"} to go`;
const levelsToGo = (have: number, need: number) => `${need - have} ${need - have === 1 ? "level" : "levels"} to go`;

/** The looks to earn, lowest first. A look gets its routes when it's built (look 3 has none yet). */
export const LADDER: readonly { id: Exclude<LookId, "bluebird" | "classic">; name: string; routes: Route[] }[] = [
  {
    id: "forge",
    name: "Fired Forge",
    routes: [
      { badgeId: "workouts-10", label: "10 workouts", left: toGo },
      { badgeId: "firsts-2", label: "a personal record and a harder version of a move", left: (have) => `${have} of 2 done` },
      { badgeId: "streak-4", label: "a 4-week streak", left: weeksToGo },
    ],
  },
  {
    id: "pixel",
    name: "Pixel Press",
    routes: [
      { badgeId: "workouts-25", label: "25 workouts", left: toGo },
      { badgeId: "level-5", label: "level 5 on any lift", left: levelsToGo },
      { badgeId: "week-3", label: "every planned session in a week, 3 times", left: toGo },
    ],
  },
  {
    id: "gold",
    name: "Gold Plated",
    routes: [
      { badgeId: "workouts-100", label: "100 workouts", left: toGo },
      { badgeId: "records-50", label: "50 personal records", left: toGo },
      { badgeId: "streak-26", label: "half a year of weekly training", left: weeksToGo },
    ],
  },
  {
    id: "diamond",
    name: "Cut Like a Diamond",
    routes: [
      { badgeId: "workouts-250", label: "250 workouts", left: toGo },
      { badgeId: "level-15", label: "level 15 on any lift", left: levelsToGo },
      { badgeId: "streak-52", label: "a whole year of weekly training", left: weeksToGo },
      { badgeId: "return-5", label: "coming back after a week off, 5 times", left: toGo },
    ],
  },
];

export const FREE_LOOKS: readonly LookId[] = ["bluebird", "classic"];

export interface LookStatus {
  id: LookId;
  /** Free, earned through a route, or kept on this device. */
  earned: boolean;
  /** Can be put on: earned, or anything in the test app. */
  open: boolean;
  /** The route badge that opened it first, if one did. */
  openedBy: Badge | null;
  routes: { route: Route; badge: Badge }[];
}

/** Where each look stands. `allOpen` is the test app, where every look can be tried. */
export function lookStatuses(all: Badge[], kept: ReadonlySet<LookId>, allOpen: boolean): Map<LookId, LookStatus> {
  const byId = new Map(all.map((b) => [b.id, b]));
  const out = new Map<LookId, LookStatus>();
  for (const id of FREE_LOOKS) out.set(id, { id, earned: true, open: true, openedBy: null, routes: [] });
  for (const look of LADDER) {
    const routes = look.routes.flatMap((route) => {
      const badge = byId.get(route.badgeId);
      return badge ? [{ route, badge }] : [];
    });
    const openedBy = routes.map((r) => r.badge).filter((b) => b.earned).sort((a, b) => a.earned!.at - b.earned!.at)[0] ?? null;
    const earned = openedBy !== null || kept.has(look.id);
    out.set(look.id, { id: look.id, earned, open: earned || allOpen, openedBy, routes });
  }
  return out;
}

/** "10 workouts (3 to go), … or a 4-week streak (2 weeks to go)" */
export function routesText(s: LookStatus): string {
  const parts = s.routes.map(({ route, badge }) => (badge.progress ? `${route.label} (${route.left(badge.progress.have, badge.progress.need)})` : route.label));
  return parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} or ${parts[parts.length - 1]}`;
}

/** The route closest to done, as a share of the way there. */
export function closest(s: LookStatus): { route: Route; badge: Badge; share: number } | null {
  let best: { route: Route; badge: Badge; share: number } | null = null;
  for (const r of s.routes) {
    const share = r.badge.progress ? r.badge.progress.have / r.badge.progress.need : 1;
    if (!best || share > best.share) best = { ...r, share };
  }
  return best;
}

/** The lowest look not yet earned. */
export function nextLook(statuses: Map<LookId, LookStatus>): (LookStatus & { name: string }) | null {
  const look = LADDER.find((l) => !statuses.get(l.id)!.earned);
  return look ? { ...statuses.get(look.id)!, name: look.name } : null;
}

/** Looks this session opened: its badges were the first route there, and the look wasn't already kept here. */
export function lookUnlocks(sessionId: string, all: Badge[], kept: ReadonlySet<LookId>): { id: LookId; name: string }[] {
  const statuses = lookStatuses(all, new Set(), false);
  return LADDER.filter((l) => !kept.has(l.id) && statuses.get(l.id)!.openedBy?.earned?.sessionId === sessionId).map((l) => ({ id: l.id, name: l.name }));
}
