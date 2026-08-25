import { createDetailHandlers } from "@/lib/resource";
import { taxSchemeResource } from "@/lib/masters/resources";

export const { GET, PATCH, DELETE, POST } = createDetailHandlers(taxSchemeResource);
