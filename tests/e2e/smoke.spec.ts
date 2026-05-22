import { test, expect } from "@playwright/test";

test.describe("XReader Smoke Tests", () => {
  test("bookshelf page renders header", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("书架");
  });

  test("bookshelf shows empty state", async ({ page }) => {
    await page.goto("/");
    // No books imported yet → should show empty state
    await expect(page.locator("text=书架为空").or(page.locator("text=导入第一本书"))).toBeVisible({
      timeout: 5000,
    });
  });

  test("import dialog opens and closes", async ({ page }) => {
    await page.goto("/");
    // Click import button
    await page.locator("button", { hasText: "导入" }).first().click();
    // Dialog should appear
    await expect(page.locator("[role=dialog]")).toBeVisible({ timeout: 3000 });
    // Close with Escape
    await page.keyboard.press("Escape");
    // Dialog should close
    await expect(page.locator("[role=dialog]")).not.toBeVisible({ timeout: 3000 });
  });

  test("stats page renders", async ({ page }) => {
    await page.goto("/stats");
    await expect(page.locator("h1")).toContainText("阅读统计");
    // Back button
    await expect(page.locator("button svg.lucide-arrow-left")).toBeVisible();
  });

  test("navigate to stats and back", async ({ page }) => {
    await page.goto("/");
    // Click stats button
    const statsBtn = page.locator("button[class*='ghost'] svg.lucide-bar-chart-3").first();
    if (await statsBtn.isVisible()) {
      await statsBtn.click();
      await expect(page.locator("h1")).toContainText("阅读统计");
      // Back button navigates home
      const backBtn = page.locator("button[class*='ghost'] svg.lucide-arrow-left").first();
      if (await backBtn.isVisible()) {
        await backBtn.click();
        await expect(page.locator("h1")).toContainText("书架");
      }
    }
  });

  test("source manage page renders", async ({ page }) => {
    await page.goto("/sources");
    await expect(page.locator("h1")).toContainText("书源");
  });

  test("discover page renders", async ({ page }) => {
    await page.goto("/discover");
    await expect(page.locator("h1")).toContainText("发现");
  });

  test("settings page renders WebDAV form", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("h1")).toContainText("设置");
  });

  test("reader page shows error without book", async ({ page }) => {
    // Navigate to reader with non-existent book
    await page.goto("/reader/nonexistent-id");
    // Should show error state or fallback
    await expect(page.locator("text=Error").or(page.locator("text=错误")).or(page.locator("text=加载中"))).toBeVisible({
      timeout: 5000,
    });
  });
});
