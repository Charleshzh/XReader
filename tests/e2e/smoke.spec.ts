import { test, expect } from "@playwright/test";

test.describe("XReader Smoke Tests (Vite-only)", () => {
  // Supress Tauri IPC errors — pages call invoke() which throws in Vite.
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", () => {});
  });

  test("bookshelf page renders", async ({ page }) => {
    await page.goto("/");
    // Header always renders
    await expect(page.locator("h1").first()).toContainText("书架", {
      timeout: 10000,
    });
  });

  test("stats page renders", async ({ page }) => {
    await page.goto("/stats");
    // Just check the header text — ErrorBoundary may fire but h1 should still exist
    await expect(page.locator("h1").first()).toContainText("阅读统计", {
      timeout: 10000,
    });
  });

  test("source manage page renders", async ({ page }) => {
    await page.goto("/sources");
    await expect(page.locator("h1").first()).toContainText("书源", {
      timeout: 8000,
    });
  });

  test("discover page renders", async ({ page }) => {
    await page.goto("/discover");
    await expect(page.locator("h1").first()).toContainText("发现", {
      timeout: 8000,
    });
  });

  test("settings page renders", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("h1").first()).toContainText("设置", {
      timeout: 8000,
    });
  });

  test("reader page shows fallback", async ({ page }) => {
    await page.goto("/reader/nonexistent-id");
    await expect(page.locator("h1, text=Error, text=加载中").first()).toBeVisible({
      timeout: 8000,
    });
  });
});
