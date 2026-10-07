# RepCurve web app

The phone app: onboarding, today's session, the in-workout runner with set check-off and a rest timer, treadmill sessions, progress, and settings. It runs the `@repcurve/engine` package directly in the browser.

## Two ways to run it

| | Installable web app | claude.ai page |
|---|---|---|
| Build | `pnpm build:web` → `apps/web/dist` | `pnpm build:artifact` → `apps/web/artifact/repcurve.html` |
| Where data lives | On the device (IndexedDB) | Your Claude account, private to you, in the page's database |
| Offline | Yes, after the first visit | No |
| Install | Safari → Share → Add to Home Screen | Open the link; add a bookmark to the home screen |

The app picks its storage at start-up: inside claude.ai it uses the account database; anywhere else it uses the device. If it can't reach the expected store (or can only keep data in memory) it says so in a banner that stays up. Settings shows which one is active and can export or import a backup, so data can move between the two.

Saving is built to survive bad connections and multiple devices:
- A write that fails is kept and retried (on the next change, when the connection returns, and every 15 seconds); in claude.ai, unconfirmed writes are also kept in the browser and re-sent after a reload.
- The training record carries a revision. If another device saved first, this one doesn't overwrite it: it loads the newer version and says so. Coming back to the app (no session running) also picks up changes from another device. Use one device at a time for a workout.
- Restore writes the new data before removing the old, and reports any failure. On the device, restore is a single transaction.
- Stored and imported data is checked and migrated on load; anything the app can't use is dropped rather than crashing it, and if a screen still fails, a recovery screen offers a backup, a reload or starting over.
- The installed app updates only when you tap "Update now", never during a session. The claude.ai page bundles everything it runs; it loads no third-party scripts.

## Hosting the installable version

The repository is private, and GitHub Pages only serves private repositories on paid GitHub plans. Pick one:

1. **Make the repository public and turn on Pages** (free): Settings → General → Change visibility, then Settings → Pages → Source: *GitHub Actions*. The `Deploy web app` workflow then publishes every push to `main`.
2. **Keep it private on GitHub Pro or above**: just turn on Pages as above.
3. **Keep it private on a free plan**: connect the repo to Cloudflare Pages, Netlify or Vercel with build command `pnpm install && pnpm build:web` and output directory `apps/web/dist`.

Until Pages is on, the deploy workflow skips with a notice instead of failing.

## Developing

```sh
pnpm --filter @repcurve/web dev       # local dev server
pnpm build:web && pnpm e2e            # build, then browser tests on an iPhone-sized viewport
pnpm --filter @repcurve/web icons     # re-render the PNG icons from SVG
```
