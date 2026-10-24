import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const registry = JSON.parse(
  readFileSync(path.join(__dirname, "..", "public", "registry.json"), "utf8"),
) as {
  aisles: Array<{ id: string; name: string }>;
  skills: Array<{ name: string; niche?: string; tested?: unknown; source: string }>;
};

test.describe("aisles", () => {
  test("the index lists every aisle and each card opens its page", async ({ page }) => {
    await page.goto("/aisles");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Browse by aisle");
    for (const a of registry.aisles)
      await expect(page.getByRole("heading", { name: a.name, level: 2 })).toBeVisible();
    await page.getByRole("link", { name: /Database/ }).click();
    await expect(page).toHaveURL(/\/aisles\/database$/);
    await expect(page.getByRole("heading", { name: "Database", level: 1 })).toBeVisible();
  });

  test("the database aisle shelves its official skills", async ({ page }) => {
    await page.goto("/aisles/database");
    const dbSkills = registry.skills.filter((s) => s.niche === "db");
    expect(dbSkills.length).toBeGreaterThanOrEqual(4);
    for (const s of dbSkills)
      await expect(page.getByRole("heading", { name: s.name, level: 3 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Official", level: 2 })).toBeVisible();
  });

  test("Elsewhere entries link out and are not installable", async ({ page }) => {
    await page.goto("/aisles/database");
    const shelf = page.locator("section[aria-labelledby=elsewhere]");
    await expect(shelf).toBeVisible();
    const link = shelf.getByRole("link", { name: "supabase-postgres-best-practices" });
    await expect(link).toHaveAttribute("href", /^https:\/\/github\.com\/supabase\/agent-skills/);
    await expect(shelf.getByText(/npx|aisle add/)).toHaveCount(0);
  });

  test("an aisle with no skills says coming soon", async ({ page }) => {
    await page.goto("/aisles/media");
    await expect(page.getByRole("heading", { name: "Coming soon", level: 2 })).toBeVisible();
  });

  test("web design shows both kits with their install command", async ({ page }) => {
    await page.goto("/aisles/web-design");
    await expect(page.getByRole("heading", { name: "Kits", level: 2 })).toBeVisible();
    await expect(
      page.getByText("npx @agentsaisle/cli init --profile motion-portfolio-site"),
    ).toBeVisible();
    await expect(
      page.getByText("npx @agentsaisle/cli init --profile clean-saas-site"),
    ).toBeVisible();
  });

  test("an unknown aisle is a 404, and the header links to the index", async ({ page }) => {
    const res = await page.goto("/aisles/nope");
    expect(res?.status()).toBe(404);
    await page.goto("/");
    await page
      .getByRole("navigation", { name: "Main" })
      .first()
      .getByRole("link", { name: "Aisles" })
      .click();
    await expect(page).toHaveURL(/\/aisles$/);
  });

  test("skill pages carry no Untested label or measured-results note", async ({ page }) => {
    await page.goto("/skills/db-schema");
    await expect(page.getByRole("heading", { level: 1, name: "db-schema" })).toBeVisible();
    await expect(page.getByText(/untested/i)).toHaveCount(0);
    await expect(page.getByText(/No measured results/)).toHaveCount(0);
  });
});
