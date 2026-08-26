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

export const SUPER_ADMIN_ONLY_MODULES = ["stores", "numbering_series", "reason_codes"] as const;
