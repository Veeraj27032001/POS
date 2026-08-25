import { auth } from "@/auth";
import { switchFinancialYearSchema } from "@/lib/auth/financialYearSchemas";
import { unscoped } from "@/lib/db";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }

  const parsed = await parseJsonOrRespond(request, switchFinancialYearSchema);
  if ("response" in parsed) return parsed.response;

  const financialYear = await unscoped().financialYear.findUnique({
    where: { id: parsed.data.financialYearId },
  });

  if (!financialYear || !financialYear.isActive) {
    return apiErrorResponse(
      "invalid_financial_year",
      "That financial year is not available for selection.",
      400,
    );
  }

  return Response.json({ id: financialYear.id, label: financialYear.label });
}
