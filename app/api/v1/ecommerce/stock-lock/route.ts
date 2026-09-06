import { authenticateApiCredential } from "@/lib/ecommerce/authenticateApiCredential";
import { ecommerceStockLockCreateSchema } from "@/lib/ecommerce/schemas";
import { resolveFinancialYearForDate } from "@/lib/ecommerce/resolveFinancialYear";
import { runWithStoreContext, unscoped } from "@/lib/db";
import { allocateDocumentNumber } from "@/lib/numbering/allocateDocumentNumber";
import { getStockLevels } from "@/lib/stock/getStockLevels";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";

// step7 §4/§5 — POST /v1/ecommerce/stock-lock: reserves stock for a cart/
// checkout in progress, reusing the Stock Block mechanism (source_type
// "ecommerce_order") rather than a parallel reservation system.
export async function POST(request: Request) {
  const auth = await authenticateApiCredential(request);
  if (!auth) {
    return apiErrorResponse("unauthorized", "Invalid or missing API credentials.", 401);
  }

  const parsed = await parseJsonOrRespond(request, ecommerceStockLockCreateSchema);
  if ("response" in parsed) return parsed.response;
  const data = parsed.data;

  const db = unscoped();

  const product = await db.product.findUnique({
    where: { id: data.productId },
    include: { hsnCode: true },
  });
  if (!product || !product.isActive || product.isDeleted) {
    return apiErrorResponse("bad_request", "Product not found or inactive.", 400);
  }

  let warehouseId = data.warehouseId;
  if (!warehouseId) {
    const warehouses = await db.warehouse.findMany({
      where: { storeId: auth.storeId, isActive: true, isDeleted: false },
      select: { id: true },
    });
    if (warehouses.length !== 1) {
      return apiErrorResponse(
        "bad_request",
        "warehouseId is required — this store has more than one warehouse.",
        400,
      );
    }
    warehouseId = warehouses[0].id;
  } else {
    const warehouse = await db.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse || warehouse.storeId !== auth.storeId) {
      return apiErrorResponse("bad_request", "Warehouse not found for this store.", 400);
    }
  }

  const { available } = await getStockLevels({ productId: product.id, warehouseId });
  if (data.quantity > available) {
    return apiErrorResponse("bad_request", `Only ${available} of ${product.name} available.`, 400);
  }

  const now = new Date();
  const financialYear = await resolveFinancialYearForDate(now);
  if (!financialYear) {
    return apiErrorResponse(
      "bad_request",
      "No active financial year covers today's date — contact the store admin.",
      400,
    );
  }

  const reasonCode = await db.reasonCode.findFirst({
    where: { category: "stock_block", label: "Reserved — online order" },
  });
  if (!reasonCode) {
    return apiErrorResponse(
      "bad_request",
      "Missing the 'Reserved — online order' reason code — contact a Super Admin.",
      400,
    );
  }

  const result = await db.$transaction(async (tx) => {
    const { documentNumber } = await allocateDocumentNumber(tx, {
      seriesType: "stock_block",
      storeId: auth.storeId,
      financialYearId: financialYear.id,
    });
    const main = await tx.stockBlockMain.create({
      data: {
        documentNumber,
        financialYearId: financialYear.id,
        storeId: auth.storeId,
        warehouseId,
        sourceType: "ecommerce_order",
        sourceId: data.externalReference ?? null,
        blockedByUserId: auth.createdByUserId,
        blockedAt: now,
      },
    });
    await tx.stockBlockItem.create({
      data: {
        stockBlockMainId: main.id,
        productId: product.id,
        productName: product.name,
        productBarcode: product.systemBarcode,
        productPrice: product.price,
        productHsnCode: product.hsnCode?.hsnCode ?? null,
        quantityBlocked: data.quantity,
        reasonCodeId: reasonCode.id,
      },
    });
    return main;
  });

  await runWithStoreContext({ storeId: auth.storeId, userId: auth.createdByUserId }, () =>
    writeAuditLog({
      userId: auth.createdByUserId,
      storeId: auth.storeId,
      action: "create",
      entityType: "stock_block",
      entityId: result.id,
    }),
  );

  return Response.json(
    { lockId: result.id, productId: product.id, warehouseId, quantity: data.quantity },
    { status: 201 },
  );
}
