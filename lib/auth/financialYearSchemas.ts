import { z } from "zod";

import { opaqueIdSchema } from "@/lib/validation/common";

export const switchFinancialYearSchema = z.object({
  financialYearId: opaqueIdSchema,
});
