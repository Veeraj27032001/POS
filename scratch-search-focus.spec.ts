import { expect, test } from "@playwright/test";

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";

test("header search keeps focus while typing multiple characters", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/select-financial-year/);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL("/");

  const search = page.getByPlaceholder("Search products, customers, settings…");
  await search.click();
  await search.pressSequentially("Product", { delay: 80 });
  await expect(search).toHaveValue("Product");
  await expect(search).toBeFocused();
});
