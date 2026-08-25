import { createDetailHandlers } from "@/lib/resource";
import { paymentMethodResource } from "@/lib/masters/resources";

export const { GET, PATCH, DELETE, POST } = createDetailHandlers(paymentMethodResource);
