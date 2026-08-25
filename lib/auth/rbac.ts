export function permissionKey(module: string, action: string): string {
  return `${module}:${action}`;
}

export function hasPermission(permissions: string[], module: string, action: string): boolean {
  return permissions.includes(permissionKey(module, action));
}
