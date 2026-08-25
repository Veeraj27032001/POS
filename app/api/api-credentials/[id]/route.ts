import { createDetailHandlers } from "@/lib/resource";
import { apiCredentialResource } from "@/lib/masters/resources";

export const { GET, PATCH, DELETE, POST } = createDetailHandlers(apiCredentialResource);
