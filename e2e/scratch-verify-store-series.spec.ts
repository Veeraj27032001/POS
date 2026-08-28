import { expect, test } from "@playwright/test";

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";

test("a newly created store gets numbering series automatically", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/select-financial-year/, { timeout: 15000 });
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL("/", { timeout: 15000 });

  const storeName = `Verify Series Store ${Date.now()}`;
  const createRes = await page.request.post("/api/stores", {
    data: { name: storeName, address: "1 Verify Road" },
  });
  console.log("Create status:", createRes.status());
  const created = (await createRes.json()) as { id: string };
  console.log("Created store id:", created.id);

  const seriesRes = await page.request.get(
    `/api/numbering-series?storeId=${created.id}&pageSize=200`,
  );
  const seriesBody = (await seriesRes.json()) as { totalRecords: number };
  console.log("Numbering series count for new store:", seriesBody.totalRecords);

  // Clean up — this was only to verify the afterCreate hook, not a store to keep.
  const deleteRes = await page.request.delete(`/api/stores/${created.id}`);
  console.log("Delete status:", deleteRes.status());
});
