import { test, expect } from "@playwright/test";
import { PAGE_URL, samplePixel, INNER, OUTER } from "./helpers.mjs";

// mid-gap radius (see tests/hour-select.spec.mjs) - normally fully transparent, so it's a clean
// spot to check for the hand's line without the ring's own opaque colour band in the way.
const GAP_R = (INNER.rMid + INNER.w / 2 + OUTER.rMid - OUTER.w / 2) / 2;

// mirrors app.js's own drawNowHand() angle math exactly, computed in-page against the real
// system clock and the actual selected home zone, so the test never hardcodes a time.
async function expectedHandAngle(page) {
  return page.evaluate(() => {
    const offInner = window.tzOffsetMin(document.getElementById("selRight").value, new Date());
    const now = new Date();
    const norm = (m) => ((m % 1440) + 1440) % 1440;
    const mins = norm(now.getUTCHours() * 60 + now.getUTCMinutes() + now.getUTCSeconds() / 60 + offInner);
    return (mins / 60 / 24) * 360 - 180; // hourToAngle(mins/60)
  });
}

test("a solid line covers both rings at the exact current time, but not the hollow centre", async ({ page }) => {
  let angle;
  await test.step("Given a fresh load of the site", async () => {
    await page.goto(PAGE_URL, { waitUntil: "networkidle" });
    angle = await expectedHandAngle(page);
  });
  await test.step("Then a line is drawn in the gap between the rings at that angle", async () => {
    const onHand = await samplePixel(page, GAP_R, angle);
    expect(onHand.a).toBeGreaterThan(20);
  });
  await test.step("And nothing is drawn in the hollow centre, well inside the inner ring's own inner edge", async () => {
    const inHollow = await samplePixel(page, INNER.rMid - INNER.w / 2 - 20, angle);
    expect(inHollow.a).toBe(0);
  });
  await test.step("And nothing is drawn 90deg away at the same gap radius", async () => {
    const offHand = await samplePixel(page, GAP_R, angle + 90);
    expect(offHand.a).toBe(0);
  });
});
