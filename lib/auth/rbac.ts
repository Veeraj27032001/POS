export function permissionKey(module: string, action: string): string {
  return `${module}:${action}`;
}

export function hasPermission(permissions: string[], module: string, action: string): boolean {
  return permissions.includes(permissionKey(module, action));
}

// Lower = more privileged. Ranks accounts against each other (hierarchy
// visibility, role assignment) — separate from the module:action RoleRight grid.
export const ROLE_RANK: Record<string, number> = {
  "Super Admin": 0,
  Admin: 1,
  Manager: 2,
  Cashier: 3,
};

const UNKNOWN_ROLE_RANK = 999;

export function roleRank(roleName: string): number {
  return ROLE_RANK[roleName] ?? UNKNOWN_ROLE_RANK;
}

// Never assignable through the app — seeded once, promoted to by hand only.
export const SUPER_ADMIN_ROLE_NAME = "Super Admin";

export const SUPER_ADMIN_ONLY_MODULES = [
  "stores",
  "numbering_series",
  "reason_codes",
  "payment_methods",
  "tax_settings",
  "hsn_codes",
] as const;

// Regular business modules — open to Admin (and Super Admin), denied to
// Manager/Cashier by default. Shared between the seed data and the Roles
// management UI/API, which lets Admin/Super Admin edit any role's grid over
// this set — but never over SUPER_ADMIN_ONLY_MODULES, which only a Super
// Admin session may touch (enforced in app/api/roles/[id]/route.ts).
export const BUSINESS_MODULES = [
  "products",
  "categories",
  "customers",
  "suppliers",
  "stock",
  "billing",
  "discounts",
  "reports",
  "users",
  "roles",
  "settings",
];

export const ALL_MODULES = [...BUSINESS_MODULES, ...SUPER_ADMIN_ONLY_MODULES];

export const RBAC_ACTIONS = ["view", "create", "update", "delete"] as const;
