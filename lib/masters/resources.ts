import { getNotifier } from "@/lib/adapters/notifier";
import { ROLE_RANK, roleRank, SUPER_ADMIN_ROLE_NAME } from "@/lib/auth/rbac";
import type { AppSession } from "@/lib/auth/types";
import { unscoped } from "@/lib/db";
import { defineResource, isResourceHookRejection } from "@/lib/resource";
import type { ResourceDelegate, ResourceHookResult } from "@/lib/resource";
import { hashSecret } from "@/lib/security/hash";

import { copyNumberingSeriesToStores, findReferenceStoreId } from "./copyNumberingSeries";
import { generateSystemBarcode } from "./generateSystemBarcode";
import * as schemas from "./schemas";

function delegateOf(name: string) {
  return (client: unknown) => (client as Record<string, ResourceDelegate>)[name];
}

// For models with a stores many-to-many relation (Customer, Supplier):
// wraps the delegate to always include the related store ids (needed for
// the multi-select field to show its current value), and turns an incoming
// `storeIds: string[]` into Prisma's relation-set syntax before writing.
function projectStoreIds<T extends Record<string, unknown> | null>(row: T): T {
  if (!row) return row;
  const stores = row.stores as { id: string }[] | undefined;
  if (!stores) return row;
  return { ...row, storeIds: stores.map((s) => s.id) };
}

function delegateWithStores(name: string) {
  return (client: unknown): ResourceDelegate => {
    const raw = (
      client as Record<string, Record<string, (args: Record<string, unknown>) => unknown>>
    )[name];
    const include = { stores: { select: { id: true } } };
    return {
      count: (args) => raw.count(args) as ReturnType<ResourceDelegate["count"]>,
      findMany: async (args) => {
        const rows = (await raw.findMany({ ...args, include })) as Record<string, unknown>[];
        return rows.map((row) => projectStoreIds(row));
      },
      findUnique: async (args) => {
        const row = (await raw.findUnique({ ...args, include })) as Record<string, unknown> | null;
        return projectStoreIds(row);
      },
      create: async (args) => {
        const row = (await raw.create({ ...args, include })) as Record<string, unknown>;
        return projectStoreIds(row);
      },
      update: async (args) => {
        const row = (await raw.update({ ...args, include })) as Record<string, unknown>;
        return projectStoreIds(row);
      },
    };
  };
}

// Prisma's `create()` doesn't accept relation `set` — there's nothing to
// replace yet — only `update()` does, so the two need different verbs even
// though the incoming `storeIds` shape is the same either way.
function withStoreIds(
  data: Record<string, unknown>,
  mode: "create" | "update",
): Record<string, unknown> {
  const { storeIds, ...rest } = data;
  if (!Array.isArray(storeIds)) return rest;
  const refs = storeIds.map((id) => ({ id: String(id) }));
  return { ...rest, stores: mode === "create" ? { connect: refs } : { set: refs } };
}

export const hsnCodeResource = defineResource({
  name: "hsn_code",
  module: "hsn_codes",
  scoping: "none",
  createSchema: schemas.hsnCodeCreateSchema,
  updateSchema: schemas.hsnCodeUpdateSchema,
  searchFields: ["hsnCode", "description"],
  getDelegate: delegateOf("hsnCode"),
});

export const categoryResource = defineResource({
  name: "category",
  module: "categories",
  scoping: "none",
  createSchema: schemas.categoryCreateSchema,
  updateSchema: schemas.categoryUpdateSchema,
  searchFields: ["name"],
  getDelegate: delegateOf("category"),
  defaultSort: { createdAt: "desc" },
});

export const uomResource = defineResource({
  name: "uom",
  module: "settings",
  scoping: "none",
  createSchema: schemas.uomCreateSchema,
  updateSchema: schemas.uomUpdateSchema,
  searchFields: ["name", "abbreviation"],
  getDelegate: delegateOf("uom"),
  hasIsActive: false,
});

export const productResource = defineResource({
  name: "product",
  module: "products",
  scoping: "none",
  createSchema: schemas.productCreateSchema,
  updateSchema: schemas.productUpdateSchema,
  searchFields: ["name", "skuBarcode", "systemBarcode"],
  getDelegate: delegateOf("product"),
  beforeCreate: async (data) => {
    const preferences = await unscoped().taxPreferences.findFirst();
    if (preferences?.hsnTaxDisplayEnabled && !data.hsnCodeId) {
      return { forbidden: "HSN code is required." };
    }
    return { ...data, systemBarcode: generateSystemBarcode() };
  },
  defaultSort: { createdAt: "desc" },
});

export const customerResource = defineResource({
  name: "customer",
  module: "customers",
  scoping: "none",
  createSchema: schemas.customerCreateSchema,
  updateSchema: schemas.customerUpdateSchema,
  searchFields: ["name", "phone", "email"],
  getDelegate: delegateWithStores("customer"),
  beforeCreate: (data) => withStoreIds(data, "create"),
  beforeUpdate: (data) => withStoreIds(data, "update"),
});

export const supplierResource = defineResource({
  name: "supplier",
  module: "suppliers",
  scoping: "none",
  createSchema: schemas.supplierCreateSchema,
  updateSchema: schemas.supplierUpdateSchema,
  searchFields: ["name"],
  getDelegate: delegateWithStores("supplier"),
  beforeCreate: (data) => withStoreIds(data, "create"),
  beforeUpdate: (data) => withStoreIds(data, "update"),
});

export const warehouseResource = defineResource({
  name: "warehouse",
  module: "settings",
  scoping: "optional",
  createSchema: schemas.warehouseCreateSchema,
  updateSchema: schemas.warehouseUpdateSchema,
  searchFields: ["name"],
  getDelegate: delegateOf("warehouse"),
});

export const terminalResource = defineResource({
  name: "terminal",
  module: "settings",
  scoping: "required",
  explicitStoreId: true,
  createSchema: schemas.terminalCreateSchema,
  updateSchema: schemas.terminalUpdateSchema,
  searchFields: ["name"],
  getDelegate: delegateOf("terminal"),
});

export const paymentMethodResource = defineResource({
  name: "payment_method",
  module: "payment_methods",
  scoping: "none",
  createSchema: schemas.paymentMethodCreateSchema,
  updateSchema: schemas.paymentMethodUpdateSchema,
  searchFields: ["name"],
  getDelegate: delegateOf("paymentMethod"),
});

export const priceListResource = defineResource({
  name: "price_list",
  module: "discounts",
  scoping: "optional",
  createSchema: schemas.priceListCreateSchema,
  updateSchema: schemas.priceListUpdateSchema,
  searchFields: ["name"],
  getDelegate: delegateOf("priceList"),
  hasIsActive: false,
});

export const priceListItemResource = defineResource({
  name: "price_list_item",
  module: "discounts",
  scoping: "none",
  createSchema: schemas.priceListItemCreateSchema,
  updateSchema: schemas.priceListItemUpdateSchema,
  getDelegate: delegateOf("priceListItem"),
  hasIsActive: false,
});

export const discountResource = defineResource({
  name: "discount",
  module: "discounts",
  scoping: "none",
  createSchema: schemas.discountCreateSchema,
  updateSchema: schemas.discountUpdateSchema,
  searchFields: ["name", "couponCode"],
  getDelegate: delegateOf("discount"),
});

export const reasonCodeResource = defineResource({
  name: "reason_code",
  module: "reason_codes",
  scoping: "none",
  createSchema: schemas.reasonCodeCreateSchema,
  updateSchema: schemas.reasonCodeUpdateSchema,
  searchFields: ["label"],
  getDelegate: delegateOf("reasonCode"),
});

export const cashDenominationResource = defineResource({
  name: "cash_denomination",
  module: "settings",
  scoping: "required",
  explicitStoreId: true,
  createSchema: schemas.cashDenominationCreateSchema,
  updateSchema: schemas.cashDenominationUpdateSchema,
  getDelegate: delegateOf("cashDenomination"),
});

export const loyaltyRuleResource = defineResource({
  name: "loyalty_rule",
  module: "settings",
  scoping: "optional",
  createSchema: schemas.loyaltyRuleCreateSchema,
  updateSchema: schemas.loyaltyRuleUpdateSchema,
  getDelegate: delegateOf("loyaltyRule"),
});

export const apiCredentialResource = defineResource({
  name: "api_credential",
  module: "settings",
  scoping: "required",
  createSchema: schemas.apiCredentialCreateSchema,
  updateSchema: schemas.apiCredentialUpdateSchema,
  getDelegate: delegateOf("apiCredential"),
});

export const storeResource = defineResource({
  name: "store",
  module: "stores",
  scoping: "none",
  createSchema: schemas.storeCreateSchema,
  updateSchema: schemas.storeUpdateSchema,
  searchFields: ["name", "gstin"],
  getDelegate: delegateOf("store"),
  afterCreate: async (created) => {
    const newStoreId = created.id as string;
    const referenceStoreId = await findReferenceStoreId(newStoreId);
    if (referenceStoreId) {
      await copyNumberingSeriesToStores(referenceStoreId, [newStoreId]);
    }
  },
});

async function guardRoleAssignment(
  data: Record<string, unknown>,
  session: AppSession,
  existing?: Record<string, unknown>,
): Promise<ResourceHookResult> {
  const roleId = (data.roleId as string | undefined) ?? (existing?.roleId as string | undefined);
  if (typeof roleId !== "string") return data;

  const targetRole = await unscoped().role.findUnique({
    where: { id: roleId },
    select: { name: true },
  });
  if (!targetRole) return data; // an invalid id fails normal FK validation, not this check

  if (typeof data.roleId === "string") {
    if (targetRole.name === SUPER_ADMIN_ROLE_NAME) {
      return { forbidden: "Super Admin cannot be assigned here — it's added directly, by hand." };
    }
    if (roleRank(targetRole.name) < roleRank(session.user.roleName)) {
      return { forbidden: "You cannot assign a role with more access than your own." };
    }
  }

  // Manager/Cashier (and anything ranked below them) always belong to one
  // store; Admin/Super Admin may optionally be left cross-store.
  const resultingStoreId = "storeId" in data ? data.storeId : existing?.storeId;
  if (roleRank(targetRole.name) >= ROLE_RANK.Manager && !resultingStoreId) {
    return { forbidden: `${targetRole.name} accounts must belong to a store.` };
  }

  return data;
}

function userDelegateWithRole(client: unknown): ResourceDelegate {
  const raw = (client as Record<string, ResourceDelegate>).user as unknown as {
    count: ResourceDelegate["count"];
    findMany: (args: Record<string, unknown>) => Promise<Record<string, unknown>[]>;
    findUnique: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
    create: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
    update: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
  };
  const include = { role: { select: { name: true } } };
  return {
    count: (args) => raw.count(args),
    findMany: (args) => raw.findMany({ ...args, include }),
    findUnique: (args) => raw.findUnique({ ...args, include }),
    create: (args) => raw.create({ ...args, include }),
    update: (args) => raw.update({ ...args, include }),
  };
}

export const userResource = defineResource({
  name: "user",
  module: "users",
  scoping: "required",
  explicitStoreId: true,
  createSchema: schemas.userCreateSchema,
  updateSchema: schemas.userUpdateSchema,
  searchFields: ["name", "email"],
  getDelegate: userDelegateWithRole,
  extraWhere: (session) => {
    const viewerRank = roleRank(session.user.roleName);
    const visibleRoleNames = Object.entries(ROLE_RANK)
      .filter(([, rank]) => rank >= viewerRank)
      .map(([name]) => name);
    return { role: { name: { in: visibleRoleNames } } };
  },
  beforeCreate: async (data, session) => {
    const guarded = await guardRoleAssignment(data, session);
    if (isResourceHookRejection(guarded)) return guarded;
    const { password, ...rest } = guarded as { password: string; [key: string]: unknown };
    return { ...rest, passwordHash: await hashSecret(password) };
  },
  beforeUpdate: async (data, existing, session) => guardRoleAssignment(data, session, existing),
  // Runs only once the user really exists in the DB — a duplicate-email
  // conflict (or any other create failure) now correctly never sends this.
  afterCreate: (created, originalData) => {
    const email = created.email as string;
    const name = created.name as string;
    const password = originalData.password as string;
    getNotifier()
      .send({
        to: email,
        channel: "email",
        subject: "Your account has been created",
        body: `Hi ${name},\n\nAn account has been created for you.\n\nEmail: ${email}\nTemporary password: ${password}\n\nSign in and change this password as soon as possible.`,
      })
      .catch((error) => console.error(`Failed to send welcome email to ${email}.`, error));
  },
});

export const financialYearResource = defineResource({
  name: "financial_year",
  module: "settings",
  scoping: "none",
  createSchema: schemas.financialYearCreateSchema,
  updateSchema: schemas.financialYearUpdateSchema,
  searchFields: ["label"],
  getDelegate: delegateOf("financialYear"),
});

export const numberingSeriesResource = defineResource({
  name: "numbering_series",
  module: "numbering_series",
  scoping: "required",
  explicitStoreId: true,
  createSchema: schemas.numberingSeriesCreateSchema,
  updateSchema: schemas.numberingSeriesUpdateSchema,
  getDelegate: delegateOf("numberingSeries"),
});
