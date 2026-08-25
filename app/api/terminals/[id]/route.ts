import { createDetailHandlers } from "@/lib/resource";
import { terminalResource } from "@/lib/masters/resources";

export const { GET, PATCH, DELETE, POST } = createDetailHandlers(terminalResource);
