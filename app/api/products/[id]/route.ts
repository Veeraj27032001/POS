import { createDetailHandlers } from "@/lib/resource";
import { productResource } from "@/lib/masters/resources";

export const { GET, PATCH, DELETE, POST } = createDetailHandlers(productResource);
