import { test, expect } from "@playwright/test";
import { PAGE_URL } from "./helpers.mjs";

test("#themeBtn toggles data-theme between light and dark", async ({ page }) => {
  let before;
  await test.step("Given a fresh load of the site", async () => {
    await page.goto(PAGE_URL, { waitUntil: "networkidle" });
    before = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    expect(["light", "dark"]).toContain(before);
  });
  await test.step("When #themeBtn is clicked", async () => {
    await page.locator("#themeBtn").click();
  });
  await test.step("Then data-theme flips to the other value", async () => {
    const after = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    expect(after).not.toEqual(before);
    expect(["light", "dark"]).toContain(after);
  });
});

test("the theme-color meta tag tracks the active theme, not just OS preference", async ({ page }) => {
  await test.step("Given a fresh load of the site", async () => {
    await page.goto(PAGE_URL, { waitUntil: "networkidle" });
  });
  await test.step("When the theme is toggled to dark", async () => {
    const theme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    if (theme !== "dark") await page.locator("#themeBtn").click();
  });
  await test.step("Then theme-color matches the dark --canvas token", async () => {
    const content = await page.locator('meta[name="theme-color"]').getAttribute("content");
    expect(content.toLowerCase()).toBe("#05060a");
  });
  await test.step("When the theme is toggled back to light", async () => {
    await page.locator("#themeBtn").click();
  });
  await test.step("Then theme-color matches the light --canvas token", async () => {
    const content = await page.locator('meta[name="theme-color"]').getAttribute("content");
    expect(content.toLowerCase()).toBe("#eef0f4");
  });
});
