import { expect, test } from "@playwright/test";

test.describe("profile picker", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("answers build the receipt and the install command, and copy matches", async ({ page }) => {
    await page.goto("/profiles");
    const command = page.getByText("Run this to install the lot").locator("..").locator("code");
    const lines = page.locator("ol li");

    await expect(page.getByText("Nothing here yet")).toBeVisible();

    await page.getByText("Software", { exact: true }).click();
    await expect(lines).toHaveCount(3);
    await expect(command).toHaveText("npx @agentsaisle/cli add explore implement commit");

    // "plan first" adds plan after what is already there
    await page.getByText("Plan first, then build").click();
    await expect(lines).toHaveCount(4);
    await expect(command).toHaveText("npx @agentsaisle/cli add explore implement commit plan");

    // a second answer that adds a skill already on the receipt doesn't duplicate it
    await page.getByText("Yes", { exact: true }).first().click();
    await expect(lines).toHaveCount(4);

    await page.getByText("Yes, review it").click();
    await expect(lines).toHaveCount(5);

    const shown = (await command.innerText()).trim();
    await page.getByRole("button", { name: "Copy command" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(shown);

    await page.getByRole("button", { name: "Start over" }).click();
    await expect(page.getByText("Nothing here yet")).toBeVisible();
    await expect(command).toHaveText("npx @agentsaisle/cli add");
  });

  test("starter bundles show the init command", async ({ page }) => {
    await page.goto("/profiles");
    await expect(page.getByText("npx @agentsaisle/cli init --profile code").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Writing", level: 3 })).toBeVisible();
  });
});

test.describe("submit", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  async function fillValid(page: import("@playwright/test").Page, sha: string) {
    const g = page.locator("section[aria-labelledby=generator]");
    await g.getByLabel("Skill name").fill("reel-scriptwriter");
    await g.getByLabel("Author").fill("someone");
    await g.getByLabel("GitHub repository").fill("someone/their-skills");
    await g.getByLabel("Folder with SKILL.md").fill("skills/reel-scriptwriter");
    await g.getByLabel("Tag or branch").fill("v1.0.0");
    await g.getByLabel("Full commit SHA").fill(sha);
    await g.getByLabel("Aisles").fill("video, social");
    return g;
  }

  test("an invalid SHA shows an error and no pull request link; a valid one enables it", async ({
    page,
  }) => {
    await page.goto("/submit");
    const g = await fillValid(page, "abc");
    await g.getByLabel("Full commit SHA").blur();
    await expect(g.getByText("40-character")).toBeVisible();
    await expect(g.getByRole("link", { name: "Open a pull request" })).toHaveCount(0);
    await expect(g.getByText("Fix the fields to continue")).toBeVisible();

    const sha = "3f9c2e1a".repeat(5);
    await g.getByLabel("Full commit SHA").fill(sha);
    const link = g.getByRole("link", { name: "Open a pull request" });
    await expect(link).toBeVisible();
    const href = new URL((await link.getAttribute("href"))!);
    expect(href.origin + href.pathname).toBe(
      "https://github.com/HazemSalah29/agentsaisle/new/main/registry/community",
    );
    expect(href.searchParams.get("filename")).toBe("reel-scriptwriter.yaml");
    expect(href.searchParams.get("value")).toContain(`sha: "${sha}"`);

    const preview = g.getByLabel("Generated YAML");
    await expect(preview).toContainText("name: reel-scriptwriter");
    await expect(preview).toContainText("category: [video, social]");
    await expect(preview).not.toContainText("verified");
  });

  test("copy puts the generated YAML on the clipboard and versions can be added and removed", async ({
    page,
  }) => {
    await page.goto("/submit");
    const g = await fillValid(page, "3f9c2e1a".repeat(5));
    await g.getByRole("button", { name: "Copy YAML" }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain("name: reel-scriptwriter");
    expect(copied.endsWith("\n")).toBe(true);

    await g.getByRole("button", { name: "Add an older version" }).click();
    await expect(g.getByLabel("Full commit SHA (2)")).toBeVisible();
    await expect(g.getByText("Fix the fields to continue")).toBeVisible(); // the new version is empty
    await g
      .getByRole("button", { name: /Remove version/ })
      .last()
      .click();
    await expect(g.getByRole("link", { name: "Open a pull request" })).toBeVisible();
  });
});
