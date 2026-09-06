import { authenticateApiCredential } from "@/lib/ecommerce/authenticateApiCredential";
import { unscoped } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";

// GET /v1/ecommerce/stores — every store this credential can sell from and
// bill to. A single-store integration always gets back exactly its own
// store; multi-store returns the full eligible set, so the storefront can
// show pickup/delivery-origin choices if it wants to.
export async function GET(request: Request) {
  const auth = await authenticateApiCredential(request);
  if (!auth) {
    return apiErrorResponse("unauthorized", "Invalid or missing API credentials.", 401);
  }

  const stores = await unscoped().store.findMany({
    where: { id: { in: auth.storeIds }, isActive: true, isDeleted: false },
    select: { id: true, name: true, address: true },
  });

  return Response.json({
    data: stores.map((store) => ({ ...store, isDefault: store.id === auth.billingStoreId })),
  });
}
