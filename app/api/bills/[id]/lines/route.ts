import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { replaceBillLineAllocations } from "@/lib/billing/allocateBillLineStock";
import { getStoreWideAvailable } from "@/lib/billing/getStoreWideAvailable";
import { recomputeBillTotals } from "@/lib/billing/recomputeBillTotals";
import { resolveAllocations } from "@/lib/billing/resolveAllocations";
import { resolveTax } from "@/lib/billing/resolveTax";
import { billLineAddSchema } from "@/lib/billing/schemas";
import { unscoped } from "@/lib/db";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

// Scan-to-add: exact-match on a productId already resolved client-side by
// barcode or search — adds a new line at quantity 1, or increments the
// existing active line for that product by 1 (step5 §7).
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
    if (bill.status !== "draft") {
      return apiErrorResponse("bad_request", `Can't add items to a ${bill.status} bill.`, 400);
    }

    const product = await db.product.findUnique({
      where: { id: data.productId },
      include: { hsnCode: true },
    });
    if (!product || !product.isActive || product.isDeleted) {
      return apiErrorResponse("bad_request", "Product not found or inactive.", 400);
    }

    const existingLine = await db.billLine.findFirst({
      where: { billId: id, productId: data.productId, status: "active" },
    });
    const existingQuantity = existingLine?.quantity ?? 0;
    const newQuantity = existingQuantity + 1;

    if (product.stockTracked) {
      const storeAvailable = await getStoreWideAvailable(bill.storeId, data.productId);
      const resultingAvailable = storeAvailable + existingQuantity - newQuantity;
      if (resultingAvailable < 0) {
        return apiErrorResponse(
          "bad_request",
          `Only ${storeAvailable + existingQuantity} of ${product.name} available across this store's warehouses.`,
          400,
        );
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
        })
      : { allocations: [] };
    if ("error" in allocResult) {
      return apiErrorResponse("bad_request", allocResult.error, 400);
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
          product,
          storeId: bill.storeId,
          financialYearId: bill.financialYearId,
          userId: session.user.id,
          allocations: allocResult.allocations,
        });
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

    return Response.json(result, { status: 201 });
  });
}
