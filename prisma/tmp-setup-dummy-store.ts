import { unscoped } from "@/lib/db";
import { createDefaultNumberingSeries } from "@/lib/masters/copyNumberingSeries";
import { generatePublicToken, generateSecretToken, hashSecret } from "@/lib/security";

async function main() {
  const db = unscoped();

  // Mirror a real working store's country/state/currency/timezone/tax-engine
  // so this demo store bills/taxes exactly the same way, without guessing.
  const reference = await db.store.findFirst({
    where: { isActive: true, isDeleted: false, taxEngineId: { not: null } },
    orderBy: { createdAt: "asc" },
  });
  if (!reference) throw new Error("No reference store found");

  // Clean up a previous partial run (numbering series wasn't provisioned
  // last time, so it failed mid-way) before starting fresh.
  const existing = await db.store.findFirst({ where: { name: "Dummy Ecommerce Demo Store" } });
  if (existing) {
    await db.product.deleteMany({ where: { systemBarcode: { startsWith: "DUMMYECOM" } } });
    await db.terminal.deleteMany({ where: { storeId: existing.id } });
    await db.warehouse.deleteMany({ where: { storeId: existing.id } });
    await db.numberingSeries.deleteMany({ where: { storeId: existing.id } });
    await db.store.delete({ where: { id: existing.id } });
  }

  const store = await db.store.create({
    data: {
      name: "Dummy Ecommerce Demo Store",
      address: "123 Demo Street, Test City",
      countryId: reference.countryId,
      stateId: reference.stateId,
      currencyId: reference.currencyId,
      timezoneId: reference.timezoneId,
      taxEngineId: reference.taxEngineId,
      gstin: "27AAAAA0000A1Z5",
    },
  });

  await createDefaultNumberingSeries(store.id);

  const warehouse = await db.warehouse.create({
    data: {
      name: "Main Warehouse",
      address: store.address,
      storeId: store.id,
      countryId: store.countryId,
      stateId: store.stateId,
    },
  });

  const terminal = await db.terminal.create({
    data: { name: "Online Terminal", storeId: store.id },
  });

  const admin = await db.user.findFirst({
    where: { role: { name: "Super Admin" } },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) throw new Error("No Super Admin user found to attribute records to");

  const uom = await db.uom.findFirst();
  if (!uom) throw new Error("No UOM found");

  const hsnCode = await db.hsnCode.findFirst({ where: { isActive: true } });

  const products = await Promise.all(
    [
      { name: "Demo T-Shirt", price: 499 },
      { name: "Demo Coffee Mug", price: 249 },
      { name: "Demo Notebook", price: 149 },
    ].map((p, i) =>
      db.product.create({
        data: {
          name: p.name,
          uomId: uom.id,
          hsnCodeId: hsnCode?.id,
          systemBarcode: `DUMMYECOM${Date.now()}${i}`,
          price: p.price,
          stockTracked: true,
        },
      }),
    ),
  );

  const financialYear = await db.financialYear.findFirst({
    where: { isActive: true, startDate: { lte: new Date() }, endDate: { gte: new Date() } },
  });
  if (!financialYear) throw new Error("No active financial year covers today");

  const { allocateDocumentNumber } = await import("@/lib/numbering/allocateDocumentNumber");
  for (const product of products) {
    await db.$transaction(async (tx) => {
      const { documentNumber } = await allocateDocumentNumber(tx, {
        seriesType: "opening_balance",
        storeId: store.id,
        financialYearId: financialYear.id,
      });
      const main = await tx.stockOpeningMain.create({
        data: {
          documentNumber,
          financialYearId: financialYear.id,
          storeId: store.id,
          warehouseId: warehouse.id,
          openingDate: new Date(),
          createdByUserId: admin.id,
        },
      });
      await tx.stockOpeningItem.create({
        data: {
          stockOpeningMainId: main.id,
          productId: product.id,
          productName: product.name,
          productBarcode: product.systemBarcode,
          productPrice: product.price,
          quantity: 100,
        },
      });
    });
  }

  const apiKey = generatePublicToken("pk");
  const apiSecret = generateSecretToken();
  await db.apiCredential.create({
    data: {
      billingStoreId: store.id,
      stores: { connect: [{ id: store.id }] },
      label: "Dummy Storefront (external)",
      apiKey,
      apiSecretHash: await hashSecret(apiSecret),
      createdByUserId: admin.id,
    },
  });

  console.log(
    JSON.stringify(
      {
        storeId: store.id,
        storeName: store.name,
        warehouseId: warehouse.id,
        terminalId: terminal.id,
        productIds: products.map((p) => p.id),
        apiKey,
        apiSecret,
      },
      null,
      2,
    ),
  );

  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
