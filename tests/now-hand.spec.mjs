import { test, expect } from "@playwright/test";
import { PAGE_URL, samplePixel } from "./helpers.mjs";

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

test("a solid faded line points from centre to the outer rim at the exact current time", async ({ page }) => {
  let angle;
  await test.step("Given a fresh load of the site", async () => {
    await page.goto(PAGE_URL, { waitUntil: "networkidle" });
    angle = await expectedHandAngle(page);
  });
  await test.step("Then a translucent line is drawn near the centre at that angle", async () => {
    const onHand = await samplePixel(page, 50, angle);
    expect(onHand.a).toBeGreaterThan(20);
    // faded, not a solid opaque overlay colour and not the #5EBBFC selection colour
    expect(onHand.a).toBeLessThan(200);
  });
  await test.step("And nothing is drawn 90deg away at the same radius", async () => {
    const offHand = await samplePixel(page, 50, angle + 90);
    expect(offHand.a).toBe(0);
  });
});
