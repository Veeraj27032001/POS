import { ROLE_RANK, roleRank, SUPER_ADMIN_ROLE_NAME } from "@/lib/auth/rbac";
import type { AppSession } from "@/lib/auth/types";
import { unscoped } from "@/lib/db";
import { defineResource, isResourceHookRejection } from "@/lib/resource";
import type { ResourceDelegate, ResourceHookResult } from "@/lib/resource";
import { hashSecret } from "@/lib/security/hash";

import { generateSystemBarcode } from "./generateSystemBarcode";
import * as schemas from "./schemas";

function delegateOf(name: string) {
  return (client: unknown) => (client as Record<string, ResourceDelegate>)[name];
}

export const taxRegionResource = defineResource({
  name: "tax_region",
  module: "settings",
  scoping: "none",
  createSchema: schemas.taxRegionCreateSchema,
  updateSchema: schemas.taxRegionUpdateSchema,
  searchFields: ["name", "countryCode"],
  getDelegate: delegateOf("taxRegion"),
  hasIsActive: false,
});

export const taxSchemeResource = defineResource({
  name: "tax_scheme",
  module: "settings",
  scoping: "none",
  createSchema: schemas.taxSchemeCreateSchema,
  updateSchema: schemas.taxSchemeUpdateSchema,
  searchFields: ["name"],
  getDelegate: delegateOf("taxScheme"),
});

export const taxComponentResource = defineResource({
  name: "tax_component",
  module: "settings",
  scoping: "none",
  createSchema: schemas.taxComponentCreateSchema,
  updateSchema: schemas.taxComponentUpdateSchema,
  searchFields: ["name"],
  getDelegate: delegateOf("taxComponent"),
  hasIsActive: false,
});

export const taxCodeResource = defineResource({
  name: "tax_code",
  module: "settings",
  scoping: "none",
  createSchema: schemas.taxCodeCreateSchema,
  updateSchema: schemas.taxCodeUpdateSchema,
  searchFields: ["code", "description"],
  getDelegate: delegateOf("taxCode"),
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
  beforeCreate: (data) => ({ ...data, systemBarcode: generateSystemBarcode() }),
  defaultSort: { createdAt: "desc" },
});

export const customerResource = defineResource({
  name: "customer",
  module: "customers",
  scoping: "none",
  createSchema: schemas.customerCreateSchema,
  updateSchema: schemas.customerUpdateSchema,
  searchFields: ["name", "phone", "email"],
  getDelegate: delegateOf("customer"),
});

export const supplierResource = defineResource({
  name: "supplier",
  module: "suppliers",
  scoping: "none",
  createSchema: schemas.supplierCreateSchema,
  updateSchema: schemas.supplierUpdateSchema,
  searchFields: ["name"],
  getDelegate: delegateOf("supplier"),
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
  createSchema: schemas.terminalCreateSchema,
  updateSchema: schemas.terminalUpdateSchema,
  searchFields: ["name"],
  getDelegate: delegateOf("terminal"),
});

export const paymentMethodResource = defineResource({
  name: "payment_method",
  module: "settings",
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
  scoping: "none",
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
});

async function guardRoleAssignment(
  data: Record<string, unknown>,
  session: AppSession,
): Promise<ResourceHookResult> {
  const roleId = data.roleId;
  if (typeof roleId !== "string") return data;
  const targetRole = await unscoped().role.findUnique({
    where: { id: roleId },
    select: { name: true },
  });
  if (!targetRole) return data; // an invalid id fails normal FK validation, not this check
  if (targetRole.name === SUPER_ADMIN_ROLE_NAME) {
    return { forbidden: "Super Admin cannot be assigned here — it's added directly, by hand." };
  }
  if (roleRank(targetRole.name) < roleRank(session.user.roleName)) {
    return { forbidden: "You cannot assign a role with more access than your own." };
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
  beforeUpdate: async (data, _existing, session) => guardRoleAssignment(data, session),
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
  module: "settings",
  scoping: "required",
  createSchema: schemas.numberingSeriesCreateSchema,
  updateSchema: schemas.numberingSeriesUpdateSchema,
  getDelegate: delegateOf("numberingSeries"),
});
