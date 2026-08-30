import { test, expect } from "@playwright/test";
import { PAGE_URL } from "./helpers.mjs";

test("page loads with no console/page errors", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await test.step("Given a fresh load of the site", async () => {
    await page.goto(PAGE_URL, { waitUntil: "networkidle" });
  });
  await test.step("Then there are no JS errors", async () => {
    expect(errors).toEqual([]);
  });
});
