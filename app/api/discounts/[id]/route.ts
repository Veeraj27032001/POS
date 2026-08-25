import { createDetailHandlers } from "@/lib/resource";
import { discountResource } from "@/lib/masters/resources";

export const { GET, PATCH, DELETE, POST } = createDetailHandlers(discountResource);
