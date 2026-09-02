import { test, expect } from "@playwright/test";
import { PAGE_URL } from "./helpers.mjs";

test("page text and assets cannot be selected, search inputs still can", async ({ page }) => {
  await test.step("Given a fresh load of the site", async () => {
    await page.goto(PAGE_URL, { waitUntil: "networkidle" });
  });
  await test.step("Then body text has user-select: none", async () => {
    const bodySelect = await page.$eval("body", (e) => {
      const s = getComputedStyle(e);
      return s.getPropertyValue("-webkit-user-select") || s.getPropertyValue("user-select");
    });
    expect(bodySelect).toBe("none");
  });
  await test.step("Then the search inputs are excluded from the rule", async () => {
    const getSelect = (e) => {
      const s = getComputedStyle(e);
      return s.getPropertyValue("-webkit-user-select") || s.getPropertyValue("user-select");
    };
    const leftSelect = await page.$eval("#searchLeft", getSelect);
    const rightSelect = await page.$eval("#searchRight", getSelect);
    expect(leftSelect).not.toBe("none");
    expect(rightSelect).not.toBe("none");
  });
});
