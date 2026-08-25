import { createDetailHandlers } from "@/lib/resource";
import { loyaltyRuleResource } from "@/lib/masters/resources";

export const { GET, PATCH, DELETE, POST } = createDetailHandlers(loyaltyRuleResource);
