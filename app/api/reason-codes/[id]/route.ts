import { createDetailHandlers } from "@/lib/resource";
import { reasonCodeResource } from "@/lib/masters/resources";

export const { GET, PATCH, DELETE, POST } = createDetailHandlers(reasonCodeResource);
