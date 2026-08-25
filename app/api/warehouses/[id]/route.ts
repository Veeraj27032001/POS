import { createDetailHandlers } from "@/lib/resource";
import { warehouseResource } from "@/lib/masters/resources";

export const { GET, PATCH, DELETE, POST } = createDetailHandlers(warehouseResource);
