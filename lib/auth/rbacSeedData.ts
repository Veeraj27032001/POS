import { ALL_MODULES, BUSINESS_MODULES, RBAC_ACTIONS, SUPER_ADMIN_ONLY_MODULES } from "./rbac";

export interface RoleSeedDefinition {
  name: string;
  rights: Array<{ module: string; action: string; allowed: boolean }>;
}

function allActionsFor(modules: string[], allowed: boolean) {
  return modules.flatMap((module) => RBAC_ACTIONS.map((action) => ({ module, action, allowed })));
}

export const ROLE_SEED_DATA: RoleSeedDefinition[] = [
  {
    name: "Super Admin",
    rights: allActionsFor(ALL_MODULES, true),
  },
  {
    name: "Admin",
    rights: [
      ...allActionsFor(BUSINESS_MODULES, true),
      ...allActionsFor([...SUPER_ADMIN_ONLY_MODULES], false),
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
      ...allActionsFor(["users", "roles", "settings", ...SUPER_ADMIN_ONLY_MODULES], false),
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
        [
          "categories",
          "suppliers",
          "reports",
          "users",
          "roles",
          "settings",
          ...SUPER_ADMIN_ONLY_MODULES,
        ],
        false,
      ),
    ],
  },
];
