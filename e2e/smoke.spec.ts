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
    await page.getByText("Select HSN code…").click();
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
  await page.getByText("Select HSN code…").click();
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
  await page.getByText("Select HSN code…").click();
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
  await page.getByText("Select HSN code…").click();
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
  "/settings/hsn-codes",
  "/settings/tax-engine",
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
  await page.getByLabel("Confirm password").fill("TempPass123!");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("must belong to a store")).toBeVisible();

  await page.getByText("Select store…").click();
  await page.getByRole("option").first().click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("User created.")).toBeVisible();

  // Confirm it exists via search rather than assuming it's on the default
  // page — this list has accumulated many test users across runs, so a
  // freshly created row (no defaultSort on this resource) isn't guaranteed
  // to land on the first page.
  await page.getByPlaceholder("Search…").fill(testName);
  await expect(page.getByText(testName)).toBeVisible();
});

test("Store: create with Country/State cascade, Currency, and Timezone pickers", async ({
  page,
}) => {
  await login(page);
  await page.goto("/stores");
  await page.getByRole("button", { name: "New" }).click();

  const storeName = `Test Store ${Date.now()}`;
  await page.getByLabel("Name").fill(storeName);
  await page.getByLabel("Address").fill("456 Test Lane, Bengaluru");

  await page.getByText("Select country…").click();
  await page.locator("[cmdk-input]").fill("India");
  await page.getByRole("option", { name: "India" }).click();

  // State only appears once a country with seeded states is selected.
  await page.getByText("Select state…").click();
  await page.locator("[cmdk-input]").fill("Karnataka");
  await page.getByRole("option", { name: "Karnataka" }).click();

  await page.getByText("Select currency…").click();
  await page.locator("[cmdk-input]").fill("INR");
  await page.getByRole("option", { name: "INR" }).click();

  await page.getByText("Select timezone…").click();
  await page.locator("[cmdk-input]").fill("Asia/Kolkata");
  await page.getByRole("option", { name: "Asia/Kolkata" }).click();

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Store created.")).toBeVisible();

  const row = page.getByRole("row").filter({ hasText: storeName });
  await row.getByRole("link", { name: "View" }).click();
  await expect(page).toHaveURL(/\/stores\/[0-9a-f-]+$/);

  // The view page must resolve these to real labels, not raw UUIDs.
  await expect(page.getByText("India")).toBeVisible();
  await expect(page.getByText("Karnataka")).toBeVisible();
  await expect(page.getByText("INR")).toBeVisible();
  await expect(page.getByText("Asia/Kolkata")).toBeVisible();
});

test("Customer: requires at least one store, supports selecting more than one", async ({
  page,
}) => {
  await login(page);
  await page.goto("/customers");
  await page.getByRole("button", { name: "New" }).click();

  const customerName = `Test Customer ${Date.now()}`;
  await page.getByLabel("Name").fill(customerName);
  await page.getByLabel("Phone").fill("9876543210");
  await page.getByLabel("Email").fill(`customer-${Date.now()}@example.com`);

  // No store selected yet — save must be rejected server-side.
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Select at least one store")).toBeVisible();

  await page.getByText("Select store(s)…").click();
  await page.getByRole("option").first().click();
  // Selecting a second option must not close the popover — it's multi-select.
  const optionCount = await page.getByRole("option").count();
  if (optionCount > 1) {
    await page.getByRole("option").nth(1).click();
  }
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Customer created.")).toBeVisible();
  await expect(page.getByText(customerName)).toBeVisible();
});

test("Warehouse: store dropdown is scoped to the requester — Admin sees only their own store", async ({
  page,
}) => {
  test.skip(!ADMIN2_EMAIL || !ADMIN2_PASSWORD, "SEED_ADMIN2_EMAIL/PASSWORD not configured");
  await loginAs(page, ADMIN2_EMAIL!, ADMIN2_PASSWORD!);
  await page.goto("/warehouses");
  await page.getByRole("button", { name: "New" }).click();

  await page.getByText("Select store…").click();
  const options = page.getByRole("option");
  await expect(options).toHaveCount(1);
});

test("Super Admin (cross-store) sees every store in a store picker, not just one", async ({
  page,
}) => {
  await login(page);
  await page.goto("/warehouses");
  await page.getByRole("button", { name: "New" }).click();

  await page.getByText("Select store…").click();
  await expect(page.getByRole("option").first()).toBeVisible();
  const optionCount = await page.getByRole("option").count();
  expect(optionCount).toBeGreaterThan(1);
});

test("Terminal: store selection is required", async ({ page }) => {
  await login(page);
  await page.goto("/terminals");
  await page.getByRole("button", { name: "New" }).click();

  const terminalName = `Test Terminal ${Date.now()}`;
  await page.getByLabel("Name").fill(terminalName);
  await page.getByRole("button", { name: "Save" }).click();
  // No store chosen — client-side validation should block the save.
  await expect(page.getByRole("dialog", { name: "New Terminal" })).toBeVisible();

  await page.getByText("Select store…").click();
  await page.getByRole("option").first().click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Terminal created.")).toBeVisible();
  await expect(page.getByText(terminalName)).toBeVisible();
});

test("New User: a duplicate email gets a clear conflict message, not a generic failure", async ({
  page,
}) => {
  await login(page);
  await page.goto("/users");

  const duplicateEmail = `dup-${Date.now()}@example.com`;

  await page.getByRole("button", { name: "New User" }).click();
  await page.getByLabel("Name").fill("First User");
  await page.getByLabel("Email").fill(duplicateEmail);
  await page.getByLabel("Temporary password").fill("TempPass123!");
  await page.getByLabel("Confirm password").fill("TempPass123!");
  await page.getByText("Select role…").click();
  await page.getByRole("option", { name: "Cashier" }).click();
  await page.getByText("Select store…").click();
  await page.getByRole("option").first().click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("User created.")).toBeVisible();

  await page.getByRole("button", { name: "New User" }).click();
  await page.getByLabel("Name").fill("Second User");
  await page.getByLabel("Email").fill(duplicateEmail);
  await page.getByLabel("Temporary password").fill("TempPass123!");
  await page.getByLabel("Confirm password").fill("TempPass123!");
  await page.getByText("Select role…").click();
  await page.getByRole("option", { name: "Cashier" }).click();
  await page.getByText("Select store…").click();
  await page.getByRole("option").first().click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("already exists")).toBeVisible();
  await expect(page.getByText("Failed to save.")).not.toBeVisible();
});

test("Warehouses: store cards filter the list, default to the first store", async ({ page }) => {
  await login(page);
  await page.goto("/warehouses");

  const cards = page.locator("button[aria-pressed]");
  await expect(cards.first()).toBeVisible();
  const cardCount = await cards.count();
  expect(cardCount).toBeGreaterThan(1);
  await expect(cards.first()).toHaveAttribute("aria-pressed", "true");

  // Create a warehouse from this store-filtered view — its Store field
  // should already be pre-filled to the selected card, and the new row
  // should show up without switching cards.
  const warehouseName = `Test Warehouse ${Date.now()}`;
  await page.getByRole("button", { name: "New" }).click();
  await page.getByLabel("Name").fill(warehouseName);
  await page.getByLabel("Address").fill("789 Test Road");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Warehouse created.")).toBeVisible();
  await expect(page.getByText(warehouseName)).toBeVisible();
});

test("Warehouses: a store-scoped Admin sees only their own store card", async ({ page }) => {
  test.skip(!ADMIN2_EMAIL || !ADMIN2_PASSWORD, "SEED_ADMIN2_EMAIL/PASSWORD not configured");
  await loginAs(page, ADMIN2_EMAIL!, ADMIN2_PASSWORD!);
  await page.goto("/warehouses");

  const cards = page.locator("button[aria-pressed]");
  await expect(cards.first()).toBeVisible();
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toHaveAttribute("aria-pressed", "true");
});

test("Numbering Series: store cards scope the list, a new store is auto-seeded, and copy still works", async ({
  page,
}) => {
  await login(page);

  await page.goto("/stores");
  await page.getByRole("button", { name: "New" }).click();
  const storeName = `Test NS Store ${Date.now()}`;
  await page.getByLabel("Name").fill(storeName);
  await page.getByLabel("Address").fill("1 Test Series Road");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Store created.")).toBeVisible();

  await page.goto("/numbering-series");
  const cards = page.locator("button[aria-pressed]");
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeGreaterThan(1);

  await page.getByRole("button", { name: storeName }).click();
  await expect(page.getByRole("button", { name: storeName })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // A brand-new store is auto-seeded with the reference store's full
  // series set on creation — no manual "Copy to All Stores" click needed.
  await expect(page.getByText(/\d+ record/)).toBeVisible();
  const recordText = await page.getByText(/\d+ record/).textContent();
  expect(Number(recordText?.match(/\d+/)?.[0] ?? 0)).toBeGreaterThan(0);

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Copy to All Stores" }).click();
  await expect(page.getByText(/Copied \d+ series across \d+ store\(s\)\./)).toBeVisible();
});

test("Numbering Series: editing the current number corrects it without creating a new record", async ({
  page,
}) => {
  await login(page);
  await page.goto("/numbering-series");
  await expect(page.locator("button[aria-pressed]").first()).toBeVisible();

  const row = page.getByRole("row").filter({ hasText: "quality_check" }).first();
  await row.getByRole("button", { name: "Edit" }).click();

  await page.locator("#edit-currentNumber").fill("42");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Numbering series updated.")).toBeVisible();
  await expect(row.getByRole("cell").nth(2)).toHaveText("42");
});

test("Products: HSN tax details show on create and the view page when the preference is enabled", async ({
  page,
}) => {
  await login(page);

  await page.goto("/settings/tax-engine");
  const hsnCheckbox = page.locator("#hsn-tax-display");
  await expect(hsnCheckbox).toBeVisible();
  if (!(await hsnCheckbox.isChecked())) {
    await page.getByText("Show HSN tax details on products").click();
    await expect(page.getByText("Tax preferences updated.")).toBeVisible();
  }

  const code = `TST${Date.now() % 100000}`;
  await page.request.post("/api/hsn-codes", {
    data: { hsnCode: code, description: "Test HSN row", cgstRate: 2.5, sgstRate: 2.5, igstRate: 5 },
  });

  await page.goto("/products");
  await page.getByRole("button", { name: "New Product" }).click();
  const productName = `Test HSN Product ${Date.now()}`;
  await page.getByLabel("Name").fill(productName);
  await page.getByText("Select category…").click();
  await page.getByRole("option").first().click();
  await page.getByText("Select HSN code…").click();
  await page.getByRole("option", { name: code }).click();

  await expect(page.getByText("CGST")).toBeVisible();
  await expect(page.getByText("SGST")).toBeVisible();
  await expect(page.getByText("IGST")).toBeVisible();

  await page.getByText("Select UOM…").click();
  await page.getByRole("option").first().click();
  await page.getByLabel("Price").fill("25");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(productName)).toBeVisible();

  await page.getByText(productName).click();
  await expect(page).toHaveURL(/\/products\/[0-9a-f-]+$/);
  await expect(page.getByText("CGST")).toBeVisible();
  await expect(page.getByText("SGST")).toBeVisible();
  await expect(page.getByText("IGST")).toBeVisible();
});

test("Products: editing a product from the view page updates its details", async ({ page }) => {
  await login(page);
  await page.goto("/products");

  const productName = `Test Edit Product ${Date.now()}`;
  await page.getByRole("button", { name: "New Product" }).click();
  await page.getByLabel("Name").fill(productName);
  await page.getByText("Select category…").click();
  await page.getByRole("option").first().click();
  await page.getByText("Select HSN code…").click();
  await page.getByRole("option").first().click();
  await page.getByText("Select UOM…").click();
  await page.getByRole("option").first().click();
  await page.getByLabel("Price").fill("30");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(productName)).toBeVisible();

  await page.getByText(productName).click();
  await expect(page).toHaveURL(/\/products\/[0-9a-f-]+$/);

  await page.getByRole("button", { name: "Edit" }).click();
  const updatedName = `${productName} Edited`;
  await page.locator("#edit-name").fill(updatedName);
  await page.locator("#edit-price").fill("45");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Product updated.")).toBeVisible();
  await expect(page.getByText(updatedName)).toBeVisible();
  const priceRow = page.getByText("Price", { exact: true }).locator("..");
  await expect(priceRow).toContainText("45");
});

test("Products: HSN dropdown is hidden and not required when the preference is off", async ({
  page,
}) => {
  await login(page);

  await page.goto("/settings/tax-engine");
  const hsnCheckbox = page.locator("#hsn-tax-display");
  const hsnLabel = page.getByText("Show HSN tax details on products");
  await expect(hsnCheckbox).toBeVisible();
  if (await hsnCheckbox.isChecked()) {
    await hsnLabel.click();
    await expect(page.getByText("Tax preferences updated.")).toBeVisible();
  }

  try {
    await page.goto("/products");
    await page.getByRole("button", { name: "New Product" }).click();
    await expect(page.getByText("Select HSN code…")).not.toBeVisible();

    const productName = `Test No HSN Product ${Date.now()}`;
    await page.getByLabel("Name").fill(productName);
    await page.getByText("Select category…").click();
    await page.getByRole("option").first().click();
    await page.getByText("Select UOM…").click();
    await page.getByRole("option").first().click();
    await page.getByLabel("Price").fill("12");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(productName)).toBeVisible();
  } finally {
    // Re-enable so every other test's default assumption (the HSN field
    // shows) holds regardless of run order.
    await page.goto("/settings/tax-engine");
    if (!(await page.locator("#hsn-tax-display").isChecked())) {
      await page.getByText("Show HSN tax details on products").click();
      await expect(page.getByText("Tax preferences updated.")).toBeVisible();
    }
  }
});

test("Roles: creating a role and saving its rights succeeds, and Super-Admin-only modules never appear", async ({
  page,
}) => {
  await login(page);
  await page.goto("/settings/roles");

  const roleName = `Test Role ${Date.now()}`;
  await page.getByRole("button", { name: "New Role" }).click();
  await page.getByLabel("Name").fill(roleName);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Role created.")).toBeVisible();

  await page.getByRole("link", { name: roleName }).click();
  await expect(page).toHaveURL(/\/settings\/roles\/[0-9a-f-]+$/);

  const rightsTable = page.getByRole("table");
  await expect(rightsTable.getByText("Numbering Series")).not.toBeVisible();
  await expect(rightsTable.getByText("Tax Settings")).not.toBeVisible();
  await expect(rightsTable.getByText("Payment Methods")).not.toBeVisible();

  await page.getByRole("row", { name: "Products" }).getByRole("checkbox").first().click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Role updated.")).toBeVisible();
  await expect(page.getByText("Failed to save.")).not.toBeVisible();
});

test("Numbering Series: the store filter wraps instead of overflowing the page body", async ({
  page,
}) => {
  await login(page);
  await page.goto("/numbering-series");
  await expect(page.locator("button[aria-pressed]").first()).toBeVisible();

  const overflowsBody = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflowsBody).toBe(false);
});

test("HSN Codes: create a code, see its rates, and import a CSV that updates it in place", async ({
  page,
}) => {
  await login(page);
  await page.goto("/settings/hsn-codes");

  const hsnCode = `TST${Date.now() % 100000}`;
  await page.getByRole("button", { name: "New", exact: true }).click();
  // The dialog title "New HSN Code" contains the "HSN code" label text, so
  // getByLabel is ambiguous here even with exact matching — target the
  // inputs by their field ids instead.
  await page.locator("#hsnCode").fill(hsnCode);
  await page.locator("#description").fill("Test HSN description");
  await page.locator("#cgstRate").fill("9");
  await page.locator("#sgstRate").fill("9");
  await page.locator("#igstRate").fill("18");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("HSN Code created.")).toBeVisible();

  const row = page.getByRole("row").filter({ hasText: hsnCode });
  await expect(row).toBeVisible();
  await expect(row.getByRole("cell").nth(2)).toContainText("9");

  // Fetch the real id for this row via the API, then import a CSV row
  // carrying that id with a changed CGST rate — this must update the
  // existing record, not create a duplicate.
  const listRes = await page.request.get("/api/hsn-codes?pageSize=1000&search=" + hsnCode);
  const listBody = (await listRes.json()) as { data: { id: string; hsnCode: string }[] };
  const existing = listBody.data.find((r) => r.hsnCode === hsnCode);
  expect(existing).toBeTruthy();

  const csv = `id,hsnCode,description,cgstRate,sgstRate,igstRate\n${existing!.id},${hsnCode},Updated via import,6,6,12\n`;

  await page.getByRole("button", { name: "Import" }).click();
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: "hsn-import.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await expect(page.getByText(/Imported: \d+ created, \d+ updated\./)).toBeVisible();

  await page.getByPlaceholder("Search…").fill(hsnCode);
  const updatedRow = page.getByRole("row").filter({ hasText: hsnCode });
  await expect(updatedRow).toHaveCount(1);
  await expect(updatedRow).toContainText("Updated via import");
});

test("Tax Engine: store cards, no create button, and selecting an engine persists", async ({
  page,
}) => {
  await login(page);

  // Reset first so this test is idempotent across repeated runs — an
  // earlier run (this test or another) may have already configured the
  // default (first) store's tax engine.
  const storesRes = await page.request.get("/api/stores/options");
  const stores = (await storesRes.json()) as { data: { id: string; name: string }[] };
  await page.request.patch(`/api/stores/${stores.data[0].id}`, {
    data: { taxEngineId: null },
  });

  await page.goto("/settings/tax-engine");

  await expect(page.getByRole("button", { name: "New", exact: true })).not.toBeVisible();

  const cards = page.locator("button[aria-pressed]");
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeGreaterThan(1);

  await page.getByText("Select tax engine…").click();
  await page.getByRole("option", { name: "India Standard" }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Tax engine updated.")).toBeVisible();

  await page.reload();
  await expect(page.getByText("India Standard")).toBeVisible();
});

test("Cash Denominations: store filter present, currency is a dropdown, and a new store starts empty", async ({
  page,
}) => {
  await login(page);

  await page.goto("/stores");
  await page.getByRole("button", { name: "New" }).click();
  const storeName = `Test Denom Store ${Date.now()}`;
  await page.getByLabel("Name").fill(storeName);
  await page.getByLabel("Address").fill("1 Test Denom Road");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Store created.")).toBeVisible();

  await page.goto("/cash-denominations");
  const cards = page.locator("button[aria-pressed]");
  await expect(cards.first()).toBeVisible();
  await page.getByRole("button", { name: storeName }).click();

  await expect(page.getByText("No records found.")).toBeVisible();

  await page.getByRole("button", { name: "New" }).click();
  await page.getByLabel("Value").fill("500");
  await page.getByText("Select type…").click();
  await page.getByRole("option", { name: "Note" }).click();
  await page.getByText("Select currency…").click();
  await page.getByRole("option", { name: "INR" }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Cash denomination created.")).toBeVisible();
  await expect(page.getByText("INR")).toBeVisible();
});

test("Cash Denominations: a store-scoped Admin sees only their own store card", async ({
  page,
}) => {
  test.skip(!ADMIN2_EMAIL || !ADMIN2_PASSWORD, "SEED_ADMIN2_EMAIL/PASSWORD not configured");
  await loginAs(page, ADMIN2_EMAIL!, ADMIN2_PASSWORD!);
  await page.goto("/cash-denominations");

  const cards = page.locator("button[aria-pressed]");
  await expect(cards.first()).toBeVisible();
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toHaveAttribute("aria-pressed", "true");
});

test("Tax status banner: shown for an unconfigured store, dismissible for the session", async ({
  page,
}) => {
  test.skip(!ADMIN2_EMAIL || !ADMIN2_PASSWORD, "SEED_ADMIN2_EMAIL/PASSWORD not configured");

  // Reset the demo store's tax engine first, as Super Admin — another test
  // in this suite (Tax Engine page) may have already configured it, and
  // this test needs it unconfigured to exercise the banner.
  await login(page);
  const storesRes = await page.request.get("/api/stores/options");
  const stores = (await storesRes.json()) as { data: { id: string; name: string }[] };
  const demoStore = stores.data.find((s) => s.name === "Demo Store") ?? stores.data[0];
  await page.request.patch(`/api/stores/${demoStore.id}`, { data: { taxEngineId: null } });
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);

  await loginAs(page, ADMIN2_EMAIL!, ADMIN2_PASSWORD!);

  const banner = page.getByText("Tax rules aren't configured for your store yet.");
  await expect(banner).toBeVisible();

  await page.getByRole("button", { name: "Dismiss" }).click();
  await expect(banner).not.toBeVisible();

  await page.reload();
  await expect(banner).not.toBeVisible();
});

test("Product Requests: create with two line items, view, and mark as sent", async ({ page }) => {
  test.skip(!ADMIN2_EMAIL || !ADMIN2_PASSWORD, "SEED_ADMIN2_EMAIL/PASSWORD not configured");
  await loginAs(page, ADMIN2_EMAIL!, ADMIN2_PASSWORD!);

  await page.goto("/product-requests");
  await page.getByRole("link", { name: "New Product Request" }).click();
  await expect(page).toHaveURL(/\/product-requests\/new$/);

  await page.getByText("Select supplier…").click();
  await page.getByRole("option").first().click();

  const productSelects = page.getByText("Select product…");
  await productSelects.first().click();
  await page.getByRole("option").first().click();
  await page.getByRole("button", { name: "Add item" }).click();
  await page.getByText("Select product…").click();
  await page.getByRole("option").last().click();

  const qtyInputs = page.getByPlaceholder("Qty");
  await qtyInputs.nth(0).fill("5");
  await qtyInputs.nth(1).fill("3");

  const [createResponse] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().endsWith("/api/product-requests") && res.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Save" }).click(),
  ]);
  await expect(page.getByText("Product request created.")).toBeVisible();
  const created = (await createResponse.json()) as { main: { id: string } };

  await page.goto(`/product-requests/${created.main.id}`);
  await expect(page.getByText("draft")).toBeVisible();
  await expect(page.getByRole("cell", { name: "5", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "3", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Request approved.")).toBeVisible();
  await expect(page.getByText("Approved", { exact: true })).toBeVisible();
});

test("Stock Inward: pickup from a Product Request marks it received", async ({ page }) => {
  test.skip(!ADMIN2_EMAIL || !ADMIN2_PASSWORD, "SEED_ADMIN2_EMAIL/PASSWORD not configured");
  await loginAs(page, ADMIN2_EMAIL!, ADMIN2_PASSWORD!);

  await page.goto("/product-requests/new");
  await page.getByText("Select supplier…").click();
  const supplierName = (await page.getByRole("option").first().textContent())!.trim();
  await page.getByRole("option").first().click();
  await page.getByText("Select product…").click();
  await page.getByRole("option").first().click();
  await page.getByPlaceholder("Qty").fill("4");
  const [prCreateResponse] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().endsWith("/api/product-requests") && res.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Save" }).click(),
  ]);
  await expect(page.getByText("Product request created.")).toBeVisible();
  const createdPr = (await prCreateResponse.json()) as {
    main: { id: string; documentNumber: string };
  };

  await page.goto(`/product-requests/${createdPr.main.id}`);
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Request approved.")).toBeVisible();

  await page.goto("/stock-inwards/new");
  await page.getByRole("button", { name: "Pickup" }).click();
  await page.getByText(createdPr.main.documentNumber, { exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Add to inward" }).click();
  await expect(page.getByText(`Picked up from ${createdPr.main.documentNumber}`)).toBeVisible();

  // The Product Request already had a supplier — the pickup should carry it over.
  await expect(page.getByRole("button", { name: supplierName, exact: true })).toBeVisible();

  await page.getByText("Select warehouse…").click();
  await page.getByRole("option").first().click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Stock inward recorded.")).toBeVisible();
  await expect(page).toHaveURL(/\/stock-inwards$/);

  await page.goto(`/product-requests/${createdPr.main.id}`);
  await expect(page.locator("span").filter({ hasText: "Received" })).toBeVisible();
});

test("Stock Inward: direct entry without pickup saves with no linked purchase order", async ({
  page,
}) => {
  test.skip(!ADMIN2_EMAIL || !ADMIN2_PASSWORD, "SEED_ADMIN2_EMAIL/PASSWORD not configured");
  await loginAs(page, ADMIN2_EMAIL!, ADMIN2_PASSWORD!);

  await page.goto("/stock-inwards/new");
  await page.getByText("Select warehouse…").click();
  await page.getByRole("option").first().click();
  await page.getByText("Select product…").click();
  await page.getByRole("option").first().click();
  await page.getByPlaceholder("Accepted").fill("3");
  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().endsWith("/api/stock-inwards") && res.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Save" }).click(),
  ]);
  await expect(page.getByText("Stock inward recorded.")).toBeVisible();
  const created = (await response.json()) as { main: { purchaseOrderId: string | null } };
  expect(created.main.purchaseOrderId).toBeNull();
});

test("Stock Inward: edit and delete a direct entry", async ({ page }) => {
  test.skip(!ADMIN2_EMAIL || !ADMIN2_PASSWORD, "SEED_ADMIN2_EMAIL/PASSWORD not configured");
  await loginAs(page, ADMIN2_EMAIL!, ADMIN2_PASSWORD!);

  await page.goto("/stock-inwards/new");
  await page.getByText("Select warehouse…").click();
  await page.getByRole("option").first().click();
  await page.getByText("Select product…").click();
  await page.getByRole("option").first().click();
  await page.getByPlaceholder("Accepted").fill("5");
  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().endsWith("/api/stock-inwards") && res.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Save" }).click(),
  ]);
  await expect(page.getByText("Stock inward recorded.")).toBeVisible();
  const created = (await response.json()) as { main: { id: string } };

  await page.goto(`/stock-inwards/${created.main.id}`);
  await page.getByRole("link", { name: "Edit" }).click();
  await expect(page.getByPlaceholder("Accepted")).toHaveValue("5");
  await page.getByPlaceholder("Accepted").fill("7");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Stock inward updated.")).toBeVisible();
  await expect(page.getByRole("cell", { name: "7", exact: true })).toBeVisible();

  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Stock inward deleted.")).toBeVisible();
  await expect(page).toHaveURL("/stock-inwards");

  const res = await page.request.get(`/api/stock-inwards/${created.main.id}`);
  expect(res.status()).toBe(404);
});

test("Stock Inward: cannot reduce quantity below what damage/blocks already consumed", async ({
  page,
}) => {
  test.skip(!ADMIN2_EMAIL || !ADMIN2_PASSWORD, "SEED_ADMIN2_EMAIL/PASSWORD not configured");
  await loginAs(page, ADMIN2_EMAIL!, ADMIN2_PASSWORD!);

  await page.goto("/stock-inwards/new");
  await page.getByText("Select warehouse…").click();
  const warehouseName = (await page.getByRole("option").first().textContent())!.trim();
  await page.getByRole("option").first().click();
  await page.getByText("Select product…").click();
  const productName = (await page.getByRole("option").first().textContent())!.trim();
  await page.getByRole("option").first().click();
  // Large, deliberately lopsided numbers — this dev database has real
  // accumulated stock for the "first" product from many earlier test runs,
  // so a small delta wouldn't reliably push the *total* negative. A 99999
  // reduction will, regardless of whatever history already exists.
  await page.getByPlaceholder("Accepted").fill("100000");
  const [inwardResponse] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().endsWith("/api/stock-inwards") && res.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Save" }).click(),
  ]);
  await expect(page.getByText("Stock inward recorded.")).toBeVisible();
  const createdInward = (await inwardResponse.json()) as { main: { id: string } };

  await page.goto("/stock-damages/new");
  await page.getByText("Select warehouse…").click();
  await page.getByRole("option", { name: warehouseName, exact: true }).click();
  await page.getByText("Select product…").click();
  await page.getByRole("option", { name: productName, exact: true }).click();
  await page.getByPlaceholder("Qty").fill("99999");
  await page.getByText("Select reason…").click();
  await page.getByRole("option").first().click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Stock damage recorded.")).toBeVisible();

  await page.goto(`/stock-inwards/${createdInward.main.id}/edit`);
  await page.getByPlaceholder("Accepted").fill("1");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(/would leave -?\d+ available/)).toBeVisible();
});

test("Stock Damage: succeeds within available stock, rejected beyond it", async ({ page }) => {
  test.skip(!ADMIN2_EMAIL || !ADMIN2_PASSWORD, "SEED_ADMIN2_EMAIL/PASSWORD not configured");
  await loginAs(page, ADMIN2_EMAIL!, ADMIN2_PASSWORD!);

  await page.goto("/stock-inwards/new");
  await page.getByText("Select warehouse…").click();
  const warehouseName = (await page.getByRole("option").first().textContent())!.trim();
  await page.getByRole("option").first().click();
  await page.getByText("Select product…").click();
  const productName = (await page.getByRole("option").first().textContent())!.trim();
  await page.getByRole("option").first().click();
  await page.getByPlaceholder("Accepted").fill("10");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Stock inward recorded.")).toBeVisible();

  await page.goto("/stock-damages/new");
  await page.getByText("Select warehouse…").click();
  await page.getByRole("option", { name: warehouseName, exact: true }).click();
  await page.getByText("Select product…").click();
  await page.getByRole("option", { name: productName, exact: true }).click();
  await page.getByPlaceholder("Qty").fill("5");
  await page.getByText("Select reason…").click();
  await page.getByRole("option").first().click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Stock damage recorded.")).toBeVisible();
  await expect(page).toHaveURL(/\/stock-damages$/);

  await page.goto("/stock-damages/new");
  await page.getByText("Select warehouse…").click();
  await page.getByRole("option", { name: warehouseName, exact: true }).click();
  await page.getByText("Select product…").click();
  await page.getByRole("option", { name: productName, exact: true }).click();
  await page.getByPlaceholder("Qty").fill("999999");
  await page.getByText("Select reason…").click();
  await page.getByRole("option").first().click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(/only \d+ available/)).toBeVisible();
  await expect(page).toHaveURL(/\/stock-damages\/new$/);
});

test("Stock Damage: edit and delete", async ({ page }) => {
  test.skip(!ADMIN2_EMAIL || !ADMIN2_PASSWORD, "SEED_ADMIN2_EMAIL/PASSWORD not configured");
  await loginAs(page, ADMIN2_EMAIL!, ADMIN2_PASSWORD!);

  await page.goto("/stock-inwards/new");
  await page.getByText("Select warehouse…").click();
  await page.getByRole("option").first().click();
  await page.getByText("Select product…").click();
  await page.getByRole("option").first().click();
  await page.getByPlaceholder("Accepted").fill("10");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Stock inward recorded.")).toBeVisible();

  await page.goto("/stock-damages/new");
  await page.getByText("Select warehouse…").click();
  await page.getByRole("option").first().click();
  await page.getByText("Select product…").click();
  await page.getByRole("option").first().click();
  await page.getByPlaceholder("Qty").fill("2");
  await page.getByText("Select reason…").click();
  await page.getByRole("option").first().click();
  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().endsWith("/api/stock-damages") && res.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Save" }).click(),
  ]);
  await expect(page.getByText("Stock damage recorded.")).toBeVisible();
  const created = (await response.json()) as { main: { id: string } };

  await page.goto(`/stock-damages/${created.main.id}`);
  await page.getByRole("link", { name: "Edit" }).click();
  await expect(page.getByPlaceholder("Qty")).toHaveValue("2");
  await page.getByPlaceholder("Qty").fill("4");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Stock damage updated.")).toBeVisible();
  await expect(page.getByRole("cell", { name: "4", exact: true })).toBeVisible();

  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Stock damage deleted.")).toBeVisible();
  await expect(page).toHaveURL("/stock-damages");

  const res = await page.request.get(`/api/stock-damages/${created.main.id}`);
  expect(res.status()).toBe(404);
});

test("Stock Block: create, appears in Stale Blocks when overdue, then release", async ({
  page,
}) => {
  test.skip(!ADMIN2_EMAIL || !ADMIN2_PASSWORD, "SEED_ADMIN2_EMAIL/PASSWORD not configured");
  await loginAs(page, ADMIN2_EMAIL!, ADMIN2_PASSWORD!);

  await page.goto("/stock-blocks/new");
  await page.getByText("Select warehouse…").click();
  await page.getByRole("option").first().click();
  await page.getByLabel("Review by date").fill("2020-01-01");
  await page.getByText("Select product…").click();
  await page.getByRole("option").first().click();
  await page.getByPlaceholder("Qty").fill("2");
  await page.getByText("Select reason…").click();
  await page.getByRole("option").first().click();
  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().endsWith("/api/stock-blocks") && res.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Save" }).click(),
  ]);
  await expect(page.getByText("Stock block recorded.")).toBeVisible();
  const created = (await response.json()) as { main: { id: string; documentNumber: string } };

  await page.goto("/stock-blocks");
  await expect(page.getByRole("cell", { name: created.main.documentNumber })).toBeVisible();

  await page.goto("/stock-blocks/stale");
  await expect(page.getByRole("cell", { name: created.main.documentNumber })).toBeVisible();

  await page.goto(`/stock-blocks/${created.main.id}`);
  await page.getByRole("button", { name: "Release" }).click();
  await expect(page.getByText("Item released.")).toBeVisible();
  await expect(page.getByText("released", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit" })).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Delete" })).not.toBeVisible();

  await page.goto("/stock-blocks/stale");
  await expect(page.getByRole("cell", { name: created.main.documentNumber })).not.toBeVisible();
});

test("Stock Block: edit and delete while all items are still active", async ({ page }) => {
  test.skip(!ADMIN2_EMAIL || !ADMIN2_PASSWORD, "SEED_ADMIN2_EMAIL/PASSWORD not configured");
  await loginAs(page, ADMIN2_EMAIL!, ADMIN2_PASSWORD!);

  await page.goto("/stock-blocks/new");
  await page.getByText("Select warehouse…").click();
  await page.getByRole("option").first().click();
  await page.getByText("Select product…").click();
  await page.getByRole("option").first().click();
  await page.getByPlaceholder("Qty").fill("3");
  await page.getByText("Select reason…").click();
  await page.getByRole("option").first().click();
  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().endsWith("/api/stock-blocks") && res.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Save" }).click(),
  ]);
  await expect(page.getByText("Stock block recorded.")).toBeVisible();
  const created = (await response.json()) as { main: { id: string } };

  await page.goto(`/stock-blocks/${created.main.id}`);
  await page.getByRole("link", { name: "Edit" }).click();
  await expect(page.getByPlaceholder("Qty")).toHaveValue("3");
  await page.getByPlaceholder("Qty").fill("9");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Stock block updated.")).toBeVisible();
  await expect(page.getByRole("cell", { name: "9", exact: true })).toBeVisible();

  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Stock block deleted.")).toBeVisible();
  await expect(page).toHaveURL("/stock-blocks");

  const res = await page.request.get(`/api/stock-blocks/${created.main.id}`);
  expect(res.status()).toBe(404);
});

test("Product supplier pricing: adding a price auto-fills cost on a Product Request", async ({
  page,
}) => {
  test.skip(!ADMIN2_EMAIL || !ADMIN2_PASSWORD, "SEED_ADMIN2_EMAIL/PASSWORD not configured");
  await loginAs(page, ADMIN2_EMAIL!, ADMIN2_PASSWORD!);

  await page.goto("/products");
  await page.locator("[data-navcard]").first().click();
  await expect(page).toHaveURL(/\/products\/[0-9a-f-]+$/);
  const productName = (await page.locator("dd").first().textContent())!.trim();

  await page.getByRole("button", { name: "Add price" }).click();
  await page.getByText("Select supplier…").click();
  const supplierName = (await page.getByRole("option").first().textContent())!.trim();
  await page.getByRole("option").first().click();
  await page.getByLabel("Cost").fill("123.45");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Supplier price added.")).toBeVisible();
  await expect(page.getByRole("cell", { name: "123.45" })).toBeVisible();

  await page.goto("/product-requests/new");
  await page.getByText("Select supplier…").click();
  await page.getByRole("option", { name: supplierName, exact: true }).click();
  await page.getByText("Select product…").click();
  await page.getByRole("option", { name: productName, exact: true }).click();
  await expect(page.getByPlaceholder("Optional")).toHaveValue("123.45");
});

test("Product Requests: edit while draft, approve, revert, then delete", async ({ page }) => {
  test.skip(!ADMIN2_EMAIL || !ADMIN2_PASSWORD, "SEED_ADMIN2_EMAIL/PASSWORD not configured");
  await loginAs(page, ADMIN2_EMAIL!, ADMIN2_PASSWORD!);
  page.on("dialog", (dialog) => dialog.accept());

  await page.goto("/product-requests/new");
  await page.getByText("Select supplier…").click();
  await page.getByRole("option").first().click();
  await page.getByText("Select product…").click();
  await page.getByRole("option").first().click();
  await page.getByPlaceholder("Qty").fill("2");
  const [createResponse] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().endsWith("/api/product-requests") && res.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Save" }).click(),
  ]);
  await expect(page.getByText("Product request created.")).toBeVisible();
  const created = (await createResponse.json()) as { main: { id: string } };

  await page.goto(`/product-requests/${created.main.id}`);
  await page.getByRole("link", { name: "Edit" }).click();
  await expect(page).toHaveURL(new RegExp(`/product-requests/${created.main.id}/edit$`));
  await expect(page.getByPlaceholder("Qty")).toHaveValue("2");
  await page.getByPlaceholder("Qty").fill("6");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Product request updated.")).toBeVisible();
  await expect(page).toHaveURL(`/product-requests/${created.main.id}`);
  await expect(page.getByRole("cell", { name: "6", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Request approved.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit" })).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Delete" })).not.toBeVisible();

  await page.getByRole("button", { name: "Revert to Draft" }).click();
  await expect(page.getByText("Request reverted to draft.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit" })).toBeVisible();

  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Product request deleted.")).toBeVisible();
  await expect(page).toHaveURL("/product-requests");

  const res = await page.request.get(`/api/product-requests/${created.main.id}`);
  expect(res.status()).toBe(404);
});

test("Stock Transfer: same-store transfer completes immediately", async ({ page }) => {
  test.skip(!ADMIN2_EMAIL || !ADMIN2_PASSWORD, "SEED_ADMIN2_EMAIL/PASSWORD not configured");
  await loginAs(page, ADMIN2_EMAIL!, ADMIN2_PASSWORD!);

  // A second warehouse in the same store, so there's somewhere to send to.
  await page.goto("/warehouses");
  const secondWarehouseName = `Test Transfer Destination ${Date.now()}`;
  await page.getByRole("button", { name: "New" }).click();
  await page.getByLabel("Name").fill(secondWarehouseName);
  await page.getByLabel("Address").fill("456 Transfer Test Road");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Warehouse created.")).toBeVisible();

  await page.goto("/stock-inwards/new");
  await page.getByText("Select warehouse…").click();
  const sourceWarehouseName = (await page.getByRole("option").first().textContent())!.trim();
  await page.getByRole("option").first().click();
  await page.getByText("Select product…").click();
  const productName = (await page.getByRole("option").first().textContent())!.trim();
  await page.getByRole("option").first().click();
  await page.getByPlaceholder("Accepted").fill("50");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Stock inward recorded.")).toBeVisible();

  await page.goto("/stock-transfers/new");
  await page.getByText("Select warehouse…").click();
  await page.getByRole("option", { name: sourceWarehouseName, exact: true }).click();
  await page.getByText("Select destination warehouse…").click();
  await page.getByRole("option", { name: secondWarehouseName, exact: true }).click();
  await page.getByText("Select product…").click();
  await page.getByRole("option", { name: productName, exact: true }).click();
  await page.getByPlaceholder("Qty").fill("5");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Stock transfer completed.")).toBeVisible();
  await expect(page).toHaveURL("/stock-transfers");

  await expect(page.locator("table tbody").getByText("Accepted").first()).toBeVisible();
});

test("Stock Transfer: cross-store request, receive, and reflect on both sides", async ({
  page,
}) => {
  test.skip(!ADMIN2_EMAIL || !ADMIN2_PASSWORD, "SEED_ADMIN2_EMAIL/PASSWORD not configured");
  test.setTimeout(240_000); // setup + two full logins + several page loads

  await login(page);

  const rolesRes = await page.request.get("/api/roles?pageSize=200");
  const roles = (await rolesRes.json()) as { data: { id: string; name: string }[] };
  const adminRole = roles.data.find((r) => r.name === "Admin")!;

  const storeName = `Test Transfer Store B ${Date.now()}`;
  const storeRes = await page.request.post("/api/stores", {
    data: { name: storeName, address: "1 Transfer B Road" },
  });
  const store = (await storeRes.json()) as { id: string };

  const warehouseName = `Test Transfer B Warehouse ${Date.now()}`;
  await page.request.post("/api/warehouses", {
    data: { name: warehouseName, address: "2 Transfer B Road", storeId: store.id },
  });

  const userEmail = `transfer-b-${Date.now()}@example.com`;
  const userPassword = "TempPass123!";
  await page.request.post("/api/users", {
    data: {
      name: "Transfer B User",
      email: userEmail,
      password: userPassword,
      roleId: adminRole.id,
      storeId: store.id,
    },
  });

  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);

  // Store A (ADMIN2) requests a transfer to Store B.
  await loginAs(page, ADMIN2_EMAIL!, ADMIN2_PASSWORD!);

  await page.goto("/stock-inwards/new");
  await page.getByText("Select warehouse…").click();
  const sourceWarehouseName = (await page.getByRole("option").first().textContent())!.trim();
  await page.getByRole("option").first().click();
  await page.getByText("Select product…").click();
  const productName = (await page.getByRole("option").first().textContent())!.trim();
  await page.getByRole("option").first().click();
  await page.getByPlaceholder("Accepted").fill("50");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Stock inward recorded.")).toBeVisible();

  await page.goto("/stock-transfers/new");
  await page.getByText("Select warehouse…").click();
  await page.getByRole("option", { name: sourceWarehouseName, exact: true }).click();
  await page.getByText("Different store").click();
  await page.getByText("Select destination store…").click();
  await page.getByRole("option", { name: storeName, exact: true }).click();
  await page.getByText("Select product…").click();
  await page.getByRole("option", { name: productName, exact: true }).click();
  await page.getByPlaceholder("Qty").fill("5");
  const [transferResponse] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().endsWith("/api/stock-transfers") && res.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Save" }).click(),
  ]);
  await expect(page.getByText("Stock transfer requested.")).toBeVisible();
  const createdTransfer = (await transferResponse.json()) as {
    main: { id: string; documentNumber: string };
  };

  await page.goto("/stock-transfers");
  await expect(page.locator("table tbody").getByText("Pending").first()).toBeVisible();

  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);

  // Store B receives it.
  await loginAs(page, userEmail, userPassword);

  await page.goto("/stock-transfers");
  await page.getByText("Receive", { exact: true }).click();
  await expect(page.getByRole("cell", { name: createdTransfer.main.documentNumber })).toBeVisible();

  await page.goto(`/stock-transfers/${createdTransfer.main.id}`);
  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/api/warehouses?")),
    page.getByRole("link", { name: "Receive" }).click(),
  ]);
  await expect(page.getByText("Select warehouse…")).toBeVisible();
  await page.getByText("Select warehouse…").click();
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.getByRole("option", { name: warehouseName, exact: true }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Stock transfer received.")).toBeVisible();
  await expect(page.locator("span").filter({ hasText: "Accepted" })).toBeVisible();

  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);

  // Store A sees it as accepted too.
  await loginAs(page, ADMIN2_EMAIL!, ADMIN2_PASSWORD!);
  await page.goto(`/stock-transfers/${createdTransfer.main.id}`);
  await expect(page.locator("span").filter({ hasText: "Accepted" })).toBeVisible();
});

test("Stock Transfer: the requester can cancel a pending cross-store request", async ({ page }) => {
  test.skip(!ADMIN2_EMAIL || !ADMIN2_PASSWORD, "SEED_ADMIN2_EMAIL/PASSWORD not configured");

  await login(page);
  const storeName = `Test Transfer Cancel Store ${Date.now()}`;
  await page.request.post("/api/stores", {
    data: { name: storeName, address: "1 Cancel Test Road" },
  });
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);

  await loginAs(page, ADMIN2_EMAIL!, ADMIN2_PASSWORD!);
  await page.goto("/stock-transfers/new");
  await page.getByText("Select warehouse…").click();
  await page.getByRole("option").first().click();
  await page.getByText("Different store").click();
  await page.getByText("Select destination store…").click();
  await page.getByRole("option", { name: storeName, exact: true }).click();
  await page.getByText("Select product…").click();
  await page.getByRole("option").first().click();
  await page.getByPlaceholder("Qty").fill("1");
  const [transferResponse] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().endsWith("/api/stock-transfers") && res.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Save" }).click(),
  ]);
  await expect(page.getByText("Stock transfer requested.")).toBeVisible();
  const created = (await transferResponse.json()) as { main: { id: string } };

  await page.goto(`/stock-transfers/${created.main.id}`);
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Transfer cancelled.")).toBeVisible();

  await page.goto(`/stock-transfers/${created.main.id}`);
  await expect(page.locator("span").filter({ hasText: "Cancelled" })).toBeVisible();
});

test("Stock Transfer: edit and delete a pending request, blocked once accepted", async ({
  page,
}) => {
  test.skip(!ADMIN2_EMAIL || !ADMIN2_PASSWORD, "SEED_ADMIN2_EMAIL/PASSWORD not configured");

  await login(page);
  const storeName = `Test Transfer Edit Store ${Date.now()}`;
  await page.request.post("/api/stores", {
    data: { name: storeName, address: "1 Edit Test Road" },
  });
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);

  await loginAs(page, ADMIN2_EMAIL!, ADMIN2_PASSWORD!);
  await page.goto("/stock-transfers/new");
  await page.getByText("Select warehouse…").click();
  await page.getByRole("option").first().click();
  await page.getByText("Different store").click();
  await page.getByText("Select destination store…").click();
  await page.getByRole("option", { name: storeName, exact: true }).click();
  await page.getByText("Select product…").click();
  await page.getByRole("option").first().click();
  await page.getByPlaceholder("Qty").fill("3");
  const [transferResponse] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().endsWith("/api/stock-transfers") && res.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Save" }).click(),
  ]);
  await expect(page.getByText("Stock transfer requested.")).toBeVisible();
  const created = (await transferResponse.json()) as { main: { id: string } };

  await page.goto(`/stock-transfers/${created.main.id}`);
  await page.getByRole("link", { name: "Edit" }).click();
  await expect(page.getByPlaceholder("Qty")).toHaveValue("3");
  await page.getByPlaceholder("Qty").fill("7");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Stock transfer updated.")).toBeVisible();
  await expect(page.getByRole("cell", { name: "7", exact: true })).toBeVisible();

  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Stock transfer deleted.")).toBeVisible();
  await expect(page).toHaveURL("/stock-transfers");

  const res = await page.request.get(`/api/stock-transfers/${created.main.id}`);
  expect(res.status()).toBe(404);
});

test("Quality Check: succeeds within available stock, rejected beyond it", async ({ page }) => {
  test.skip(!ADMIN2_EMAIL || !ADMIN2_PASSWORD, "SEED_ADMIN2_EMAIL/PASSWORD not configured");
  await loginAs(page, ADMIN2_EMAIL!, ADMIN2_PASSWORD!);

  await page.goto("/stock-inwards/new");
  await page.getByText("Select warehouse…").click();
  const warehouseName = (await page.getByRole("option").first().textContent())!.trim();
  await page.getByRole("option").first().click();
  await page.getByText("Select product…").click();
  const productName = (await page.getByRole("option").first().textContent())!.trim();
  await page.getByRole("option").first().click();
  await page.getByPlaceholder("Accepted").fill("10");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Stock inward recorded.")).toBeVisible();

  await page.goto("/stock-quality-checks/new");
  await page.getByText("Select warehouse…").click();
  await page.getByRole("option", { name: warehouseName, exact: true }).click();
  await page.getByText("Select product…").click();
  await page.getByRole("option", { name: productName, exact: true }).click();
  await page.getByPlaceholder("Qty").fill("5");
  await page.getByText("Select reason…").click();
  await page.getByRole("option").first().click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Quality check recorded.")).toBeVisible();
  await expect(page).toHaveURL(/\/stock-quality-checks$/);

  await page.goto("/stock-quality-checks/new");
  await page.getByText("Select warehouse…").click();
  await page.getByRole("option", { name: warehouseName, exact: true }).click();
  await page.getByText("Select product…").click();
  await page.getByRole("option", { name: productName, exact: true }).click();
  await page.getByPlaceholder("Qty").fill("999999");
  await page.getByText("Select reason…").click();
  await page.getByRole("option").first().click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(/only \d+ available/)).toBeVisible();
  await expect(page).toHaveURL(/\/stock-quality-checks\/new$/);
});

test("Quality Check: edit and delete", async ({ page }) => {
  test.skip(!ADMIN2_EMAIL || !ADMIN2_PASSWORD, "SEED_ADMIN2_EMAIL/PASSWORD not configured");
  await loginAs(page, ADMIN2_EMAIL!, ADMIN2_PASSWORD!);

  await page.goto("/stock-inwards/new");
  await page.getByText("Select warehouse…").click();
  await page.getByRole("option").first().click();
  await page.getByText("Select product…").click();
  await page.getByRole("option").first().click();
  await page.getByPlaceholder("Accepted").fill("10");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Stock inward recorded.")).toBeVisible();

  await page.goto("/stock-quality-checks/new");
  await page.getByText("Select warehouse…").click();
  await page.getByRole("option").first().click();
  await page.getByText("Select product…").click();
  await page.getByRole("option").first().click();
  await page.getByPlaceholder("Qty").fill("2");
  await page.getByText("Select reason…").click();
  await page.getByRole("option").first().click();
  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().endsWith("/api/stock-quality-checks") && res.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Save" }).click(),
  ]);
  await expect(page.getByText("Quality check recorded.")).toBeVisible();
  const created = (await response.json()) as { main: { id: string } };

  await page.goto(`/stock-quality-checks/${created.main.id}`);
  await page.getByRole("link", { name: "Edit" }).click();
  await expect(page.getByPlaceholder("Qty")).toHaveValue("2");
  await page.getByPlaceholder("Qty").fill("4");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Quality check updated.")).toBeVisible();
  await expect(page.getByRole("cell", { name: "4", exact: true })).toBeVisible();

  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Quality check deleted.")).toBeVisible();
  await expect(page).toHaveURL("/stock-quality-checks");

  const res = await page.request.get(`/api/stock-quality-checks/${created.main.id}`);
  expect(res.status()).toBe(404);
});

test("Positive Adjustment: create, edit, and delete", async ({ page }) => {
  test.skip(!ADMIN2_EMAIL || !ADMIN2_PASSWORD, "SEED_ADMIN2_EMAIL/PASSWORD not configured");
  await loginAs(page, ADMIN2_EMAIL!, ADMIN2_PASSWORD!);

  await page.goto("/stock-positive-adjustments/new");
  await page.getByText("Select warehouse…").click();
  await page.getByRole("option").first().click();
  await page.getByText("Select product…").click();
  await page.getByRole("option").first().click();
  await page.getByPlaceholder("Qty").fill("2");
  await page.getByText("Select reason…").click();
  await page.getByRole("option").first().click();
  const [response] = await Promise.all([
    page.waitForResponse(
      (res) =>
        res.url().endsWith("/api/stock-positive-adjustments") && res.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Save" }).click(),
  ]);
  await expect(page.getByText("Positive adjustment recorded.")).toBeVisible();
  const created = (await response.json()) as { main: { id: string } };

  await page.goto(`/stock-positive-adjustments/${created.main.id}`);
  await page.getByRole("link", { name: "Edit" }).click();
  await expect(page.getByPlaceholder("Qty")).toHaveValue("2");
  await page.getByPlaceholder("Qty").fill("4");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Positive adjustment updated.")).toBeVisible();
  await expect(page.getByRole("cell", { name: "4", exact: true })).toBeVisible();

  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Positive adjustment deleted.")).toBeVisible();
  await expect(page).toHaveURL("/stock-positive-adjustments");

  const res = await page.request.get(`/api/stock-positive-adjustments/${created.main.id}`);
  expect(res.status()).toBe(404);
});

test("Positive Adjustment: cannot reduce quantity below what's already consumed elsewhere", async ({
  page,
}) => {
  test.skip(!ADMIN2_EMAIL || !ADMIN2_PASSWORD, "SEED_ADMIN2_EMAIL/PASSWORD not configured");
  await loginAs(page, ADMIN2_EMAIL!, ADMIN2_PASSWORD!);

  await page.goto("/stock-positive-adjustments/new");
  await page.getByText("Select warehouse…").click();
  const warehouseName = (await page.getByRole("option").first().textContent())!.trim();
  await page.getByRole("option").first().click();
  await page.getByText("Select product…").click();
  const productName = (await page.getByRole("option").first().textContent())!.trim();
  await page.getByRole("option").first().click();
  // Large, deliberately lopsided numbers — this dev database has real
  // accumulated stock from many earlier test runs, so a small delta
  // wouldn't reliably push the *total* negative.
  await page.getByPlaceholder("Qty").fill("100000");
  await page.getByText("Select reason…").click();
  await page.getByRole("option").first().click();
  const [adjResponse] = await Promise.all([
    page.waitForResponse(
      (res) =>
        res.url().endsWith("/api/stock-positive-adjustments") && res.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Save" }).click(),
  ]);
  await expect(page.getByText("Positive adjustment recorded.")).toBeVisible();
  const createdAdj = (await adjResponse.json()) as { main: { id: string } };

  await page.goto("/stock-damages/new");
  await page.getByText("Select warehouse…").click();
  await page.getByRole("option", { name: warehouseName, exact: true }).click();
  await page.getByText("Select product…").click();
  await page.getByRole("option", { name: productName, exact: true }).click();
  await page.getByPlaceholder("Qty").fill("99999");
  await page.getByText("Select reason…").click();
  await page.getByRole("option").first().click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Stock damage recorded.")).toBeVisible();

  await page.goto(`/stock-positive-adjustments/${createdAdj.main.id}/edit`);
  await page.getByPlaceholder("Qty").fill("1");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(/would leave -?\d+ available/)).toBeVisible();
});

test("Negative Adjustment: succeeds within available stock, rejected beyond it", async ({
  page,
}) => {
  test.skip(!ADMIN2_EMAIL || !ADMIN2_PASSWORD, "SEED_ADMIN2_EMAIL/PASSWORD not configured");
  await loginAs(page, ADMIN2_EMAIL!, ADMIN2_PASSWORD!);

  await page.goto("/stock-inwards/new");
  await page.getByText("Select warehouse…").click();
  const warehouseName = (await page.getByRole("option").first().textContent())!.trim();
  await page.getByRole("option").first().click();
  await page.getByText("Select product…").click();
  const productName = (await page.getByRole("option").first().textContent())!.trim();
  await page.getByRole("option").first().click();
  await page.getByPlaceholder("Accepted").fill("10");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Stock inward recorded.")).toBeVisible();

  await page.goto("/stock-negative-adjustments/new");
  await page.getByText("Select warehouse…").click();
  await page.getByRole("option", { name: warehouseName, exact: true }).click();
  await page.getByText("Select product…").click();
  await page.getByRole("option", { name: productName, exact: true }).click();
  await page.getByPlaceholder("Qty").fill("5");
  await page.getByText("Select reason…").click();
  await page.getByRole("option").first().click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Negative adjustment recorded.")).toBeVisible();
  await expect(page).toHaveURL(/\/stock-negative-adjustments$/);

  await page.goto("/stock-negative-adjustments/new");
  await page.getByText("Select warehouse…").click();
  await page.getByRole("option", { name: warehouseName, exact: true }).click();
  await page.getByText("Select product…").click();
  await page.getByRole("option", { name: productName, exact: true }).click();
  await page.getByPlaceholder("Qty").fill("999999");
  await page.getByText("Select reason…").click();
  await page.getByRole("option").first().click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(/only \d+ available/)).toBeVisible();
  await expect(page).toHaveURL(/\/stock-negative-adjustments\/new$/);
});

test("Negative Adjustment: edit and delete", async ({ page }) => {
  test.skip(!ADMIN2_EMAIL || !ADMIN2_PASSWORD, "SEED_ADMIN2_EMAIL/PASSWORD not configured");
  await loginAs(page, ADMIN2_EMAIL!, ADMIN2_PASSWORD!);

  await page.goto("/stock-inwards/new");
  await page.getByText("Select warehouse…").click();
  await page.getByRole("option").first().click();
  await page.getByText("Select product…").click();
  await page.getByRole("option").first().click();
  await page.getByPlaceholder("Accepted").fill("10");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Stock inward recorded.")).toBeVisible();

  await page.goto("/stock-negative-adjustments/new");
  await page.getByText("Select warehouse…").click();
  await page.getByRole("option").first().click();
  await page.getByText("Select product…").click();
  await page.getByRole("option").first().click();
  await page.getByPlaceholder("Qty").fill("2");
  await page.getByText("Select reason…").click();
  await page.getByRole("option").first().click();
  const [response] = await Promise.all([
    page.waitForResponse(
      (res) =>
        res.url().endsWith("/api/stock-negative-adjustments") && res.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Save" }).click(),
  ]);
  await expect(page.getByText("Negative adjustment recorded.")).toBeVisible();
  const created = (await response.json()) as { main: { id: string } };

  await page.goto(`/stock-negative-adjustments/${created.main.id}`);
  await page.getByRole("link", { name: "Edit" }).click();
  await expect(page.getByPlaceholder("Qty")).toHaveValue("2");
  await page.getByPlaceholder("Qty").fill("4");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Negative adjustment updated.")).toBeVisible();
  await expect(page.getByRole("cell", { name: "4", exact: true })).toBeVisible();

  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Negative adjustment deleted.")).toBeVisible();
  await expect(page).toHaveURL("/stock-negative-adjustments");

  const res = await page.request.get(`/api/stock-negative-adjustments/${created.main.id}`);
  expect(res.status()).toBe(404);
});

test("Opening Balance: create, edit, and delete", async ({ page }) => {
  test.skip(!ADMIN2_EMAIL || !ADMIN2_PASSWORD, "SEED_ADMIN2_EMAIL/PASSWORD not configured");
  await loginAs(page, ADMIN2_EMAIL!, ADMIN2_PASSWORD!);

  await page.goto("/stock-openings/new");
  await page.getByText("Select warehouse…").click();
  await page.getByRole("option").first().click();
  await page.getByText("Select product…").click();
  await page.getByRole("option").first().click();
  await page.getByPlaceholder("Qty").fill("2");
  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().endsWith("/api/stock-openings") && res.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Save" }).click(),
  ]);
  await expect(page.getByText("Opening balance recorded.")).toBeVisible();
  const created = (await response.json()) as { main: { id: string } };

  await page.goto(`/stock-openings/${created.main.id}`);
  await page.getByRole("link", { name: "Edit" }).click();
  await expect(page.getByPlaceholder("Qty")).toHaveValue("2");
  await page.getByPlaceholder("Qty").fill("4");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Opening balance updated.")).toBeVisible();
  await expect(page.getByRole("cell", { name: "4", exact: true })).toBeVisible();

  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Opening balance deleted.")).toBeVisible();
  await expect(page).toHaveURL("/stock-openings");

  const res = await page.request.get(`/api/stock-openings/${created.main.id}`);
  expect(res.status()).toBe(404);
});

test("Opening Balance: cannot reduce quantity below what's already consumed elsewhere", async ({
  page,
}) => {
  test.skip(!ADMIN2_EMAIL || !ADMIN2_PASSWORD, "SEED_ADMIN2_EMAIL/PASSWORD not configured");
  await loginAs(page, ADMIN2_EMAIL!, ADMIN2_PASSWORD!);

  await page.goto("/stock-openings/new");
  await page.getByText("Select warehouse…").click();
  const warehouseName = (await page.getByRole("option").first().textContent())!.trim();
  await page.getByRole("option").first().click();
  await page.getByText("Select product…").click();
  const productName = (await page.getByRole("option").first().textContent())!.trim();
  await page.getByRole("option").first().click();
  // Very large, deliberately lopsided numbers — by this point in the suite a
  // heavily-reused "first" product can have a large accumulated available
  // total, so the delta being tested must dwarf any plausible accumulation.
  await page.getByPlaceholder("Qty").fill("50000000");
  const [openingResponse] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().endsWith("/api/stock-openings") && res.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Save" }).click(),
  ]);
  await expect(page.getByText("Opening balance recorded.")).toBeVisible();
  const createdOpening = (await openingResponse.json()) as { main: { id: string } };

  await page.goto("/stock-damages/new");
  await page.getByText("Select warehouse…").click();
  await page.getByRole("option", { name: warehouseName, exact: true }).click();
  await page.getByText("Select product…").click();
  await page.getByRole("option", { name: productName, exact: true }).click();
  await page.getByPlaceholder("Qty").fill("49999999");
  await page.getByText("Select reason…").click();
  await page.getByRole("option").first().click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Stock damage recorded.")).toBeVisible();

  await page.goto(`/stock-openings/${createdOpening.main.id}/edit`);
  await page.getByPlaceholder("Qty").fill("1");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(/would leave -?\d+ available/)).toBeVisible();
});

test("Entry Correction: corrects a source document's quantity and logs it", async ({ page }) => {
  test.skip(!ADMIN2_EMAIL || !ADMIN2_PASSWORD, "SEED_ADMIN2_EMAIL/PASSWORD not configured");
  await loginAs(page, ADMIN2_EMAIL!, ADMIN2_PASSWORD!);

  await page.goto("/stock-openings/new");
  await page.getByText("Select warehouse…").click();
  await page.getByRole("option").first().click();
  await page.getByText("Select product…").click();
  const productName = (await page.getByRole("option").first().textContent())!.trim();
  await page.getByRole("option").first().click();
  await page.getByPlaceholder("Qty").fill("10");
  const [openingResponse] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().endsWith("/api/stock-openings") && res.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Save" }).click(),
  ]);
  await expect(page.getByText("Opening balance recorded.")).toBeVisible();
  const createdOpening = (await openingResponse.json()) as {
    main: { id: string; documentNumber: string };
  };

  await page.goto("/entry-corrections/new");
  await page.getByText("Select a document type…").click();
  await page.getByRole("option", { name: "Opening Balance" }).click();
  await page.getByText("Select a document…").click();
  await page.getByRole("option", { name: createdOpening.main.documentNumber, exact: true }).click();
  await page.getByText("Select an item…").click();
  await page.getByRole("option", { name: productName }).click();
  await page.locator("#newValue").fill("6");
  await page.locator("#notes").fill("Recount found fewer units.");
  const [correctionResponse] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().endsWith("/api/entry-corrections") && res.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Apply correction" }).click(),
  ]);
  await expect(page.getByText("Correction applied.")).toBeVisible();
  await expect(page).toHaveURL("/entry-corrections");
  const correction = (await correctionResponse.json()) as { id: string; documentNumber: string };
  await expect(page.getByText(correction.documentNumber)).toBeVisible();
  await expect(page.getByText("10 → 6")).toBeVisible();

  const openingRes = await page.request.get(`/api/stock-openings/${createdOpening.main.id}`);
  const openingBody = (await openingRes.json()) as { items: { quantity: number }[] };
  expect(openingBody.items[0].quantity).toBe(6);

  await page.goto(`/entry-corrections/${correction.id}`);
  await expect(page.getByText("Opening Balance")).toBeVisible();
  await expect(page.getByText("Recount found fewer units.")).toBeVisible();
});

test("Low Stock: flags a product at or below its reorder level for a warehouse", async ({
  page,
}) => {
  test.skip(!ADMIN2_EMAIL || !ADMIN2_PASSWORD, "SEED_ADMIN2_EMAIL/PASSWORD not configured");

  const productName = `Test Low Stock Product ${Date.now()}`;
  await login(page);
  await page.goto("/products");
  await page.getByRole("button", { name: "New Product" }).click();
  await page.getByLabel("Name").fill(productName);
  await page.getByText("Select category…").click();
  await page.getByRole("option").first().click();
  await page.getByText("Select HSN code…").click();
  await page.getByRole("option").first().click();
  await page.getByText("Select UOM…").click();
  await page.getByRole("option").first().click();
  await page.getByLabel("Price").fill("25");
  await page.getByLabel("Reorder level (optional)").fill("5");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(productName)).toBeVisible();

  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);

  await loginAs(page, ADMIN2_EMAIL!, ADMIN2_PASSWORD!);
  await page.goto("/stock-openings/new");
  await page.getByText("Select warehouse…").click();
  const warehouseName = (await page.getByRole("option").first().textContent())!.trim();
  await page.getByRole("option").first().click();
  await page.getByText("Select product…").click();
  await page.getByRole("option", { name: productName, exact: true }).click();
  await page.getByPlaceholder("Qty").fill("3");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Opening balance recorded.")).toBeVisible();

  await page.goto("/low-stock");
  await page.getByText("Select warehouse…").click();
  await page.getByRole("option", { name: warehouseName, exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: productName });
  await expect(row).toBeVisible();
  await expect(row.getByText("Low", { exact: true })).toBeVisible();
});

test("Billing: cash bill golden path — scan, pay, complete", async ({ page }) => {
  test.skip(!ADMIN2_EMAIL || !ADMIN2_PASSWORD, "SEED_ADMIN2_EMAIL/PASSWORD not configured");
  test.setTimeout(180_000);

  const paymentMethodName = `Test Cash ${Date.now()}`;
  const productName = `Test Billing Product ${Date.now()}`;

  await login(page);
  const pmRes = await page.request.post("/api/payment-methods", {
    data: { name: paymentMethodName, type: "cash", requiresReference: false },
  });
  expect(pmRes.ok()).toBeTruthy();

  await page.goto("/products");
  await page.getByRole("button", { name: "New Product" }).click();
  await page.getByLabel("Name").fill(productName);
  await page.getByText("Select category…").click();
  await page.getByRole("option").first().click();
  await page.getByText("Select HSN code…").click();
  await page.getByRole("option").first().click();
  await page.getByText("Select UOM…").click();
  await page.getByRole("option").first().click();
  await page.getByLabel("Price").fill("50");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(productName)).toBeVisible();

  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);

  await loginAs(page, ADMIN2_EMAIL!, ADMIN2_PASSWORD!);

  await page.goto("/stock-openings/new");
  await page.getByText("Select warehouse…").click();
  await page.getByRole("option").first().click();
  await page.getByText("Select product…").click();
  await page.getByRole("option", { name: productName, exact: true }).click();
  await page.getByPlaceholder("Qty").fill("100");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Opening balance recorded.")).toBeVisible();

  const warehousesRes = await page.request.get("/api/warehouses?pageSize=1");
  const warehousesBody = (await warehousesRes.json()) as { data: { storeId: string }[] };
  const storeId = warehousesBody.data[0].storeId;

  const terminalName = `Test Counter ${Date.now()}`;
  const terminalRes = await page.request.post("/api/terminals", {
    data: { name: terminalName, storeId },
  });
  expect(terminalRes.ok()).toBeTruthy();

  await page.goto("/billing");
  await page.getByRole("button", { name: "Cash Bill" }).click();
  await page.getByText("Select terminal…").click();
  await page.getByRole("option", { name: terminalName, exact: true }).click();
  await page.getByRole("button", { name: "Start bill" }).click();

  await expect(page.getByPlaceholder("Scan or search a product…")).toBeVisible();
  await page.getByPlaceholder("Scan or search a product…").fill(productName);
  await page.getByPlaceholder("Scan or search a product…").press("Enter");
  await page.getByText(productName, { exact: false }).first().click();

  const lineRow = page.getByRole("row").filter({ hasText: productName });
  await expect(lineRow).toBeVisible();
  await expect(page.getByText("₹50.00", { exact: true }).first()).toBeVisible();

  await page.getByText("Select payment method…").click();
  await page.getByRole("option", { name: paymentMethodName, exact: true }).click();
  const amountInput = page.locator('input[type="number"]').last();
  await amountInput.fill("50");
  await page.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText("Payment recorded.")).toBeVisible();
  await expect(page.getByText("₹0.00").last()).toBeVisible();

  const completeButton = page.getByRole("button", { name: "Complete bill" });
  await expect(completeButton).toBeEnabled();
  const [completeResponse] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes("/complete") && res.request().method() === "POST",
    ),
    completeButton.click(),
  ]);
  expect(completeResponse.ok()).toBeTruthy();
  await expect(page.getByText("Bill completed")).toBeVisible();
  const completed = (await completeResponse.json()) as { documentNumber: string };
  await expect(page.getByText(completed.documentNumber)).toBeVisible();

  await page.goto("/bills");
  const billRow = page.getByRole("row").filter({ hasText: completed.documentNumber });
  await expect(billRow).toBeVisible();
  await expect(billRow.getByText("completed")).toBeVisible();
});
