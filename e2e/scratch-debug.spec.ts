import { expect, test } from "@playwright/test";

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";

test("scratch: debug add supplier price", async ({ page }) => {
  page.on("console", (msg) => console.log("[console]", msg.type(), msg.text()));
  page.on("pageerror", (err) => console.log("[pageerror]", err.message));
  page.on("response", async (res) => {
    if (res.url().includes("supplier-prices")) {
      console.log("[response]", res.status(), res.url(), await res.text().catch(() => ""));
    }
  });

  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/select-financial-year/);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL("/");

  await page.goto("/products");
  await page.locator("[data-navcard]").first().click();
  await expect(page).toHaveURL(/\/products\/[0-9a-f-]+$/);

  await page.getByRole("button", { name: "Add price" }).click();
  await page.getByText("Select supplier…").click();
  await page.getByRole("option").first().click();
  await page.getByLabel("Cost").fill("55.50");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForTimeout(2000);
});
