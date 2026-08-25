import { createDetailHandlers } from "@/lib/resource";
import { cashDenominationResource } from "@/lib/masters/resources";

export const { GET, PATCH, DELETE, POST } = createDetailHandlers(cashDenominationResource);
