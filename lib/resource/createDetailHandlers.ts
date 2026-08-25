import type { defineResource } from "./defineResource";

type Resource = ReturnType<typeof defineResource>;
type RouteContext = { params: Promise<{ id: string }> };

export function createDetailHandlers(resource: Resource) {
  return {
    async GET(request: Request, context: RouteContext) {
      const { id } = await context.params;
      return resource.getOne(request, id);
    },
    async PATCH(request: Request, context: RouteContext) {
      const { id } = await context.params;
      return resource.patchOne(request, id);
    },
    async DELETE(request: Request, context: RouteContext) {
      const { id } = await context.params;
      return resource.deleteOne(request, id);
    },
    async POST(request: Request, context: RouteContext) {
      const { id } = await context.params;
      return resource.toggleActiveOne(request, id);
    },
  };
}
