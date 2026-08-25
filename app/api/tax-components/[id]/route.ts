import { createDetailHandlers } from "@/lib/resource";
import { taxComponentResource } from "@/lib/masters/resources";

export const { GET, PATCH, DELETE, POST } = createDetailHandlers(taxComponentResource);
