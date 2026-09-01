import { createDetailHandlers } from "@/lib/resource";
import { billFormatResource } from "@/lib/masters/resources";

export const { GET, PATCH, DELETE, POST } = createDetailHandlers(billFormatResource);
