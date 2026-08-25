import { createDetailHandlers } from "@/lib/resource";
import { priceListResource } from "@/lib/masters/resources";

export const { GET, PATCH, DELETE, POST } = createDetailHandlers(priceListResource);
