export interface RoleSeedDefinition {
  name: string;
  rights: Array<{ module: string; action: string; allowed: boolean }>;
}

const MODULES = [
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

const ACTIONS = ["view", "create", "update", "delete"] as const;

function allActionsFor(modules: string[], allowed: boolean) {
  return modules.flatMap((module) => ACTIONS.map((action) => ({ module, action, allowed })));
}

export const ROLE_SEED_DATA: RoleSeedDefinition[] = [
  {
    name: "Owner",
    rights: allActionsFor(MODULES, true),
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
      ...allActionsFor(["users", "settings"], false),
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
      ...allActionsFor(["categories", "suppliers", "reports", "users", "settings"], false),
    ],
  },
];
