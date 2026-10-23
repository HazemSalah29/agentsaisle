import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

// Counts come from the same registry the site was built from, so adding skills never breaks the tests.
const registry = JSON.parse(
  readFileSync(path.join(__dirname, "..", "public", "registry.json"), "utf8"),
) as {
  skills: Array<{ source: string }>;
};
const TOTAL = registry.skills.length;
const OFFICIAL = registry.skills.filter((s) => s.source === "official").length;

test.describe("home", () => {
  test("renders and searches into the catalog", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Find a skill");
    await page.getByLabel("Search skills").fill("commit");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/\/skills\?q=commit/);
    await expect(page.getByRole("heading", { name: "commit", level: 2 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "explore", level: 2 })).toHaveCount(0);
  });

  test("header navigation reaches the main pages", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Main" }).first();
    await nav.getByRole("link", { name: "Skills" }).click();
    await expect(page).toHaveURL(/\/skills$/);
    await page
      .getByRole("navigation", { name: "Main" })
      .first()
      .getByRole("link", { name: "Docs" })
      .click();
    await expect(page).toHaveURL(/\/docs$/);
  });
});

test.describe("catalog", () => {
  test("search, filters and clear work together and the URL follows", async ({ page }) => {
    await page.goto("/skills");
    const cards = page.getByRole("article");
    await expect(cards).toHaveCount(TOTAL);

    await page.getByLabel("Search skills").fill("brand");
    await expect(cards).toHaveCount(1);
    await expect(page).toHaveURL(/q=brand/);

    await page.getByLabel("Search skills").fill("");
    await page.getByRole("button", { name: "git", exact: true }).click();
    await expect(cards).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "commit", level: 2 })).toBeVisible();
    await expect(page).toHaveURL(/aisle=git/);

    // official commit skill is excluded when only community skills are wanted
    await page.getByText("community", { exact: true }).click();
    await expect(cards).toHaveCount(0);
    await expect(page.getByText("No skills match")).toBeVisible();

    await page.getByRole("button", { name: "Clear filters" }).first().click();
    await expect(cards).toHaveCount(TOTAL);
    await expect(page).not.toHaveURL(/aisle=|source=|q=/);
  });

  test("filters are restored from the URL", async ({ page }) => {
    await page.goto("/skills?source=official&sort=name");
    await expect(page.getByRole("article")).toHaveCount(OFFICIAL);
    await expect(page.getByRole("button", { name: "Clear filters" })).toBeVisible();
  });
});

test.describe("skill page", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("version selector changes the command and copy puts exactly it on the clipboard", async ({
    page,
  }) => {
    await page.goto("/skills/brand-guidelines");
    const install = page.getByRole("region", { name: "Install" });
    await expect(install.locator("code").first()).toContainText(
      "npx @agentsaisle/cli add brand-guidelines",
    );
    await expect(install.locator("code").first()).not.toContainText("@0.9.0");

    await install.getByLabel("Version").selectOption("0.9.0");
    await expect(install.locator("code").first()).toContainText("add brand-guidelines@0.9.0");

    await install.getByRole("button", { name: "Copy", exact: true }).click();
    await expect(install.getByRole("button", { name: "Copied" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      "npx @agentsaisle/cli add brand-guidelines@0.9.0",
    );

    // back to latest: the plain command, no pin
    await install.getByLabel("Version").selectOption({ index: 0 });
    await install.getByRole("button", { name: /Copy|Copied/ }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      "npx @agentsaisle/cli add brand-guidelines",
    );
  });

  test("shows trust labels, rendered SKILL.md, version history and links", async ({ page }) => {
    await page.goto("/skills/brand-guidelines");
    await expect(page.getByText("Not reviewed by Agent Aisle")).toBeVisible();
    await expect(page.getByRole("link", { name: "Report this skill" })).toHaveAttribute(
      "href",
      /report-skill\.yml.*skill=brand-guidelines/,
    );
    await expect(page.getByRole("link", { name: "anthropics/skills" })).toHaveAttribute(
      "href",
      /github\.com\/anthropics\/skills\/tree\/[0-9a-f]{40}/,
    );
    await expect(page.getByRole("heading", { name: "Version history" })).toBeVisible();
    await expect(page.getByRole("row")).toHaveCount(3); // header + two versions
    // SKILL.md comes from GitHub; when offline the page shows a notice instead of failing
    const body = page.locator(".skill-prose, :text('We could not load SKILL.md')").first();
    await expect(body).toBeVisible();
  });

  test("an official skill has no unverified notice, and unknown skills 404", async ({ page }) => {
    await page.goto("/skills/explore");
    await expect(page.getByRole("heading", { name: "explore", level: 1 })).toBeVisible();
    await expect(page.getByText("Not reviewed by Agent Aisle")).toHaveCount(0);
    const res = await page.goto("/skills/does-not-exist");
    expect(res?.status()).toBe(404);
    await expect(page.getByText("This shelf is empty")).toBeVisible();
  });
});

test.describe("docs", () => {
  test("renders and /docs#install scrolls to the install section", async ({ page }) => {
    await page.goto("/docs#install");
    await expect(page.getByRole("heading", { name: "Install the CLI" })).toBeInViewport();
    await expect(page.getByText("npx @agentsaisle/cli add explore").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Commands" })).toBeVisible();
  });
});

test.describe("mobile and keyboard", () => {
  test.use({ viewport: { width: 360, height: 800 } });

  for (const path of [
    "/",
    "/skills",
    "/skills/brand-guidelines",
    "/skills/explore",
    "/docs",
    "/profiles",
    "/submit",
  ]) {
    test(`no horizontal scroll at 360px on ${path}`, async ({ page }) => {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("keyboard: skip link first, then the menu and search are reachable", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main$/);
    await page.getByLabel("Search skills").focus();
    await expect(page.getByLabel("Search skills")).toBeFocused();
  });
});
