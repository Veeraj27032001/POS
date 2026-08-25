import { createDetailHandlers } from "@/lib/resource";
import { supplierResource } from "@/lib/masters/resources";

export const { GET, PATCH, DELETE, POST } = createDetailHandlers(supplierResource);
