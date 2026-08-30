import { test, expect } from "@playwright/test";
import { PAGE_URL } from "./helpers.mjs";

test("page does not scroll on load", async ({ page }) => {
  await test.step("Given a fresh load of the site", async () => {
    await page.goto(PAGE_URL, { waitUntil: "networkidle" });
  });
  await test.step("Then the document does not overflow its viewport", async () => {
    const { scrollHeight, clientHeight } = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    }));
    expect(scrollHeight).toBeLessThanOrEqual(clientHeight + 1);
  });
});

test("the dial card never extends outside the stage-wrap", async ({ page }) => {
  await test.step("Given a fresh load of the site", async () => {
    await page.goto(PAGE_URL, { waitUntil: "networkidle" });
  });
  await test.step("Then .dial-card's box is fully contained within .stage-wrap's box", async () => {
    const cardBox = await page.locator(".dial-card").boundingBox();
    const wrapBox = await page.locator(".stage-wrap").boundingBox();
    const tol = 0.5;
    expect(cardBox.x).toBeGreaterThanOrEqual(wrapBox.x - tol);
    expect(cardBox.y).toBeGreaterThanOrEqual(wrapBox.y - tol);
    expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(wrapBox.x + wrapBox.width + tol);
    expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(wrapBox.y + wrapBox.height + tol);
  });
});

test("the old sort-toggle element is permanently gone", async ({ page }) => {
  await test.step("Given a fresh load of the site", async () => {
    await page.goto(PAGE_URL, { waitUntil: "networkidle" });
  });
  await test.step("Then no element with id seg exists", async () => {
    await expect(page.locator("#seg")).toHaveCount(0);
  });
});

test("the old continents icon element is permanently gone", async ({ page }) => {
  await test.step("Given a fresh load of the site", async () => {
    await page.goto(PAGE_URL, { waitUntil: "networkidle" });
  });
  await test.step("Then no element with class ic-continents exists", async () => {
    await expect(page.locator(".ic-continents")).toHaveCount(0);
  });
});
