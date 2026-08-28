import { ROLE_SEED_DATA } from "@/lib/auth/rbacSeedData";
import { unscoped } from "@/lib/db";
import { hashSecret } from "@/lib/security/hash";

import { COUNTRIES } from "./seedData/countries";
import { CURRENCIES } from "./seedData/currencies";
import { INDIA_STATES } from "./seedData/indiaStates";

const db = unscoped();

function fixedId(n: number): string {
  return `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
}

const IDS = {
  region: fixedId(0),
  scheme: fixedId(1),
  fy2526: fixedId(2),
  fy2627: fixedId(3),
  store: fixedId(4),
  warehouse: fixedId(5),
  terminal: fixedId(6),
  category: fixedId(7),
  uom: fixedId(8),
  product10: fixedId(9),
  product20: fixedId(10),
};

const SERIES_TYPES = [
  "cash_bill",
  "credit_bill",
  "stock_inward",
  "expiry_extension",
  "credit_note",
  "stock_damage",
  "stock_block",
  "stock_transfer",
  "positive_adjustment",
  "negative_adjustment",
  "opening_balance",
  "entry_correction",
  "payment_request",
  "refund",
  "bill_cancellation",
  "bill_return",
  "bill_payment",
  "shift",
  "online_bill",
  "stock_retest",
  "product_request",
] as const;

const SERIES_PREFIXES: Record<(typeof SERIES_TYPES)[number], string> = {
  cash_bill: "CB",
  credit_bill: "CR",
  stock_inward: "SI",
  expiry_extension: "EE",
  credit_note: "CN",
  stock_damage: "SD",
  stock_block: "SB",
  stock_transfer: "ST",
  positive_adjustment: "PA",
  negative_adjustment: "NA",
  opening_balance: "OB",
  entry_correction: "EC",
  payment_request: "PR",
  refund: "RF",
  bill_cancellation: "BX",
  bill_return: "BR",
  bill_payment: "BP",
  shift: "SH",
  online_bill: "OB2",
  stock_retest: "RT",
  product_request: "PQ",
};

const DENOMINATIONS: Array<{ value: number; type: "note" | "coin" }> = [
  { value: 500, type: "note" },
  { value: 200, type: "note" },
  { value: 100, type: "note" },
  { value: 50, type: "note" },
  { value: 20, type: "note" },
  { value: 10, type: "coin" },
  { value: 5, type: "coin" },
  { value: 2, type: "coin" },
  { value: 1, type: "coin" },
];

const HSN_CODES: Array<{ code: string; description: string; ratePercent: number }> = [
  { code: "1905", description: "Bread, biscuits, bakery products", ratePercent: 5 },
  { code: "2106", description: "Food preparations (snacks, namkeens)", ratePercent: 12 },
  { code: "2202", description: "Beverages, non-alcoholic", ratePercent: 18 },
  { code: "3004", description: "Medicaments", ratePercent: 12 },
  { code: "3401", description: "Soap, personal care", ratePercent: 18 },
  { code: "6109", description: "Apparel, knitted", ratePercent: 12 },
  { code: "8517", description: "Phones, communication equipment", ratePercent: 18 },
  { code: "9503", description: "Toys and games", ratePercent: 12 },
];

const REASON_CODES: Array<{ category: string; label: string }> = [
  { category: "return", label: "Customer changed mind" },
  { category: "return", label: "Wrong item scanned" },
  { category: "void", label: "Price match" },
  { category: "void", label: "Cashier error" },
  { category: "discount", label: "Employee discount" },
  { category: "discount", label: "Loyalty promotion" },
  { category: "stock_adjustment", label: "Physical recount discrepancy" },
  { category: "damage", label: "Damaged in storage" },
  { category: "damage", label: "Returned damaged" },
  { category: "damage", label: "Failed quality re-test" },
  { category: "stock_block", label: "Reserved — pending bill" },
  { category: "stock_block", label: "Reserved — pending transfer" },
  { category: "stock_block", label: "Reserved — online order" },
];

async function main() {
  console.log("Seeding HSN codes…");
  const hsnCodes: Record<string, { id: string }> = {};
  for (const hsn of HSN_CODES) {
    const hsnCode = await db.hsnCode.upsert({
      where: { hsnCode: hsn.code },
      update: {},
      create: {
        hsnCode: hsn.code,
        description: hsn.description,
        cgstRate: hsn.ratePercent / 2,
        sgstRate: hsn.ratePercent / 2,
        igstRate: hsn.ratePercent,
      },
    });
    hsnCodes[hsn.code] = hsnCode;
  }

  console.log("Seeding tax engines…");
  await db.taxEngine.upsert({
    where: { code: "india_standard" },
    update: {},
    create: { code: "india_standard", name: "India Standard" },
  });

  console.log("Seeding reason codes…");
  for (const reason of REASON_CODES) {
    const existing = await db.reasonCode.findFirst({
      where: { category: reason.category as never, label: reason.label },
    });
    if (!existing) {
      await db.reasonCode.create({
        data: { category: reason.category as never, label: reason.label },
      });
    }
  }

  console.log("Seeding roles + RBAC rights…");
  const roleIds: Record<string, string> = {};
  for (const roleDef of ROLE_SEED_DATA) {
    const role = await db.role.upsert({
      where: { name: roleDef.name },
      update: {},
      create: { name: roleDef.name },
    });
    roleIds[roleDef.name] = role.id;

    for (const right of roleDef.rights) {
      await db.roleRight.upsert({
        where: {
          roleId_module_action: { roleId: role.id, module: right.module, action: right.action },
        },
        update: { allowed: right.allowed },
        create: {
          roleId: role.id,
          module: right.module,
          action: right.action,
          allowed: right.allowed,
        },
      });
    }
  }

  console.log("Seeding financial years…");
  const fy2526 = await db.financialYear.upsert({
    where: { id: IDS.fy2526 },
    update: {},
    create: {
      id: IDS.fy2526,
      label: "2025-26",
      startDate: new Date("2025-04-01"),
      endDate: new Date("2026-03-31"),
      isActive: true,
    },
  });
  const fy2627 = await db.financialYear.upsert({
    where: { id: IDS.fy2627 },
    update: {},
    create: {
      id: IDS.fy2627,
      label: "2026-27",
      startDate: new Date("2026-04-01"),
      endDate: new Date("2027-03-31"),
      isActive: true,
    },
  });

  console.log("Seeding countries, states, currencies, timezones…");
  const countryIds: Record<string, string> = {};
  for (const country of COUNTRIES) {
    const row = await db.country.upsert({
      where: { code: country.code },
      update: { name: country.name, callingCode: country.callingCode },
      create: country,
    });
    countryIds[country.code] = row.id;
  }

  const indiaStateIds: Record<string, string> = {};
  for (const state of INDIA_STATES) {
    const row = await db.state.upsert({
      where: { countryId_code: { countryId: countryIds.IN, code: state.code } },
      update: { name: state.name },
      create: { ...state, countryId: countryIds.IN },
    });
    indiaStateIds[state.code] = row.id;
  }

  for (const currency of CURRENCIES) {
    await db.currency.upsert({
      where: { code: currency.code },
      update: { name: currency.name, symbol: currency.symbol },
      create: currency,
    });
  }

  // The canonical, always-current IANA tz database list, straight from the
  // runtime rather than a hand-maintained copy that could drift out of date.
  // ICU's canonical set uses some pre-rename zone names (e.g. Asia/Calcutta)
  // that don't match what this India-focused app expects everywhere else
  // (APP_DEFAULT_TIMEZONE, the old Store.timezone default) — add the
  // renamed form(s) explicitly so the expected name is always selectable.
  const timezoneNames = new Set(Intl.supportedValuesOf("timeZone"));
  timezoneNames.add("Asia/Kolkata");
  for (const name of timezoneNames) {
    await db.timezone.upsert({ where: { name }, update: {}, create: { name } });
  }

  const inrCurrency = await db.currency.findUniqueOrThrow({ where: { code: "INR" } });
  const kolkataTimezone = await db.timezone.findUniqueOrThrow({ where: { name: "Asia/Kolkata" } });

  console.log("Seeding demo store, warehouse, terminal…");
  const store = await db.store.upsert({
    where: { id: IDS.store },
    update: {
      countryId: countryIds.IN,
      stateId: indiaStateIds.KA,
      currencyId: inrCurrency.id,
      timezoneId: kolkataTimezone.id,
    },
    create: {
      id: IDS.store,
      name: "Demo Store",
      address: "123 MG Road, Bengaluru",
      countryId: countryIds.IN,
      stateId: indiaStateIds.KA,
      currencyId: inrCurrency.id,
      timezoneId: kolkataTimezone.id,
      gstin: "29AAAAA0000A1Z5",
    },
  });

  console.log("Seeding cash denominations…");
  for (const [i, denom] of DENOMINATIONS.entries()) {
    const id = fixedId(100 + i);
    await db.cashDenomination.upsert({
      where: { id },
      update: {},
      create: {
        id,
        value: denom.value,
        type: denom.type,
        storeId: store.id,
        currencyId: inrCurrency.id,
      },
    });
  }

  const warehouse = await db.warehouse.upsert({
    where: { id: IDS.warehouse },
    update: {},
    create: {
      id: IDS.warehouse,
      name: "Main Warehouse",
      address: "123 MG Road, Bengaluru",
      storeId: store.id,
    },
  });

  await db.terminal.upsert({
    where: { id: IDS.terminal },
    update: {},
    create: { id: IDS.terminal, storeId: store.id, name: "Counter 1" },
  });

  console.log("Seeding numbering series…");
  for (const financialYear of [fy2526, fy2627]) {
    for (const seriesType of SERIES_TYPES) {
      await db.numberingSeries.upsert({
        where: {
          seriesType_storeId_financialYearId: {
            seriesType,
            storeId: store.id,
            financialYearId: financialYear.id,
          },
        },
        update: {},
        create: {
          seriesType,
          storeId: store.id,
          financialYearId: financialYear.id,
          prefix: SERIES_PREFIXES[seriesType],
          currentNumber: 0,
        },
      });
    }
  }

  console.log("Seeding demo admin user…");
  const seedAdminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
  const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";
  const passwordHash = await hashSecret(seedAdminPassword);
  await db.user.upsert({
    where: { email: seedAdminEmail },
    update: {},
    create: {
      name: "Demo Admin",
      email: seedAdminEmail,
      passwordHash,
      roleId: roleIds["Super Admin"],
      // Super Admin is cross-store by design — never scoped to one.
      storeId: null,
    },
  });

  console.log("Seeding demo category, UOM, and product…");
  const category = await db.category.upsert({
    where: { id: IDS.category },
    update: {},
    create: { id: IDS.category, name: "Snacks" },
  });

  const uomPiece = await db.uom.upsert({
    where: { id: IDS.uom },
    update: {},
    create: { id: IDS.uom, name: "Piece", abbreviation: "pc" },
  });

  await db.product.upsert({
    where: { id: IDS.product10 },
    update: {},
    create: {
      id: IDS.product10,
      name: "Lays Chips 10 Rs Pack",
      categoryId: category.id,
      hsnCodeId: hsnCodes["2106"].id,
      trackExpiry: true,
      uomId: uomPiece.id,
      systemBarcode: "2000000000001",
      price: 10,
      stockTracked: true,
      reorderLevel: 20,
    },
  });
  await db.product.upsert({
    where: { id: IDS.product20 },
    update: {},
    create: {
      id: IDS.product20,
      name: "Lays Chips 20 Rs Pack",
      categoryId: category.id,
      hsnCodeId: hsnCodes["2106"].id,
      trackExpiry: true,
      uomId: uomPiece.id,
      systemBarcode: "2000000000002",
      price: 20,
      stockTracked: true,
      reorderLevel: 10,
    },
  });

  console.log(`Warehouse ready: ${warehouse.name}`);
  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
