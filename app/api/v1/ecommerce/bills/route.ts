import { replaceBillLineAllocations } from "@/lib/billing/allocateBillLineStock";
import { recomputeBillTotals } from "@/lib/billing/recomputeBillTotals";
import { resolveTax } from "@/lib/billing/resolveTax";
import { runWithStoreContext, unscoped } from "@/lib/db";
import { dateOnlyToUtcMidnight, toDateOnly, todayAsDateOnly } from "@/lib/datetime/dateOnly";
import { authenticateApiCredential } from "@/lib/ecommerce/authenticateApiCredential";
import { getDefaultWarehouseId } from "@/lib/ecommerce/defaultWarehouse";
import { resolveFinancialYearForDate } from "@/lib/ecommerce/resolveFinancialYear";
import { resolveFulfilment, type FulfilmentAllocation } from "@/lib/ecommerce/resolveFulfilment";
import { ecommerceBillCreateSchema } from "@/lib/ecommerce/schemas";
import { transferStockForFulfilment } from "@/lib/ecommerce/transferForFulfilment";
import { allocateDocumentNumber } from "@/lib/numbering/allocateDocumentNumber";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";

class EcommerceBillError extends Error {}

// step7 §3/§5 — POST /v1/ecommerce/bills: records a confirmed/paid online
// order (payment itself stays outside this API). One order always produces
// exactly one bill, at one store — the caller's preferred store when it can
// cover the order alone; when it can't, whatever's short is auto-transferred
// in from another store the integration is allowed to sell from, so the
// customer still only ever sees a single order, and the billing store's own
// books show a normal transfer-in, not a second bill.
export async function POST(request: Request) {
  const auth = await authenticateApiCredential(request);
  if (!auth) {
    return apiErrorResponse("unauthorized", "Invalid or missing API credentials.", 401);
  }

  const parsed = await parseJsonOrRespond(request, ecommerceBillCreateSchema);
  if ("response" in parsed) return parsed.response;
  const data = parsed.data;

  const db = unscoped();
  const billDate = dateOnlyToUtcMidnight(
    data.billDate ? toDateOnly(data.billDate) : todayAsDateOnly(),
  );

  const financialYear = await resolveFinancialYearForDate(billDate);
  if (!financialYear) {
    return apiErrorResponse(
      "bad_request",
      "No active financial year covers this bill date — contact the store admin.",
      400,
    );
  }

  if (data.storeId && !auth.storeIds.includes(data.storeId)) {
    return apiErrorResponse("bad_request", "That store isn't available to this integration.", 400);
  }
  // The one store the order is billed from. Defaults to the credential's own
  // store — the caller can name a different one only from the set this
  // integration is allowed to sell from.
  const billingStoreId = data.storeId ?? auth.billingStoreId;

  const [store, terminal, billingWarehouseId] = await Promise.all([
    db.store.findUnique({ where: { id: billingStoreId }, include: { taxEngine: true } }),
    db.terminal.findFirst({
      where: { storeId: billingStoreId, isActive: true, isDeleted: false },
      orderBy: { name: "asc" },
    }),
    getDefaultWarehouseId(billingStoreId),
  ]);
  if (!store) return apiErrorResponse("not_found", "Store not found.", 404);
  if (!terminal) {
    return apiErrorResponse(
      "bad_request",
      "No active terminal configured for this store — contact a Super Admin.",
      400,
    );
  }

  let customer = await db.customer.findFirst({ where: { phone: data.customer.phone } });
  if (!customer) {
    customer = await db.customer.create({
      data: {
        name: data.customer.name,
        phone: data.customer.phone,
        email: data.customer.email ?? null,
        stores: { connect: [{ id: billingStoreId }] },
      },
    });
  } else {
    const linked = await db.customer.findFirst({
      where: { id: customer.id, stores: { some: { id: billingStoreId } } },
    });
    if (!linked) {
      await db.customer.update({
        where: { id: customer.id },
        data: { stores: { connect: [{ id: billingStoreId }] } },
      });
    }
  }

  const productIds = [...new Set(data.lines.map((line) => line.productId))];
  const products = await db.product.findMany({
    where: { id: { in: productIds } },
    include: { hsnCode: true },
  });
  const productById = new Map(products.map((p) => [p.id, p]));

  for (const line of data.lines) {
    const product = productById.get(line.productId);
    if (!product || !product.isActive || product.isDeleted) {
      return apiErrorResponse(
        "bad_request",
        `Product not found or inactive: ${line.productId}`,
        400,
      );
    }
  }

  // Lines that name a stock lock are already pinned to wherever that lock
  // reserved stock; everything else gets allocated fresh, preferring the
  // billing store before reaching into any other store this integration
  // can sell from.
  const pinned: (FulfilmentAllocation & { stockLockItemId: string })[] = [];
  const toAllocate: { productId: string; quantity: number }[] = [];

  try {
    for (const line of data.lines) {
      const product = productById.get(line.productId)!;
      if (!product.stockTracked) continue;

      if (!line.stockLockId) {
        toAllocate.push({ productId: line.productId, quantity: line.quantity });
        continue;
      }

      const lockMain = await db.stockBlockMain.findUnique({
        where: { id: line.stockLockId },
        include: { items: true },
      });
      const lockItem = lockMain?.items.find(
        (item) => item.productId === line.productId && item.status === "active",
      );
      if (
        !lockMain ||
        !auth.storeIds.includes(lockMain.storeId) ||
        lockMain.sourceType !== "ecommerce_order" ||
        !lockItem ||
        lockItem.quantityBlocked !== line.quantity
      ) {
        throw new EcommerceBillError(
          `Stock lock ${line.stockLockId} doesn't match this line — release it and lock again.`,
        );
      }
      pinned.push({
        storeId: lockMain.storeId,
        warehouseId: lockMain.warehouseId,
        productId: line.productId,
        quantity: line.quantity,
        stockLockItemId: lockItem.id,
      });
    }
  } catch (error) {
    if (error instanceof EcommerceBillError) {
      return apiErrorResponse("bad_request", error.message, 400);
    }
    throw error;
  }

  let freshAllocations: FulfilmentAllocation[] = [];
  if (toAllocate.length > 0) {
    const fulfilment = await resolveFulfilment({
      storeIds: auth.storeIds,
      preferredStoreId: billingStoreId,
      lines: toAllocate,
      allowSplit: auth.splitOrdersEnabled,
    });
    if (!fulfilment.ok) {
      return apiErrorResponse("bad_request", fulfilment.reason, 400);
    }
    freshAllocations = fulfilment.allocations;
  }

  if (
    freshAllocations.some((a) => a.storeId !== billingStoreId) ||
    pinned.some((p) => p.storeId !== billingStoreId)
  ) {
    if (!billingWarehouseId) {
      return apiErrorResponse(
        "bad_request",
        `Store "${store.name}" has no active warehouse to receive transferred stock.`,
        400,
      );
    }
  }

  const now = new Date();
  const result = await db.$transaction(async (tx) => {
    // Bring in anything sourced from another store first — after this, it's
    // physically at the billing store's own warehouse.
    await transferStockForFulfilment(tx, {
      allocations: [...pinned, ...freshAllocations],
      billingStoreId,
      destinationWarehouseId: billingWarehouseId ?? "",
      financialYearId: financialYear.id,
      userId: auth.createdByUserId,
      products: new Map(
        products.map((p) => [
          p.id,
          { name: p.name, systemBarcode: p.systemBarcode, price: p.price, hsnCode: p.hsnCode },
        ]),
      ),
    });

    const { documentNumber } = await allocateDocumentNumber(tx, {
      seriesType: "online_bill",
      storeId: billingStoreId,
      financialYearId: financialYear.id,
    });

    const bill = await tx.bill.create({
      data: {
        documentNumber,
        financialYearId: financialYear.id,
        billType: "online_bill",
        billDate,
        storeId: billingStoreId,
        terminalId: terminal.id,
        cashierUserId: auth.createdByUserId,
        customerId: customer!.id,
        customerName: customer!.name,
        customerPhone: customer!.phone,
        customerEmail: customer!.email,
        customerAddress: data.customer.address ?? null,
        customerPincode: data.customer.pincode ?? null,
        status: "completed",
        completedAt: now,
      },
    });

    for (const line of data.lines) {
      const product = productById.get(line.productId)!;
      const lineSubtotal = Number(product.price) * line.quantity;
      const tax = await resolveTax({
        productId: line.productId,
        lineSubtotal,
        storeTaxEngineCode: store.taxEngine?.code ?? null,
        storeStateId: store.stateId,
        customerStateId: customer!.stateId,
        excludeTax: false,
      });

      const billLine = await tx.billLine.create({
        data: {
          billId: bill.id,
          productId: line.productId,
          productName: product.name,
          productBarcode: product.systemBarcode,
          quantity: line.quantity,
          unitPrice: product.price,
          taxBreakdown: tax as never,
          lineTotal: lineSubtotal + tax.taxAmount,
        },
      });

      if (!product.stockTracked) continue;

      // Every unit ends up physically at the billing store now (transferred
      // in, if it wasn't already there) — the sale is recorded there too.
      const ownAllocations = [...pinned, ...freshAllocations].filter(
        (a) => a.productId === line.productId,
      );
      await replaceBillLineAllocations(tx, {
        billLineId: billLine.id,
        allocations: ownAllocations.map((a) => ({
          warehouseId: a.storeId === billingStoreId ? a.warehouseId : billingWarehouseId!,
          quantity: a.quantity,
        })),
      });

      for (const allocation of pinned) {
        if (allocation.productId !== line.productId) continue;
        await tx.stockBlockItem.update({
          where: { id: allocation.stockLockItemId },
          data: { status: "released", releasedByUserId: auth.createdByUserId, releasedAt: now },
        });
      }
    }

    return recomputeBillTotals(tx, bill.id);
  });

  await runWithStoreContext({ storeId: billingStoreId, userId: auth.createdByUserId }, () =>
    writeAuditLog({
      userId: auth.createdByUserId,
      storeId: billingStoreId,
      action: "create",
      entityType: "bill",
      entityId: result.id,
      afterData: result,
    }),
  );

  const lines = await db.billLine.findMany({ where: { billId: result.id } });
  return Response.json({ ...result, lines }, { status: 201 });
}
