import { test, expect } from "@playwright/test";
import { urlWith, samplePixel, OUTER, INNER, CX } from "./helpers.mjs";

const GAP = CX - (OUTER.rMid + OUTER.w / 2);
const OUTER_LABEL_R = OUTER.rMid + OUTER.w / 2 + GAP / 2;
const INNER_LABEL_R = INNER.rMid - INNER.w / 2 - GAP / 2;

// sample a small angular fan around the label's centre (labels are always
// drawn at angle 0 = top, regardless of ring rotation) and return the
// closest-to-opaque sample found, so a gap between two glyphs can't fail us.
async function bestInkSample(page, radius) {
  let best = { a: -1 };
  for (let deg = -20; deg <= 20; deg += 2) {
    const px = await samplePixel(page, radius, deg);
    if (px.a > best.a) best = px;
  }
  return best;
}

test("outer dial label is drawn in the light-theme ink colour", async ({ page }) => {
  await test.step("Given the site loads in light theme", async () => {
    await page.goto(urlWith({ theme: "light" }), { waitUntil: "networkidle" });
  });
  await test.step("Then an opaque sample near the outer label matches rgb(16,19,26)", async () => {
    const best = await bestInkSample(page, OUTER_LABEL_R);
    expect(best.a).toBeGreaterThan(200);
    expect(best.r).toBeCloseTo(16, 0);
    expect(best.g).toBeCloseTo(19, 0);
    expect(best.b).toBeCloseTo(26, 0);
  });
});

test("outer dial label is drawn in the dark-theme ink colour", async ({ page }) => {
  await test.step("Given the site loads in dark theme", async () => {
    await page.goto(urlWith({ theme: "dark" }), { waitUntil: "networkidle" });
  });
  await test.step("Then an opaque sample near the outer label matches rgb(243,245,250)", async () => {
    const best = await bestInkSample(page, OUTER_LABEL_R);
    expect(best.a).toBeGreaterThan(200);
    expect(best.r).toBeCloseTo(243, 0);
    expect(best.g).toBeCloseTo(245, 0);
    expect(best.b).toBeCloseTo(250, 0);
  });
});

test("inner dial label is drawn in the dark-theme ink colour", async ({ page }) => {
  await test.step("Given the site loads in dark theme", async () => {
    await page.goto(urlWith({ theme: "dark" }), { waitUntil: "networkidle" });
  });
  await test.step("Then an opaque sample near the inner label matches rgb(243,245,250)", async () => {
    const best = await bestInkSample(page, INNER_LABEL_R);
    expect(best.a).toBeGreaterThan(200);
    expect(best.r).toBeCloseTo(243, 0);
    expect(best.g).toBeCloseTo(245, 0);
    expect(best.b).toBeCloseTo(250, 0);
  });
});

test("inner dial label is drawn in the light-theme ink colour", async ({ page }) => {
  await test.step("Given the site loads in light theme", async () => {
    await page.goto(urlWith({ theme: "light" }), { waitUntil: "networkidle" });
  });
  await test.step("Then an opaque sample near the inner label matches rgb(16,19,26)", async () => {
    const best = await bestInkSample(page, INNER_LABEL_R);
    expect(best.a).toBeGreaterThan(200);
    expect(best.r).toBeCloseTo(16, 0);
    expect(best.g).toBeCloseTo(19, 0);
    expect(best.b).toBeCloseTo(26, 0);
  });
});

test("no semi-transparent stroke halo remains around the outer label's ink", async ({ page }) => {
  await test.step("Given the site loads in light theme", async () => {
    await page.goto(urlWith({ theme: "light" }), { waitUntil: "networkidle" });
  });
  await test.step("Then sampling just past the glyph ink finds no partial-alpha halo", async () => {
    const haloRadius = OUTER_LABEL_R + 15;
    for (let deg = -20; deg <= 20; deg += 2) {
      const px = await samplePixel(page, haloRadius, deg);
      const isHalo = px.a > 40 && px.a < 200;
      expect(isHalo, `deg=${deg} a=${px.a}`).toBe(false);
    }
  });
});
