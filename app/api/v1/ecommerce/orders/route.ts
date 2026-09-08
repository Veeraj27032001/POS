import { runWithStoreContext, unscoped } from "@/lib/db";
import { dateOnlyToUtcMidnight, toDateOnly, todayAsDateOnly } from "@/lib/datetime/dateOnly";
import { authenticateApiCredential } from "@/lib/ecommerce/authenticateApiCredential";
import { resolveFinancialYearForDate } from "@/lib/ecommerce/resolveFinancialYear";
import { resolveFulfilment, type FulfilmentAllocation } from "@/lib/ecommerce/resolveFulfilment";
import { ecommerceOrderCreateSchema } from "@/lib/ecommerce/schemas";
import { allocateDocumentNumber } from "@/lib/numbering/allocateDocumentNumber";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";

class EcommerceOrderError extends Error {}

// step7 (extended) — POST /v1/ecommerce/orders: records a paid-on-the-
// storefront-side order as a PENDING order awaiting staff acceptance — it
// never directly creates a Bill/invoice. Every line's stock is locked
// wherever it actually is (possibly split across more than one store, if
// fulfilling it that way is enabled) — nothing is physically moved yet.
// Staff decide the real sourcing at Generate Bill time.
export async function POST(request: Request) {
  const auth = await authenticateApiCredential(request);
  if (!auth) {
    return apiErrorResponse("unauthorized", "Invalid or missing API credentials.", 401);
  }

  const parsed = await parseJsonOrRespond(request, ecommerceOrderCreateSchema);
  if ("response" in parsed) return parsed.response;
  const data = parsed.data;

  const db = unscoped();
  const orderDate = dateOnlyToUtcMidnight(
    data.orderDate ? toDateOnly(data.orderDate) : todayAsDateOnly(),
  );

  const financialYear = await resolveFinancialYearForDate(orderDate);
  if (!financialYear) {
    return apiErrorResponse(
      "bad_request",
      "No active financial year covers this order date — contact the store admin.",
      400,
    );
  }

  if (data.storeId && !auth.storeIds.includes(data.storeId)) {
    return apiErrorResponse("bad_request", "That store isn't available to this integration.", 400);
  }
  const billingStoreId = data.storeId ?? auth.billingStoreId;

  const store = await db.store.findUnique({ where: { id: billingStoreId } });
  if (!store) return apiErrorResponse("not_found", "Store not found.", 404);

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
  const products = await db.product.findMany({ where: { id: { in: productIds } } });
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

  // A line naming a stock lock is already reserved somewhere; everything
  // else gets resolved fresh, preferring the billing store before reaching
  // into any other eligible one — same as before. The difference now is
  // what happens with the result: no consolidation, no transfer, each
  // allocation just becomes its own lock at wherever it actually is.
  type OwnAllocation = FulfilmentAllocation & { stockBlockMainId?: string };
  const pinned: OwnAllocation[] = [];
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
        throw new EcommerceOrderError(
          `Stock lock ${line.stockLockId} doesn't match this line — release it and lock again.`,
        );
      }
      pinned.push({
        storeId: lockMain.storeId,
        warehouseId: lockMain.warehouseId,
        productId: line.productId,
        quantity: line.quantity,
        stockBlockMainId: lockMain.id,
      });
    }
  } catch (error) {
    if (error instanceof EcommerceOrderError) {
      return apiErrorResponse("bad_request", error.message, 400);
    }
    throw error;
  }

  let freshAllocations: OwnAllocation[] = [];
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

  const now = new Date();
  const result = await db.$transaction(async (tx) => {
    const { documentNumber } = await allocateDocumentNumber(tx, {
      seriesType: "ecommerce_order",
      storeId: billingStoreId,
      financialYearId: financialYear.id,
    });

    const order = await tx.ecommerceOrder.create({
      data: {
        documentNumber,
        financialYearId: financialYear.id,
        apiCredentialId: auth.credentialId,
        storeId: billingStoreId,
        customerId: customer!.id,
        customerName: data.customer.name,
        customerPhone: data.customer.phone,
        customerEmail: customer!.email,
        customerAddress: data.customer.address ?? null,
        customerCity: data.customer.city ?? null,
        customerTaluk: data.customer.taluk ?? null,
        customerStateName: data.customer.state ?? null,
        customerCountryName: data.customer.country ?? null,
        customerPincode: data.customer.pincode ?? null,
        status: "pending",
      },
    });

    if (data.payment) {
      await tx.ecommerceOrderPayment.create({
        data: {
          ecommerceOrderId: order.id,
          method: data.payment.method,
          reference: data.payment.reference ?? null,
          amount: data.payment.amount,
        },
      });
    }

    for (const line of data.lines) {
      const product = productById.get(line.productId)!;

      const item = await tx.ecommerceOrderItem.create({
        data: {
          ecommerceOrderId: order.id,
          productId: line.productId,
          productName: product.name,
          productBarcode: product.systemBarcode,
          quantity: line.quantity,
          unitPrice: product.price,
        },
      });

      if (!product.stockTracked) continue;

      const ownAllocations = [...pinned, ...freshAllocations].filter(
        (a) => a.productId === line.productId,
      );

      for (const allocation of ownAllocations) {
        let stockLockId = allocation.stockBlockMainId;

        if (!stockLockId) {
          const { documentNumber: lockDocNumber } = await allocateDocumentNumber(tx, {
            seriesType: "stock_block",
            storeId: allocation.storeId,
            financialYearId: financialYear.id,
          });
          const lockMain = await tx.stockBlockMain.create({
            data: {
              documentNumber: lockDocNumber,
              financialYearId: financialYear.id,
              storeId: allocation.storeId,
              warehouseId: allocation.warehouseId,
              sourceType: "ecommerce_order",
              sourceId: order.id,
              expiresAt: null,
              blockedByUserId: auth.createdByUserId,
              blockedAt: now,
            },
          });
          await tx.stockBlockItem.create({
            data: {
              stockBlockMainId: lockMain.id,
              productId: line.productId,
              productName: product.name,
              productBarcode: product.systemBarcode,
              productPrice: product.price,
              quantityBlocked: allocation.quantity,
              reasonCodeId: reasonCode.id,
            },
          });
          stockLockId = lockMain.id;
        }

        await tx.ecommerceOrderItemLock.create({
          data: {
            ecommerceOrderItemId: item.id,
            storeId: allocation.storeId,
            warehouseId: allocation.warehouseId,
            stockLockId,
            quantity: allocation.quantity,
          },
        });
      }
    }

    return order;
  });

  await runWithStoreContext({ storeId: billingStoreId, userId: auth.createdByUserId }, () =>
    writeAuditLog({
      userId: auth.createdByUserId,
      storeId: billingStoreId,
      action: "create",
      entityType: "ecommerce_order",
      entityId: result.id,
    }),
  );

  const items = await db.ecommerceOrderItem.findMany({
    where: { ecommerceOrderId: result.id },
    include: { locks: true },
  });
  return Response.json({ ...result, items }, { status: 201 });
}
