import { createDetailHandlers } from "@/lib/resource";
import { hsnCodeResource } from "@/lib/masters/resources";

export const { GET, PATCH, DELETE, POST } = createDetailHandlers(hsnCodeResource);
