import type { Page } from "@playwright/test";

/** Opens the "All the details" panel at the bottom of a skill page. */
export async function openDetails(page: Page) {
  await page.getByRole("button", { name: /All the details/ }).click();
}
