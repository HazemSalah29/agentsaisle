import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { openDetails } from "./helpers";

const registry = JSON.parse(
  readFileSync(path.join(__dirname, "..", "public", "registry.json"), "utf8"),
) as { skills: Array<{ name: string; partOf?: string; requires?: string[] }> };
const library = registry.skills.find((s) => s.requires?.length)!;
const part = registry.skills.find((s) => s.partOf === library.name)!;

test.describe("a library of skills", () => {
  test("the catalog shows the library once and not its parts", async ({ page }) => {
    await page.goto("/skills");
    await expect(
      page.getByRole("heading", { name: library.name, level: 2, exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: part.name, level: 2, exact: true })).toHaveCount(
      0,
    );
  });

  test("the library page speaks plainly, and tucks its parts away, each linking to its own page", async ({
    page,
  }) => {
    await page.goto(`/skills/${library.name}`);
    await expect(page.getByRole("heading", { name: "What you can ask for" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Add, update or remove" })).toBeVisible();
    await openDetails(page);
    await expect(
      page.getByRole("heading", { name: `Built from ${library.requires!.length} parts` }),
    ).toBeVisible();
    await page.getByRole("link", { name: part.name, exact: true }).first().click();
    await expect(page).toHaveURL(new RegExp(`/skills/${part.name}$`));
    await expect(page.getByText("is a part of the")).toBeVisible();
    await expect(page.getByText(new RegExp(`add ${library.name}`)).first()).toBeVisible();
  });

  test("add, update and remove each show their own line, and the scope switch adds --global", async ({
    page,
  }) => {
    await page.goto(`/skills/${library.name}`);
    const line = page.locator("#manage-panel code");
    await expect(line).toContainText(`add ${library.name}`);
    await page.getByRole("tab", { name: "Update" }).click();
    await expect(line).toContainText(`update ${library.name}`);
    await page.getByRole("tab", { name: "Remove" }).click();
    await page.getByLabel(/All my projects/).check();
    await expect(line).toContainText(`remove ${library.name} --global`);
  });
});
