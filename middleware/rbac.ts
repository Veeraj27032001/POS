export interface RouteModuleRule {
  pathPrefix: string;
  module: string;
}

export const ROUTE_MODULE_RULES: RouteModuleRule[] = [];

export function checkRbacAccess(pathname: string, permissions: string[]): boolean {
  const rule = ROUTE_MODULE_RULES.find((r) => pathname.startsWith(r.pathPrefix));
  if (!rule) return true;
  return permissions.some((p) => p.startsWith(`${rule.module}:`));
}
