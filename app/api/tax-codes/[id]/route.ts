import { createDetailHandlers } from "@/lib/resource";
import { taxCodeResource } from "@/lib/masters/resources";

export const { GET, PATCH, DELETE, POST } = createDetailHandlers(taxCodeResource);
