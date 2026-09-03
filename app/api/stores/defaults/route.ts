import { auth } from "@/auth";
import { asAppSession } from "@/lib/auth/types";
import { isPaymentGatewayGloballyDisabled } from "@/lib/adapters/payment";
import { unscoped } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";

const FALLBACK_CURRENCY_SYMBOL = "₹";

// Any authenticated user can check this — it's read to prefill a new
// customer's country/state at billing time with the store's own location,
// and to know which currency symbol to display, not to browse the Store
// record (which stays Super-Admin-only).
export async function GET() {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }

  const globallyDisabled = isPaymentGatewayGloballyDisabled();

  if (!session.user.storeId) {
    return Response.json({
      countryId: null,
      stateId: null,
      currencySymbol: FALLBACK_CURRENCY_SYMBOL,
      defaultExcludeTax: false,
      paymentGatewayAvailable: !globallyDisabled,
    });
  }

  const store = await unscoped().store.findUnique({
    where: { id: session.user.storeId },
    select: {
      countryId: true,
      stateId: true,
      defaultExcludeTax: true,
      disablePaymentGateway: true,
      currency: { select: { symbol: true } },
    },
  });

  return Response.json({
    countryId: store?.countryId ?? null,
    stateId: store?.stateId ?? null,
    currencySymbol: store?.currency?.symbol ?? FALLBACK_CURRENCY_SYMBOL,
    defaultExcludeTax: store?.defaultExcludeTax ?? false,
    paymentGatewayAvailable: !globallyDisabled && !(store?.disablePaymentGateway ?? false),
  });
}
