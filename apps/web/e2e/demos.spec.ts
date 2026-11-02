import { expect, test } from "@playwright/test";
import { existsSync } from "node:fs";
import path from "node:path";

test.describe("demos", () => {
  test("lists videos that exist, each with a source and honest labels", async ({ page }) => {
    await page.goto("/demos");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Videos the skills made");
    const cards = page.locator("[data-demo]");
    expect(await cards.count()).toBeGreaterThan(0);
    for (const card of await cards.all()) {
      await expect(card.locator("video")).toHaveCount(1);
      await expect(card.getByText(/^QA (passed|failed)/)).toBeVisible();
    }
    await expect(page.getByText("does not judge whether a video is any good")).toBeVisible();
    const id = await cards.first().getAttribute("data-demo");
    expect(existsSync(path.join(__dirname, "..", "public", "video-demos", id!))).toBe(true);
  });

  test("header reaches the page", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("navigation", { name: "Main" })
      .first()
      .getByRole("link", { name: "Demos" })
      .click();
    await expect(page).toHaveURL(/\/demos$/);
  });
});
