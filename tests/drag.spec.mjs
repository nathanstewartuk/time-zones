import { test, expect } from "@playwright/test";
import { urlWith, dialBox, dialPoint, OUTER } from "./helpers.mjs";

// drags the outer ring (grabbed at OUTER.rMid, well inside its radius band)
// from startAngleDeg through totalDeltaDeg of travel, via several
// intermediate mouse.move calls so the app's incremental angle tracking sees
// a real drag rather than a single jump.
async function dragOuterRing(page, startAngleDeg, totalDeltaDeg, steps = 5) {
  const box = await dialBox(page);
  const start = dialPoint(box, OUTER.rMid, startAngleDeg);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    const p = dialPoint(box, OUTER.rMid, startAngleDeg + (totalDeltaDeg * i) / steps);
    await page.mouse.move(p.x, p.y);
  }
  await page.mouse.up();
}

// mirrors app.js's own drop() nearest-zone search, run in-page against the
// site's own ZONES/tzOffsetMin so the expectation is computed the same way
// the app computes it, not re-derived by hand in the test.
function findBestZoneForOffset(page, targetOffset) {
  return page.evaluate((target) => {
    const now = new Date();
    let best = null, bestDiff = Infinity;
    window.ZONES.forEach((z) => {
      const off = window.tzOffsetMin(z.tz, now);
      const raw = Math.abs(off - target) % 1440;
      const diff = Math.min(raw, 1440 - raw);
      if (diff < bestDiff || (diff === bestDiff && best && z.city.localeCompare(best.city) < 0)) {
        best = z; bestDiff = diff;
      }
    });
    return best.tz;
  }, targetOffset);
}

// tz1/#selLeft = the outer, draggable ring. tz2/#selRight = the inner, fixed/home ring.

test("a 15deg clockwise drag moves tz1 one hour offset earlier", async ({ page }) => {
  let offBefore;
  await test.step("Given Tokyo/London are loaded (tz1=Tokyo outer, tz2=London home)", async () => {
    await page.goto(urlWith({ tz1: "Asia/Tokyo", tz2: "Europe/London" }), { waitUntil: "networkidle" });
    offBefore = await page.evaluate(() => window.tzOffsetMin(document.getElementById("selLeft").value, new Date()));
  });
  await test.step("When the outer ring is dragged 15deg clockwise", async () => {
    await dragOuterRing(page, 90, 15);
  });
  await test.step("Then #selLeft lands on the zone nearest offBefore-60min", async () => {
    const expectedTz = await findBestZoneForOffset(page, offBefore - 60);
    await expect(page.locator("#selLeft")).toHaveValue(expectedTz);
  });
});

test("dragging outward past the dataset's max offset (Kiritimati) wraps around", async ({ page }) => {
  await test.step("Given tz1 is Kiritimati (the dataset's highest UTC offset, on the outer/draggable ring)", async () => {
    await page.goto(urlWith({ tz1: "Pacific/Kiritimati", tz2: "Europe/London" }), { waitUntil: "networkidle" });
  });
  await test.step("When the outer ring is dragged 15deg counter-clockwise (further outward)", async () => {
    await dragOuterRing(page, 90, -15);
  });
  await test.step("Then #selLeft is no longer stuck on Kiritimati", async () => {
    await expect(page.locator("#selLeft")).not.toHaveValue("Pacific/Kiritimati");
  });
});

test("dragging outward past the dataset's min offset (Midway) wraps around", async ({ page }) => {
  await test.step("Given tz1 is Midway (the dataset's lowest UTC offset, on the outer/draggable ring)", async () => {
    await page.goto(urlWith({ tz1: "Pacific/Midway", tz2: "Europe/London" }), { waitUntil: "networkidle" });
  });
  await test.step("When the outer ring is dragged 15deg clockwise (further outward)", async () => {
    await dragOuterRing(page, 90, 15);
  });
  await test.step("Then #selLeft is no longer stuck on Midway", async () => {
    await expect(page.locator("#selLeft")).not.toHaveValue("Pacific/Midway");
  });
});

test("a drag on the outer ring updates the URL query string", async ({ page }) => {
  await test.step("Given Tokyo/London are loaded", async () => {
    await page.goto(urlWith({ tz1: "Asia/Tokyo", tz2: "Europe/London" }), { waitUntil: "networkidle" });
  });
  await test.step("When the outer ring is dragged 15deg clockwise", async () => {
    await dragOuterRing(page, 90, 15);
  });
  await test.step("Then location.search reflects the new tz1 value", async () => {
    const newTz1 = await page.locator("#selLeft").inputValue();
    const search = await page.evaluate(() => location.search);
    expect(search).toContain("tz1=" + encodeURIComponent(newTz1));
    expect(search).toContain("tz2=Europe%2FLondon");
  });
});
