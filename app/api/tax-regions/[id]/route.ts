import { createDetailHandlers } from "@/lib/resource";
import { taxRegionResource } from "@/lib/masters/resources";

export const { GET, PATCH, DELETE, POST } = createDetailHandlers(taxRegionResource);
