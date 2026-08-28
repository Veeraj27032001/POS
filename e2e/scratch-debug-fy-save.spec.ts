import { expect, test } from "@playwright/test";

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";

test("debug financial year save failure", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/select-financial-year/, { timeout: 15000 });
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL("/", { timeout: 15000 });

  await page.goto("/settings/financial-years", { waitUntil: "networkidle" });
  console.log(
    "Page title visible:",
    await page
      .locator("h1, h2")
      .first()
      .textContent()
      .catch(() => "none"),
  );

  const [response] = await Promise.all([
    page.waitForResponse(
      (res) =>
        res.url().endsWith("/api/financial-years-admin") && res.request().method() === "POST",
    ),
    (async () => {
      await page.getByRole("button", { name: "New" }).click();
      await page.getByLabel("Label").fill(`FY${Date.now().toString().slice(-6)}`);
      await page.locator("#startDate").fill("2027-04-01");
      await page.locator("#endDate").fill("2028-03-31");
      await page.getByRole("button", { name: "Save" }).click();
    })(),
  ]);

  console.log("POST status:", response.status());
  const body = await response.text();
  console.log("POST body:", body);
});
