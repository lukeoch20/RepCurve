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

## Putting it on your iPhone

1. Host it (below). With GitHub Pages the address is `https://<your-github-username>.github.io/RepCurve/`.
2. Open that address in **Safari** on the iPhone (other iPhone browsers can't add web apps to the home screen as reliably).
3. Tap **Share**, then **Add to Home Screen**, then **Add**. The welcome screen shows the same steps.
4. Open RepCurve from the new icon and set up there, not in the Safari tab: the home-screen app keeps its own saved data, separate from Safari, and iOS doesn't clear it when you go a while without using it.
5. Coming from the claude.ai version? Export a backup there (Settings → Export backup), then use **Restore from a backup** on the welcome screen.

Updates arrive on their own: when a new version is published, the app shows "Update now" (never during a workout).

## RepCurve Test: try features before they ship

A second copy of the app, **RepCurve Test**, lives beside the real one so new features can be tried on the phone first.

| | RepCurve | RepCurve Test |
|---|---|---|
| Address | `https://lukeoch20.github.io/RepCurve/` | `https://lukeoch20.github.io/RepCurve/test/` |
| Built from | `main` | the `test` branch |
| Icon | white curve on green | green curve on white |
| Data | its own | its own (database `repcurve-test`), never touches the real app's |

How a feature ships:

1. It's merged into `test` first. The deploy publishes both apps on every push to `main` or `test`.
2. You try it in RepCurve Test. To try it with your real history, export a backup from RepCurve and restore it into RepCurve Test.
3. When it's good, `test` is merged into `main` and the real app offers "Update now".

Locally, `pnpm build:web` builds both (`dist/` and `dist/test/`); `pnpm --filter @repcurve/web build:test` builds only the test app. The real app's offline worker is told never to answer for `/test/`; the e2e test `test-channel.spec.ts` fails if that ever breaks.

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
