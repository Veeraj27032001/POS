import { createDetailHandlers } from "@/lib/resource";
import { priceListItemResource } from "@/lib/masters/resources";

export const { GET, PATCH, DELETE, POST } = createDetailHandlers(priceListItemResource);
