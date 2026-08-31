import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import {
  blockLineAllocations,
  replaceBillLineAllocations,
} from "@/lib/billing/allocateBillLineStock";
import {
  getSelfBlockedByWarehouse,
  applySelfBlocked,
} from "@/lib/billing/getSelfBlockedByWarehouse";
import { getStoreWideAvailable } from "@/lib/billing/getStoreWideAvailable";
import { getWarehouseAvailability } from "@/lib/billing/getWarehouseAvailability";
import { recomputeBillTotals } from "@/lib/billing/recomputeBillTotals";
import { resolveAllocations } from "@/lib/billing/resolveAllocations";
import { resolveTax } from "@/lib/billing/resolveTax";
import { billLineAddSchema } from "@/lib/billing/schemas";
import { unscoped } from "@/lib/db";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

// Adds a product as a bill line, at the given quantity (defaulting to 1) —
// or, if that product already has an active line on this bill, increments
// it by that amount. The billing screen's cart is built entirely client
// side now, so in practice this is called once per product, with the
// cart's full accumulated quantity, when the cashier explicitly saves
// (Save draft/Hold/Create bill) rather than once per scan.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "billing", "update")) {
    return apiErrorResponse("forbidden", "You don't have permission to update bills.", 403);
  }

  const { id } = await params;
  const parsed = await parseJsonOrRespond(request, billLineAddSchema);
  if ("response" in parsed) return parsed.response;
  const data = parsed.data;

  return withStoreContext(async () => {
    const db = unscoped();
    const bill = await db.bill.findUnique({
      where: { id },
      include: { customer: true, store: { include: { taxEngine: true } } },
    });
    if (!bill) return apiErrorResponse("not_found", "Bill not found.", 404);
    if (session.user.storeId && bill.storeId !== session.user.storeId) {
      return apiErrorResponse("not_found", "Bill not found.", 404);
    }
    if (bill.status !== "draft" && bill.status !== "held") {
      return apiErrorResponse("bad_request", `Can't add items to a ${bill.status} bill.`, 400);
    }
    const isHeld = bill.status === "held";

    const product = await db.product.findUnique({
      where: { id: data.productId },
      include: { hsnCode: true },
    });
    if (!product || !product.isActive || product.isDeleted) {
      return apiErrorResponse("bad_request", "Product not found or inactive.", 400);
    }

    const isHeldStockTracked = isHeld && product.stockTracked;
    const [existingLine, perWarehouse, selfBlocked, reasonCode] = await Promise.all([
      db.billLine.findFirst({
        where: { billId: id, productId: data.productId, status: "active" },
      }),
      product.stockTracked ? getWarehouseAvailability(bill.storeId, data.productId) : [],
      isHeldStockTracked ? getSelfBlockedByWarehouse(id, data.productId) : null,
      isHeldStockTracked
        ? db.reasonCode.findFirst({
            where: { category: "stock_block", label: "Reserved — pending bill" },
          })
        : null,
    ]);
    const existingQuantity = existingLine?.quantity ?? 0;
    const newQuantity = existingQuantity + (data.quantity ?? 1);

    // On a held bill, this line's current block already subtracts from
    // `available` — add it back so editing an already-blocked line isn't
    // checked against its own reservation.
    const effectivePerWarehouse = selfBlocked
      ? applySelfBlocked(perWarehouse, selfBlocked)
      : perWarehouse;

    // Draft reserves nothing, so oversell there is only a warning. Held is
    // a real reservation, so it's a hard block instead.
    let stockWarning: string | undefined;
    if (product.stockTracked) {
      const storeAvailable = await getStoreWideAvailable(
        bill.storeId,
        data.productId,
        effectivePerWarehouse,
      );
      const resultingAvailable = storeAvailable + existingQuantity - newQuantity;
      if (resultingAvailable < 0) {
        const message = `Only ${storeAvailable + existingQuantity} of ${product.name} available across this store's warehouses.`;
        if (isHeld) return apiErrorResponse("bad_request", message, 400);
        stockWarning = message;
      }
    }

    const lineSubtotal = Number(product.price) * newQuantity;
    const tax = await resolveTax({
      productId: product.id,
      lineSubtotal,
      storeTaxEngineCode: bill.store.taxEngine?.code ?? null,
      storeStateId: bill.store.stateId,
      customerStateId: bill.customer?.stateId ?? null,
    });
    const lineTotal = lineSubtotal + tax.taxAmount;

    const allocResult = product.stockTracked
      ? await resolveAllocations({
          storeId: bill.storeId,
          productId: product.id,
          quantity: newQuantity,
          requested: data.allocations,
          perWarehouse: effectivePerWarehouse,
        })
      : { allocations: [] };
    if ("error" in allocResult) {
      if (isHeld) return apiErrorResponse("bad_request", allocResult.error, 400);
      stockWarning = allocResult.error;
    } else if (allocResult.fellBack) {
      stockWarning =
        "The chosen warehouse split was no longer available — reallocated automatically.";
    }
    const allocations = "error" in allocResult ? [] : allocResult.allocations;

    if (isHeldStockTracked && !reasonCode) {
      return apiErrorResponse(
        "bad_request",
        "Missing the 'Reserved — pending bill' reason code — contact a Super Admin.",
        400,
      );
    }

    const result = await db.$transaction(async (tx) => {
      const line = existingLine
        ? await tx.billLine.update({
            where: { id: existingLine.id },
            data: {
              quantity: newQuantity,
              unitPrice: product.price,
              taxBreakdown: tax as never,
              lineTotal,
            },
          })
        : await tx.billLine.create({
            data: {
              billId: id,
              productId: product.id,
              productName: product.name,
              productBarcode: product.systemBarcode,
              quantity: newQuantity,
              unitPrice: product.price,
              taxBreakdown: tax as never,
              lineTotal,
            },
          });

      if (product.stockTracked) {
        await replaceBillLineAllocations(tx, {
          billLineId: line.id,
          allocations,
        });
        if (isHeld) {
          await blockLineAllocations(tx, {
            billLineId: line.id,
            product,
            storeId: bill.storeId,
            financialYearId: bill.financialYearId,
            userId: session.user.id,
            reasonCodeId: reasonCode!.id,
          });
        }
      }

      const updatedBill = await recomputeBillTotals(tx, id);
      return { line, bill: updatedBill };
    });

    await writeAuditLog({
      userId: session.user.id,
      storeId: session.user.storeId,
      action: existingLine ? "update" : "create",
      entityType: "bill_line",
      entityId: result.line.id,
      afterData: result.line,
    });

    return Response.json(
      {
        ...result,
        warning: stockWarning,
      },
      { status: 201 },
    );
  });
}
