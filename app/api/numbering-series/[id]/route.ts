import { createDetailHandlers } from "@/lib/resource";
import { numberingSeriesResource } from "@/lib/masters/resources";

export const { GET, PATCH, DELETE, POST } = createDetailHandlers(numberingSeriesResource);
