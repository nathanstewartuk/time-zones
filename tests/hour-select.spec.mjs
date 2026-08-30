import { test, expect } from "@playwright/test";
import { PAGE_URL, dialBox, dialPoint, hourAngle, samplePixel, OUTER, INNER } from "./helpers.mjs";

// mid-gap radius: strictly between the inner ring's outer edge and the outer ring's inner edge,
// where nothing else is ever drawn - so alpha there is 0 unless the hour-select overlay painted
// it, and the RGB it paints is the exact unblended #5EBBFC source colour (94,187,252).
const GAP_R = (INNER.rMid + INNER.w / 2 + OUTER.rMid - OUTER.w / 2) / 2;

async function gapSample(page, hour) {
  return samplePixel(page, GAP_R, hourAngle(hour) + 7.5); // +7.5 = mid-hour, well clear of the dashed border at the edges
}

function isOverlayColour(px) {
  return px.a > 30 && Math.abs(px.r - 94) < 12 && Math.abs(px.g - 187) < 12 && Math.abs(px.b - 252) < 12;
}

// click/drag through the MIDDLE of each hour's 15deg bucket, not its exact edge - a boundary
// click is one float-rounding error away from landing in the neighbouring hour instead.
async function tapHour(page, hour) {
  const box = await dialBox(page);
  const p = dialPoint(box, INNER.rMid, hourAngle(hour) + 7.5);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.up();
}

async function dragHours(page, fromHour, toHour, steps = 4) {
  const box = await dialBox(page);
  const start = dialPoint(box, INNER.rMid, hourAngle(fromHour) + 7.5);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    const h = fromHour + ((toHour - fromHour) * i) / steps;
    const p = dialPoint(box, INNER.rMid, hourAngle(h) + 7.5);
    await page.mouse.move(p.x, p.y);
  }
  await page.mouse.up();
}

test("tapping an hour on the inner ring paints the #5EBBFC overlay across both rings at that hour", async ({ page }) => {
  await test.step("Given a fresh load of the site", async () => {
    await page.goto(PAGE_URL, { waitUntil: "networkidle" });
  });
  await test.step("Then hour 6's gap is not yet painted", async () => {
    expect(isOverlayColour(await gapSample(page, 6))).toBe(false);
  });
  await test.step("When hour 6 is tapped on the inner ring", async () => {
    await tapHour(page, 6);
  });
  await test.step("Then hour 6's gap is now painted with the overlay colour", async () => {
    expect(isOverlayColour(await gapSample(page, 6))).toBe(true);
  });
});

test("tapping a different hour replaces the selection, not adds to it", async ({ page }) => {
  await test.step("Given hour 6 is already selected", async () => {
    await page.goto(PAGE_URL, { waitUntil: "networkidle" });
    await tapHour(page, 6);
    expect(isOverlayColour(await gapSample(page, 6))).toBe(true);
  });
  await test.step("When hour 14 is tapped", async () => {
    await tapHour(page, 14);
  });
  await test.step("Then hour 14 is painted and hour 6 is no longer painted", async () => {
    expect(isOverlayColour(await gapSample(page, 14))).toBe(true);
    expect(isOverlayColour(await gapSample(page, 6))).toBe(false);
  });
});

test("dragging across hours selects the whole contiguous range", async ({ page }) => {
  await test.step("Given a fresh load of the site", async () => {
    await page.goto(PAGE_URL, { waitUntil: "networkidle" });
  });
  await test.step("When dragging from hour 16 to hour 20 on the inner ring", async () => {
    await dragHours(page, 16, 20);
  });
  await test.step("Then hours 16 through 20 are all painted, and neighbours 15/21 are not", async () => {
    for (const h of [16, 17, 18, 19, 20]) expect(isOverlayColour(await gapSample(page, h))).toBe(true);
    expect(isOverlayColour(await gapSample(page, 15))).toBe(false);
    expect(isOverlayColour(await gapSample(page, 21))).toBe(false);
  });
});

test("tapping a single hour inside an existing multi-hour selection collapses it to just that hour", async ({ page }) => {
  await test.step("Given hours 16-20 are selected", async () => {
    await page.goto(PAGE_URL, { waitUntil: "networkidle" });
    await dragHours(page, 16, 20);
    expect(isOverlayColour(await gapSample(page, 18))).toBe(true);
  });
  await test.step("When hour 18 (inside that range) is tapped on its own", async () => {
    await tapHour(page, 18);
  });
  await test.step("Then only hour 18 remains painted", async () => {
    expect(isOverlayColour(await gapSample(page, 18))).toBe(true);
    expect(isOverlayColour(await gapSample(page, 16))).toBe(false);
    expect(isOverlayColour(await gapSample(page, 20))).toBe(false);
  });
});

test("a drag on the inner ring does not trigger the outer ring's rotate-to-drag gesture", async ({ page }) => {
  let leftBefore;
  await test.step("Given a fresh load of the site", async () => {
    await page.goto(PAGE_URL, { waitUntil: "networkidle" });
    leftBefore = await page.locator("#selLeft").inputValue();
  });
  await test.step("When dragging across hours on the inner ring", async () => {
    await dragHours(page, 2, 8);
  });
  await test.step("Then the outer ring's zone (selLeft) is unchanged", async () => {
    await expect(page.locator("#selLeft")).toHaveValue(leftBefore);
  });
});
