import { test, expect } from "@playwright/test";
import { PAGE_URL } from "./helpers.mjs";

// parses "City (Region)  UTC+HH:MM" option text and checks ascending-offset,
// alphabetical-by-city-tiebreak ordering, matching app.js's sortedZones().
async function assertSortedByOffset(page, selectId) {
  return page.evaluate((id) => {
    const opts = Array.from(document.querySelectorAll(`#${id} option`)).filter((o) => !o.disabled);
    const parsed = opts.map((o) => {
      const m = o.textContent.match(/^(.*?)(?:\s\(([^)]*)\))?\s{2}UTC([+-])(\d{2}):(\d{2})$/);
      if (!m) return { city: o.textContent, mins: NaN, bad: true };
      const mins = (m[3] === "+" ? 1 : -1) * (parseInt(m[4], 10) * 60 + parseInt(m[5], 10));
      return { city: m[1], mins };
    });
    for (const p of parsed) if (p.bad) return { ok: false, reason: "unparsable option: " + p.city };
    for (let i = 1; i < parsed.length; i++) {
      const a = parsed[i - 1], b = parsed[i];
      if (a.mins > b.mins) return { ok: false, reason: `offset out of order at ${i}: ${a.city}(${a.mins}) before ${b.city}(${b.mins})` };
      if (a.mins === b.mins && a.city.localeCompare(b.city) > 0) return { ok: false, reason: `alpha tiebreak wrong at ${i}: ${a.city} before ${b.city}` };
    }
    return { ok: true, count: parsed.length };
  }, selectId);
}

test("#selLeft options are sorted ascending by UTC offset, alpha tiebreak", async ({ page }) => {
  await test.step("Given a fresh load of the site", async () => {
    await page.goto(PAGE_URL, { waitUntil: "networkidle" });
  });
  await test.step("Then #selLeft's option list is sorted by offset then city", async () => {
    const result = await assertSortedByOffset(page, "selLeft");
    expect(result.ok, result.reason).toBe(true);
    expect(result.count).toBeGreaterThan(300);
  });
});

test("#selRight options are sorted ascending by UTC offset, alpha tiebreak", async ({ page }) => {
  await test.step("Given a fresh load of the site", async () => {
    await page.goto(PAGE_URL, { waitUntil: "networkidle" });
  });
  await test.step("Then #selRight's option list is sorted by offset then city", async () => {
    const result = await assertSortedByOffset(page, "selRight");
    expect(result.ok, result.reason).toBe(true);
    expect(result.count).toBeGreaterThan(300);
  });
});

test("typing in #searchLeft filters #selLeft's options to matching zones", async ({ page }) => {
  await test.step("Given a fresh load of the site", async () => {
    await page.goto(PAGE_URL, { waitUntil: "networkidle" });
  });
  await test.step("When the user types 'tokyo' into #searchLeft", async () => {
    await page.locator("#searchLeft").fill("tokyo");
  });
  await test.step("Then #selLeft only shows options matching the query", async () => {
    const { count, allMatch } = await page.evaluate(() => {
      const opts = Array.from(document.querySelectorAll("#selLeft option")).filter((o) => !o.disabled);
      const allMatch = opts.every((o) => o.textContent.toLowerCase().includes("tokyo"));
      return { count: opts.length, allMatch };
    });
    expect(count).toBeGreaterThan(0);
    expect(allMatch).toBe(true);
  });
});
