import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const registry = JSON.parse(
  readFileSync(path.join(__dirname, "..", "public", "registry.json"), "utf8"),
) as { skills: Array<{ name: string; latest: string; audit?: { grade: string } }> };

test.describe("audit", () => {
  test("the /audit page explains grades, rules and how to run it", async ({ page }) => {
    await page.goto("/audit");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Check a skill");
    await expect(page.getByText("not a guarantee of safety").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Grades", level: 2 })).toBeVisible();
    await expect(page.getByText("AA-X02").first()).toBeVisible();
    await expect(page.getByText("aisle audit . --format sarif")).toBeVisible();
  });

  test("a skill page shows its real report and the catalog card shows the grade", async ({
    page,
  }) => {
    const skill = registry.skills.find((s) => s.audit);
    test.skip(!skill, "no audited skill in this registry build");
    await page.goto(`/skills/${skill!.name}`);
    const block = page.locator("section[aria-labelledby=audit]");
    await expect(block.getByRole("heading", { name: "Audit", level: 2 })).toBeVisible();
    await expect(
      block.getByRole("img", { name: new RegExp(`Audit grade ${skill!.audit!.grade}`) }),
    ).toBeVisible();
    await expect(block.getByText("not a guarantee of safety")).toBeVisible();
    await page.goto("/skills");
    await expect(page.getByRole("img", { name: /Audit grade/ }).first()).toBeVisible();
  });
});
