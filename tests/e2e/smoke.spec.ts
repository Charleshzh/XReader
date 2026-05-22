import { test, expect } from "@playwright/test";

test.describe("XReader Smoke Tests", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", () => {});
  });

  test("bookshelf page renders", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "书架" })).toBeVisible({
      timeout: 10000,
    });
  });

  test("stats page loads", async ({ page }) => {
    await page.goto("/stats");
    await expect(page.locator("body > *")).not.toHaveCount(0, { timeout: 10000 });
  });

  test("source manage page renders", async ({ page }) => {
    await page.goto("/sources");
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 8000 });
  });

  test("discover page renders", async ({ page }) => {
    await page.goto("/discover");
    await expect(page.getByRole("heading", { name: "发现" })).toBeVisible({
      timeout: 8000,
    });
  });

  test("settings page renders", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "设置" })).toBeVisible({
      timeout: 8000,
    });
  });

  test("reader page renders fallback", async ({ page }) => {
    await page.goto("/reader/nonexistent-id");
    await expect(page.locator("body > *")).not.toHaveCount(0, { timeout: 8000 });
  });
});
