import { expect, test } from "@playwright/test";

test.describe("XReader Smoke Tests", () => {
  test("bookshelf page renders header and toolbar", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "书架" })).toBeVisible();
    await expect(page.getByRole("button", { name: "打开阅读统计" })).toBeVisible();
    await expect(page.getByRole("button", { name: "打开搜索书籍" })).toBeVisible();
    await expect(page.getByRole("button", { name: "打开发现页" })).toBeVisible();
  });

  test("search page renders heading and search controls", async ({ page }) => {
    await page.goto("/search");
    await expect(page.getByRole("heading", { name: "搜索书籍" })).toBeVisible();
    await expect(page.getByPlaceholder("输入书名或作者...")).toBeVisible();
    await expect(page.getByRole("button", { name: "搜索" })).toBeVisible();
  });

  test("stats page renders summary cards", async ({ page }) => {
    await page.goto("/stats");
    await expect(page.getByRole("heading", { name: "阅读统计" })).toBeVisible();
    await expect(page.getByText("总阅读时长")).toBeVisible();
    await expect(page.getByText("总阅读字数")).toBeVisible();
  });

  test("reader with missing book redirects back to bookshelf", async ({ page }) => {
    await page.goto("/reader/nonexistent-id");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "书架" })).toBeVisible();
  });
});
