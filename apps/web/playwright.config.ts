import { defineConfig, devices } from "@playwright/test";

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
  },
  webServer: {
    command: "pnpm exec vite preview --port 4173 --strictPort --host 127.0.0.1",
    url: "http://127.0.0.1:4173",
    // Locally reuse a running preview; in CI always start our own so tests never hit another server.
    reuseExistingServer: !process.env["CI"],
    timeout: 60_000,
  },
});
