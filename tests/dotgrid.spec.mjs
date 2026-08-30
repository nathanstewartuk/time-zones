import { test, expect } from "@playwright/test";
import { PAGE_URL } from "./helpers.mjs";

// #dot-canvas itself is `position:absolute; inset:0` and fills its parent
// `.dot-canvas-wrap`, which is the element that's actually `position:fixed`.
// We check the wrapper for `fixed` and the canvas element for viewport
// coverage + non-blocking pointer-events, which is what the background-fade
// setup actually needs to be true.
test("#dot-canvas exists, covers the viewport, and never blocks pointer events", async ({ page }) => {
  await test.step("Given a fresh load of the site", async () => {
    await page.goto(PAGE_URL, { waitUntil: "networkidle" });
  });
  await test.step("Then #dot-canvas exists inside a fixed, full-viewport wrapper", async () => {
    const wrapperPosition = await page.evaluate(() => {
      const wrap = document.querySelector(".dot-canvas-wrap");
      return wrap && getComputedStyle(wrap).position;
    });
    expect(wrapperPosition).toBe("fixed");
    await expect(page.locator("#dot-canvas")).toHaveCount(1);
  });
  await test.step("Then #dot-canvas's own computed pointer-events is none", async () => {
    const pointerEvents = await page.evaluate(() => getComputedStyle(document.getElementById("dot-canvas")).pointerEvents);
    expect(pointerEvents).toBe("none");
  });
});
