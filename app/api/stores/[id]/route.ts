import { createDetailHandlers } from "@/lib/resource";
import { storeResource } from "@/lib/masters/resources";

export const { GET, PATCH, DELETE, POST } = createDetailHandlers(storeResource);
