import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { OTP } from "otplib";

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";
const ADMIN2_EMAIL = process.env.SEED_ADMIN2_EMAIL;
const ADMIN2_PASSWORD = process.env.SEED_ADMIN2_PASSWORD;

const totp = new OTP({ strategy: "totp" });

async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/select-financial-year/);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL("/");
}

async function login(page: Page) {
  await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
}

test("unauthenticated API request is rejected", async ({ request }) => {
  const res = await request.get("/api/categories");
  expect(res.status()).toBe(401);
});

test("visiting a protected page while unauthenticated redirects to the unauthorized page", async ({
  page,
}) => {
  await page.goto("/products");
  await expect(page).toHaveURL(/\/unauthorized/);
});

test("login flow: password, financial year selection, then dashboard", async ({ page }) => {
  await login(page);
  await expect(page.getByText(/Signed in as Demo Admin/)).toBeVisible();
});

test("financial year picker shows the label, not the raw id, once selected", async ({ page }) => {
  await login(page);

  const trigger = page.getByRole("combobox").first();
  await expect(trigger).toContainText(/\d{4}-\d{2}/);
  await expect(trigger).not.toContainText(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/);
});

test("sign out button is visible when logged in and ends the session", async ({ page }) => {
  await login(page);

  await page.getByRole("button", { name: "Account menu" }).click();
  const signOutButton = page.getByRole("button", { name: "Sign out" });
  await expect(signOutButton).toBeVisible();
  await signOutButton.click();

  await expect(page).toHaveURL(/\/login/);
  await page.goto("/products");
  await expect(page).toHaveURL(/\/unauthorized/);
});

test("create two standalone products and print a label", async ({ page }) => {
  await login(page);

  await page.goto("/products");

  for (const [label, price] of [
    ["10 Rs Pack", "10"],
    ["20 Rs Pack", "20"],
  ] as const) {
    await page.getByRole("button", { name: "New Product" }).click();

    const productName = `Test Product ${label} ${Date.now()}`;
    await page.getByLabel("Name").fill(productName);
    await page.getByText("Select category…").click();
    await page.getByRole("option").first().click();
    await page.getByText("Select tax code…").click();
    await page.getByRole("option").first().click();
    await page.getByText("Select UOM…").click();
    await page.getByRole("option").first().click();
    await page.getByLabel("Price").fill(price);
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText(productName)).toBeVisible();
  }

  await expect(page.getByText(/^20\d{11}$/).first()).toBeVisible();

  const printButtons = page.getByRole("button", { name: "Print Label" });
  expect(await printButtons.count()).toBeGreaterThanOrEqual(2);
  await printButtons.first().click();
});

test("Product view page resolves category/tax/UOM names and toggles active state", async ({
  page,
}) => {
  await login(page);
  await page.goto("/products");

  const productName = `Test Product View ${Date.now()}`;
  await page.getByRole("button", { name: "New Product" }).click();
  await page.getByLabel("Name").fill(productName);
  await page.getByText("Select category…").click();
  await page.getByRole("option").first().click();
  await page.getByText("Select tax code…").click();
  await page.getByRole("option").first().click();
  await page.getByText("Select UOM…").click();
  await page.getByRole("option").first().click();
  await page.getByLabel("Price").fill("15");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(productName)).toBeVisible();

  await page.getByText(productName).click();

  await expect(page).toHaveURL(/\/products\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: "Product details" })).toBeVisible();
  await expect(page.getByText(productName)).toBeVisible();

  const categoryRow = page.getByText("Category").locator("..");
  await expect(categoryRow).not.toContainText(/^[0-9a-f]{8}-/);

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Deactivate" }).click();
  await expect(page.getByText("Product deactivated.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Activate" })).toBeVisible();

  await page.getByRole("button", { name: "Activate" }).click();
  await expect(page.getByText("Product activated.")).toBeVisible();
});

test("DataTable pagination shows skeleton then renders rows on a seeded list", async ({ page }) => {
  await login(page);

  await page.goto("/cash-denominations");
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByText(/\d+ record/)).toBeVisible();
});

test("create, edit, and soft-delete a category, with toast feedback on each save", async ({
  page,
}) => {
  await login(page);
  await page.goto("/categories");

  const originalName = `Test Category ${Date.now()}`;
  await page.getByRole("button", { name: "New" }).click();
  await page.getByLabel("Name").fill(originalName);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Category created.")).toBeVisible();
  await expect(page.getByText(originalName)).toBeVisible();

  const row = page.getByRole("row").filter({ hasText: originalName });
  await row.getByRole("button", { name: "Edit" }).click();

  const updatedName = `${originalName} Edited`;
  const nameInput = page.getByLabel("Name");
  await nameInput.fill(updatedName);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Category updated.")).toBeVisible();
  await expect(page.getByText(updatedName)).toBeVisible();

  const updatedRow = page.getByRole("row").filter({ hasText: updatedName });
  page.once("dialog", (dialog) => dialog.accept());
  await updatedRow.getByRole("button", { name: "Deactivate" }).click();
  await expect(page.getByText("Category deactivated.")).toBeVisible();
  await expect(updatedRow.getByText("No")).toBeVisible();

  await updatedRow.getByRole("button", { name: "Activate" }).click();
  await expect(page.getByText("Category activated.")).toBeVisible();
  await expect(updatedRow.getByText("Yes")).toBeVisible();
});

test("View button on a master list navigates to a per-record detail page", async ({ page }) => {
  await login(page);
  await page.goto("/categories");

  const name = `Test Category ${Date.now()}`;
  await page.getByRole("button", { name: "New" }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Category created.")).toBeVisible();

  const row = page.getByRole("row").filter({ hasText: name });
  await row.getByRole("link", { name: "View" }).click();

  await expect(page).toHaveURL(/\/categories\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: "Category details" })).toBeVisible();
  await expect(page.getByText(name)).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Deactivate" }).click();
  await expect(page.getByText("Category deactivated.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Activate" })).toBeVisible();

  await page.getByRole("button", { name: "Activate" }).click();
  await expect(page.getByText("Category activated.")).toBeVisible();

  await page.getByRole("link", { name: "← Back to Categories" }).click();
  await expect(page).toHaveURL(/\/categories$/);
});

test("Delete permanently hides a record everywhere, separately from Deactivate", async ({
  page,
}) => {
  await login(page);
  await page.goto("/categories");

  const name = `Test Category Delete ${Date.now()}`;
  await page.getByRole("button", { name: "New" }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Category created.")).toBeVisible();

  await page.getByPlaceholder("Search…").fill(name);
  await expect(page.getByText(name)).toBeVisible();

  const row = page.getByRole("row").filter({ hasText: name });
  page.once("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Category deleted.")).toBeVisible();
  await expect(page.getByText(name)).not.toBeVisible();

  const res = await page.request.get(`/api/categories?search=${encodeURIComponent(name)}`);
  const body = await res.json();
  expect(body.data.find((r: { name: string }) => r.name === name)).toBeUndefined();
});

test("System and Product Barcodes pages render actual barcode graphics", async ({ page }) => {
  await login(page);
  await page.goto("/products");

  const productName = `Test Product Barcode ${Date.now()}`;
  await page.getByRole("button", { name: "New Product" }).click();
  await page.getByLabel("Name").fill(productName);
  await page.getByText("Select category…").click();
  await page.getByRole("option").first().click();
  await page.getByText("Select tax code…").click();
  await page.getByRole("option").first().click();
  await page.getByText("Select UOM…").click();
  await page.getByRole("option").first().click();
  await page.getByLabel("Price").fill("15");
  await page.getByLabel("Manufacturer barcode (optional)").fill(`MFR${Date.now()}`);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(productName)).toBeVisible();

  await page.goto("/barcodes/system");
  const systemSvg = page.locator("table tbody tr").first().locator("svg");
  await expect(systemSvg).toBeVisible();
  await expect(systemSvg.locator("rect, path")).not.toHaveCount(0);

  await page.goto("/barcodes/product");
  const productSvg = page.locator("table tbody tr").first().locator("svg");
  await expect(productSvg).toBeVisible();
  await expect(productSvg.locator("rect, path")).not.toHaveCount(0);
});

test("Product view page: add, reorder, and remove images and videos", async ({ page }) => {
  test.setTimeout(300_000); // four background attach+poll waits, worst case
  await login(page);
  await page.goto("/products");

  const productName = `Test Product Media ${Date.now()}`;
  await page.getByRole("button", { name: "New Product" }).click();
  await page.getByLabel("Name").fill(productName);
  await page.getByText("Select category…").click();
  await page.getByRole("option").first().click();
  await page.getByText("Select tax code…").click();
  await page.getByRole("option").first().click();
  await page.getByText("Select UOM…").click();
  await page.getByRole("option").first().click();
  await page.getByLabel("Price").fill("25");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(productName)).toBeVisible();

  await page.getByText(productName).click();
  await expect(page).toHaveURL(/\/products\/[0-9a-f-]+$/);

  const pngBuffer = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );

  // Adding a photo/video now finishes on the server independently of this
  // tab (see ProductMediaManager) — the client polls to reflect it live
  // once the background merge+attach completes, which can take longer than
  // the default assertion timeout, especially under dev-mode compile
  // overhead, so these specific checks get a generous explicit timeout.
  const BACKGROUND_ATTACH_TIMEOUT = 60_000;

  const imageInput = page.locator('input[type="file"][accept="image/*"]');
  await imageInput.setInputFiles({ name: "one.png", mimeType: "image/png", buffer: pngBuffer });
  await expect(page.getByText("Images (1)")).toBeVisible({ timeout: BACKGROUND_ATTACH_TIMEOUT });
  await expect(page.getByText("Cover")).toBeVisible();

  await imageInput.setInputFiles({ name: "two.png", mimeType: "image/png", buffer: pngBuffer });
  await expect(page.getByText("Images (2)")).toBeVisible({ timeout: BACKGROUND_ATTACH_TIMEOUT });

  // Removing it from the product must also delete the underlying file —
  // otherwise storage cost keeps climbing from orphaned uploads. Assert on
  // the actual delete-request response rather than re-fetching the public
  // URL afterward: that URL is CDN-fronted, and edge-cache invalidation
  // isn't instant, so a 200 there right after deleting doesn't mean the
  // delete failed — it means the CDN hasn't caught up yet.
  const imageDeleteResponse = page.waitForResponse("/api/uploads/delete");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTitle("Remove image").first().click();
  await expect(page.getByText("Images (1)")).toBeVisible();
  expect((await imageDeleteResponse).status()).toBe(200);

  const videoInput = page.locator('input[type="file"][accept="video/*"]');
  await videoInput.setInputFiles({ name: "one.mp4", mimeType: "video/mp4", buffer: pngBuffer });
  await expect(page.getByText("Videos (1)")).toBeVisible({ timeout: BACKGROUND_ATTACH_TIMEOUT });

  await videoInput.setInputFiles({ name: "two.mp4", mimeType: "video/mp4", buffer: pngBuffer });
  await expect(page.getByText("Videos (2)")).toBeVisible({ timeout: BACKGROUND_ATTACH_TIMEOUT });

  const videoDeleteResponse = page.waitForResponse("/api/uploads/delete");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTitle("Remove video").first().click();
  await expect(page.getByText("Videos (1)")).toBeVisible();
  expect((await videoDeleteResponse).status()).toBe(200);
});

const NAV_HREFS = [
  "/",
  "/products",
  "/categories",
  "/uoms",
  "/customers",
  "/suppliers",
  "/stores",
  "/warehouses",
  "/terminals",
  "/users",
  "/payment-methods",
  "/reason-codes",
  "/cash-denominations",
  "/numbering-series",
  "/barcodes/system",
  "/barcodes/product",
  "/settings/tax",
  "/settings/security",
  "/settings/preferences",
];

test("every nav page renders without hitting the error boundary", async ({ page }) => {
  test.setTimeout(300_000);
  await login(page);

  for (const href of NAV_HREFS) {
    await page.goto(href);
    await expect(page.getByText("Something went wrong")).not.toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
});

test("rapid double-click on Save creates only one record, not a duplicate", async ({ page }) => {
  await login(page);
  await page.goto("/categories");

  const name = `Test Category ${Date.now()}`;
  await page.getByRole("button", { name: "New" }).click();
  await page.getByLabel("Name").fill(name);

  await page.getByRole("button", { name: "Save", exact: true }).evaluate((el) => {
    (el as HTMLButtonElement).click();
    (el as HTMLButtonElement).click();
  });

  await expect(page.getByText("Category created.")).toBeVisible();
  await page.waitForTimeout(1500);

  await expect(page.getByRole("row").filter({ hasText: name })).toHaveCount(1);
  await expect(page.getByText("Failed to save.")).not.toBeVisible();
});

test("notification position preference defaults to top-right and is configurable in settings", async ({
  page,
}) => {
  await login(page);

  await page.goto("/categories");
  await page.getByRole("button", { name: "New" }).click();
  await page.getByLabel("Name").fill(`Test Category ${Date.now()}`);
  await page.getByRole("button", { name: "Save", exact: true }).click();

  const toaster = page.locator("[data-sonner-toaster]");
  await expect(toaster).toHaveAttribute("data-x-position", "right");
  await expect(toaster).toHaveAttribute("data-y-position", "top");

  await page.goto("/settings/preferences");
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "Bottom left" }).click();
  await expect(page.getByText("Notification position updated.")).toBeVisible();

  await page.goto("/categories");
  await page.getByRole("button", { name: "New" }).click();
  await page.getByLabel("Name").fill(`Test Category ${Date.now()}`);
  await page.getByRole("button", { name: "Save", exact: true }).click();

  await expect(toaster).toHaveAttribute("data-x-position", "left");
  await expect(toaster).toHaveAttribute("data-y-position", "bottom");
});

async function enrollTotpDevice(page: Page, label: string): Promise<string> {
  await page.getByRole("button", { name: /Set up authenticator app|Add another device/ }).click();
  const secret = await page.locator("p.font-mono").innerText();
  const code = await totp.generate({ secret });
  await page.getByLabel("Device name").fill(label);
  await page.getByLabel("Authenticator code").fill(code);
  await page.getByRole("button", { name: "Confirm" }).click();
  return secret;
}

test("multi-device TOTP: enroll, add a second device, remove one, switch methods, log in, and fully disable", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await login(page);
  await page.goto("/settings/security");

  await expect(page.getByText("Two-factor authentication is not enabled")).toBeVisible();

  const deviceList = page.getByTestId("mfa-device-list");

  const secretA = await enrollTotpDevice(page, "Device A");
  await expect(page.getByText("Authenticator app is enabled")).toBeVisible();
  await expect(deviceList.getByRole("listitem").filter({ hasText: "Device A" })).toBeVisible();

  await enrollTotpDevice(page, "Device B");
  await expect(deviceList.getByRole("listitem").filter({ hasText: "Device B" })).toBeVisible();
  await expect(deviceList.getByRole("listitem")).toHaveCount(2);

  page.once("dialog", (dialog) => dialog.accept());
  const deviceBRow = deviceList.getByRole("listitem").filter({ hasText: "Device B" });
  await deviceBRow.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("Device removed.")).toBeVisible();
  await expect(deviceList.getByRole("listitem")).toHaveCount(1);

  await page.getByRole("button", { name: "Switch to email code" }).click();
  await expect(page.getByText("Email code enabled.")).toBeVisible();
  await expect(page.getByText("Email code is enabled")).toBeVisible();

  await page.getByRole("button", { name: "Switch to authenticator app" }).click();
  await expect(page.getByText("Authenticator app enabled.")).toBeVisible();
  await expect(page.getByText("Authenticator app is enabled")).toBeVisible();

  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/mfa-verify\?.*method=totp/);
  await expect(page.getByRole("heading", { name: "Enter authenticator code" })).toBeVisible();

  const loginCode = await totp.generate({ secret: secretA });
  await page.getByLabel("Verification code").fill(loginCode);
  await page.getByRole("button", { name: "Verify" }).click();

  await expect(page).toHaveURL(/\/select-financial-year/);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL("/");

  await page.goto("/settings/security");
  await expect(page.getByText("Authenticator app is enabled")).toBeVisible();

  await page.getByRole("button", { name: "Remove" }).click();
  const finalCode = await totp.generate({ secret: secretA });
  await page.getByLabel(/This is your last device/).fill(finalCode);
  await page.getByRole("button", { name: "Confirm" }).click();

  await expect(page.getByText("Two-factor authentication disabled.")).toBeVisible();
  await expect(page.getByText("Two-factor authentication is not enabled")).toBeVisible();
});

test("mfa-verify page shows method-specific copy for TOTP vs email code", async ({ page }) => {
  await page.goto("/mfa-verify?ticket=placeholder&method=totp");
  await expect(page.getByRole("heading", { name: "Enter authenticator code" })).toBeVisible();
  await expect(page.getByText("Enter the 6-digit code from your authenticator app.")).toBeVisible();

  await page.goto("/mfa-verify?ticket=placeholder&method=email_otp");
  await expect(page.getByRole("heading", { name: "Enter emailed code" })).toBeVisible();
  await expect(page.getByText("We sent a 6-digit code to your email address.")).toBeVisible();
});

test("Admin: store picker is populated, Super Admin is hidden, and Manager/Cashier require a store", async ({
  page,
}) => {
  test.skip(!ADMIN2_EMAIL || !ADMIN2_PASSWORD, "SEED_ADMIN2_EMAIL/PASSWORD not configured");
  await loginAs(page, ADMIN2_EMAIL!, ADMIN2_PASSWORD!);

  // Super-admin-only links must not even render for an Admin session.
  await expect(page.getByRole("link", { name: "Stores" })).not.toBeVisible();
  await expect(page.getByRole("link", { name: "Reason Codes" })).not.toBeVisible();
  await expect(page.getByRole("link", { name: "Numbering Series" })).not.toBeVisible();

  await page.goto("/users");
  await page.getByRole("button", { name: "New User" }).click();

  await page.getByText("Select role…").click();
  await expect(page.getByRole("option", { name: "Super Admin" })).not.toBeVisible();
  await page.getByRole("option", { name: "Cashier" }).click();

  // The store picker must actually have options for an Admin session — this
  // is the bug: it silently came up empty once Stores became a restricted
  // module, because the picker reused the gated Stores list endpoint.
  await page.getByText("Select store…").click();
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.keyboard.press("Escape");

  const testName = `Test Cashier No Store ${Date.now()}`;
  await page.getByLabel("Name").fill(testName);
  await page.getByLabel("Email").fill(`cashier-${Date.now()}@example.com`);
  await page.getByLabel("Temporary password").fill("TempPass123!");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("must belong to a store")).toBeVisible();

  await page.getByText("Select store…").click();
  await page.getByRole("option").first().click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(testName)).toBeVisible();
});
