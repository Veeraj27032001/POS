import { createDetailHandlers } from "@/lib/resource";
import { uomResource } from "@/lib/masters/resources";

export const { GET, PATCH, DELETE, POST } = createDetailHandlers(uomResource);
