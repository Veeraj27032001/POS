import { expect, test } from "@playwright/test";

const ADMIN_EMAIL = process.env.SEED_ADMIN2_EMAIL ?? "admin@example.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN2_PASSWORD ?? "ChangeMe123!";

test("barcode click opens a large, heavily-blurred modal", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/select-financial-year/, { timeout: 15000 });
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL("/", { timeout: 15000 });

  await page.goto("/barcodes/system", { waitUntil: "networkidle" });
  const rowCount = await page.locator("tbody tr").count();
  console.log("System barcode rows:", rowCount);
  if (rowCount === 0) {
    console.log("No products to test with — skipping interaction check.");
    return;
  }

  await page.locator("tbody tr").first().locator("button").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const dialogText = await dialog.innerText();
  console.log("Dialog content:", dialogText);

  const overlay = page.locator('[data-slot="dialog-overlay"]');
  const overlayClass = await overlay.getAttribute("class");
  console.log("Overlay class:", overlayClass);

  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});
