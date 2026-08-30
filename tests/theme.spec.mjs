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
