// no dev server (static site, no build step) - tests open index.html via file:// directly, see tests/helpers.js
import { devices } from "@playwright/test";

export default {
  testDir: "./tests",
  fullyParallel: true,
  reporter: [["list"]],
  use: { screenshot: "only-on-failure" },
  projects: [
    // iOS is the primary platform this site is built for - real WebKit engine + iPhone viewport/touch,
    // run first and treated as the source of truth for any conflict with desktop.
    { name: "ios-light", use: { ...devices["iPhone 14 Pro"], colorScheme: "light" } },
    { name: "ios-dark", use: { ...devices["iPhone 14 Pro"], colorScheme: "dark" } },
    // desktop web is secondary/regression-only - kept green, but iOS wins any behavioural disagreement.
    { name: "desktop-light", use: { ...devices["Desktop Chrome"], viewport: { width: 1200, height: 800 }, colorScheme: "light" } },
    { name: "desktop-dark", use: { ...devices["Desktop Chrome"], viewport: { width: 1200, height: 800 }, colorScheme: "dark" } },
  ],
};
