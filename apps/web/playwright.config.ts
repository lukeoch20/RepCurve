import { defineConfig, devices } from "@playwright/test";

// Tutorial tips and the pat on the back after each exercise are off in tests unless a test turns
// them on (e2e/tutorial.spec.ts, e2e/pat.spec.ts), so neither sits over what a test taps. Both
// apps' keys: RepCurve and RepCurve Test.
const TIPS_OFF = JSON.stringify({ off: true, seen: [] });

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    ...devices["iPhone 13"],
    browserName: "chromium",
    locale: "en-US",
    trace: "retain-on-failure",
    storageState: {
      cookies: [],
      origins: [
        {
          origin: "http://127.0.0.1:4173",
          localStorage: [
            { name: "repcurve.tips", value: TIPS_OFF },
            { name: "repcurve-test.tips", value: TIPS_OFF },
            { name: "repcurve.pats", value: "off" },
            { name: "repcurve-test.pats", value: "off" },
          ],
        },
      ],
    },
  },
  webServer: {
    command: "pnpm exec vite preview --port 4173 --strictPort --host 127.0.0.1",
    url: "http://127.0.0.1:4173",
    // Locally reuse a running preview; in CI always start our own so tests never hit another server.
    reuseExistingServer: !process.env["CI"],
    timeout: 60_000,
  },
});
