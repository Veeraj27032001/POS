import { createDetailHandlers } from "@/lib/resource";
import { categoryResource } from "@/lib/masters/resources";

export const { GET, PATCH, DELETE, POST } = createDetailHandlers(categoryResource);
