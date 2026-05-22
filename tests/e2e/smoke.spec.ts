import { test, expect } from "@playwright/test";

test.describe("XReader Smoke Tests (Vite-only)", () => {
  // All page components call `invoke()` from @tauri-apps/api on mount,
  // which throws in a pure Vite dev server (no Tauri). The error is caught
  // by React ErrorBoundary and shows a fallback UI.

  test("bookshelf page loads (may show error fallback)", async ({ page }) => {
    // Suppress Tauri IPC errors in console
    page.on("pageerror", () => {});

    await page.goto("/");
    // Either shows the bookshelf, or the ErrorBoundary fallback
    await expect(
      page
        .locator("h1")
        .or(page.locator("text=书架为空"))
        .or(page.locator("text=Error")),
    ).toBeVisible({ timeout: 10000 });
  });

  test("stats page has back button", async ({ page }) => {
    page.on("pageerror", () => {});
    await page.goto("/stats");
    // Back button should always render (pure DOM, no API dependency)
    await expect(
      page.locator("button svg.lucide-arrow-left"),
    ).toBeVisible({ timeout: 10000 });
  });

  test("source manage page renders header", async ({ page }) => {
    page.on("pageerror", () => {});
    await page.goto("/sources");
    await expect(page.locator("h1")).toContainText("书源", { timeout: 8000 });
  });

  test("discover page renders header", async ({ page }) => {
    page.on("pageerror", () => {});
    await page.goto("/discover");
    await expect(page.locator("h1")).toContainText("发现", { timeout: 8000 });
  });

  test("settings page renders header", async ({ page }) => {
    page.on("pageerror", () => {});
    await page.goto("/settings");
    await expect(page.locator("h1")).toContainText("设置", { timeout: 8000 });
  });

  test("reader page shows fallback for missing book", async ({ page }) => {
    page.on("pageerror", () => {});
    await page.goto("/reader/nonexistent-id");
    // Should show error or fallback
    await expect(
      page
        .locator("text=Error")
        .or(page.locator("text=错误"))
        .or(page.locator("text=加载中"))
        .or(page.locator("h1")),
    ).toBeVisible({ timeout: 8000 });
  });
});
