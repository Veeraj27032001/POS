import { createDetailHandlers } from "@/lib/resource";
import { userResource } from "@/lib/masters/resources";

export const { GET, PATCH, DELETE, POST } = createDetailHandlers(userResource);
