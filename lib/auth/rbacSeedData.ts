export interface RoleSeedDefinition {
  name: string;
  rights: Array<{ module: string; action: string; allowed: boolean }>;
}

const BUSINESS_MODULES = [
  "products",
  "categories",
  "customers",
  "suppliers",
  "stock",
  "billing",
  "discounts",
  "reports",
  "users",
  "settings",
];

// Foundational system config — see lib/auth/rbac.ts's SUPER_ADMIN_ONLY_MODULES.
// Kept as a separate list (rather than folded into BUSINESS_MODULES) so every
// role's rights for these three are set explicitly below, not implicitly.
const SUPER_ADMIN_ONLY_MODULES = ["stores", "numbering_series", "reason_codes"];

const ALL_MODULES = [...BUSINESS_MODULES, ...SUPER_ADMIN_ONLY_MODULES];

const ACTIONS = ["view", "create", "update", "delete"] as const;

function allActionsFor(modules: string[], allowed: boolean) {
  return modules.flatMap((module) => ACTIONS.map((action) => ({ module, action, allowed })));
}

export const ROLE_SEED_DATA: RoleSeedDefinition[] = [
  {
    // The only role with access to Stores, Numbering Series, and Reason
    // Codes. Never assignable through the Users UI (see the roles API and
    // userResource's beforeCreate/beforeUpdate guards) — it's seeded once
    // and promoted to by hand, not something an Admin can grant.
    name: "Super Admin",
    rights: allActionsFor(ALL_MODULES, true),
  },
  {
    // Everything a business owner/operator needs day-to-day — created by a
    // Super Admin, manages regular data and adds regular Users — but not
    // the three super-admin-only modules.
    name: "Admin",
    rights: [
      ...allActionsFor(BUSINESS_MODULES, true),
      ...allActionsFor(SUPER_ADMIN_ONLY_MODULES, false),
    ],
  },
  {
    name: "Manager",
    rights: [
      ...allActionsFor(
        [
          "products",
          "categories",
          "customers",
          "suppliers",
          "stock",
          "billing",
          "discounts",
          "reports",
        ],
        true,
      ),
      ...allActionsFor(["users", "settings", ...SUPER_ADMIN_ONLY_MODULES], false),
    ],
  },
  {
    name: "Cashier",
    rights: [
      { module: "products", action: "view", allowed: true },
      { module: "products", action: "create", allowed: false },
      { module: "products", action: "update", allowed: false },
      { module: "products", action: "delete", allowed: false },
      { module: "customers", action: "view", allowed: true },
      { module: "customers", action: "create", allowed: true },
      { module: "customers", action: "update", allowed: false },
      { module: "customers", action: "delete", allowed: false },
      { module: "stock", action: "view", allowed: true },
      { module: "stock", action: "create", allowed: false },
      { module: "stock", action: "update", allowed: false },
      { module: "stock", action: "delete", allowed: false },
      { module: "billing", action: "view", allowed: true },
      { module: "billing", action: "create", allowed: true },
      { module: "billing", action: "update", allowed: true },
      { module: "billing", action: "delete", allowed: false },
      { module: "discounts", action: "view", allowed: true },
      { module: "discounts", action: "create", allowed: true },
      { module: "discounts", action: "update", allowed: false },
      { module: "discounts", action: "delete", allowed: false },
      ...allActionsFor(
        ["categories", "suppliers", "reports", "users", "settings", ...SUPER_ADMIN_ONLY_MODULES],
        false,
      ),
    ],
  },
];
