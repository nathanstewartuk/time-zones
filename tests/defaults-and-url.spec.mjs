import { test, expect } from "@playwright/test";
import { PAGE_URL, urlWith } from "./helpers.mjs";

test("no query params load the London/Sydney default", async ({ page }) => {
  await test.step("Given the site is opened with no query params", async () => {
    await page.goto(PAGE_URL, { waitUntil: "networkidle" });
  });
  await test.step("Then the selects default to London and Sydney", async () => {
    await expect(page.locator("#selLeft")).toHaveValue("Europe/London");
    await expect(page.locator("#selRight")).toHaveValue("Australia/Sydney");
  });
});

test("valid tz1/tz2 query params load exactly those zones", async ({ page }) => {
  await test.step("Given the site is opened with tz1=America/New_York&tz2=Asia/Tokyo", async () => {
    await page.goto(urlWith({ tz1: "America/New_York", tz2: "Asia/Tokyo" }), { waitUntil: "networkidle" });
  });
  await test.step("Then the selects load with exactly those values", async () => {
    await expect(page.locator("#selLeft")).toHaveValue("America/New_York");
    await expect(page.locator("#selRight")).toHaveValue("Asia/Tokyo");
  });
});

test("an invalid tz1 falls back to the London/Sydney default", async ({ page }) => {
  await test.step("Given the site is opened with an unknown tz1", async () => {
    await page.goto(urlWith({ tz1: "Not/AZone", tz2: "Asia/Tokyo" }), { waitUntil: "networkidle" });
  });
  await test.step("Then both selects fall back to the default pair", async () => {
    await expect(page.locator("#selLeft")).toHaveValue("Europe/London");
    await expect(page.locator("#selRight")).toHaveValue("Australia/Sydney");
  });
});

test("changing a select updates the URL query string", async ({ page }) => {
  await test.step("Given a fresh load of the site", async () => {
    await page.goto(PAGE_URL, { waitUntil: "networkidle" });
  });
  await test.step("When the left select is changed to Asia/Tokyo", async () => {
    await page.locator("#selLeft").selectOption("Asia/Tokyo");
  });
  await test.step("Then the URL reflects tz1=Asia/Tokyo and tz2=Australia/Sydney", async () => {
    const search = await page.evaluate(() => location.search);
    expect(search).toContain("tz1=Asia%2FTokyo");
    expect(search).toContain("tz2=Australia%2FSydney");
  });
});
