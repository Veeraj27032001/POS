import { recomputeBillTotals } from "@/lib/billing/recomputeBillTotals";
import { replaceBillLineAllocations } from "@/lib/billing/allocateBillLineStock";
import { resolveTax } from "@/lib/billing/resolveTax";
import { runWithStoreContext, unscoped } from "@/lib/db";
import { dateOnlyToUtcMidnight, todayAsDateOnly, toDateOnly } from "@/lib/datetime/dateOnly";
import { authenticateApiCredential } from "@/lib/ecommerce/authenticateApiCredential";
import { resolveFinancialYearForDate } from "@/lib/ecommerce/resolveFinancialYear";
import { ecommerceBillCreateSchema } from "@/lib/ecommerce/schemas";
import { allocateDocumentNumber } from "@/lib/numbering/allocateDocumentNumber";
import { writeAuditLog } from "@/lib/security/audit";
import { getStockLevels } from "@/lib/stock/getStockLevels";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";

class EcommerceBillError extends Error {}

// step7 §3/§5 — POST /v1/ecommerce/bills: creates a completed Online Bill,
// called once the order is confirmed/paid on the e-commerce app's own side
// (payment itself stays outside this API). Releases any stock locks the
// lines reference and permanently deducts stock the same way any other
// completed bill does.
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

  const [store, terminal] = await Promise.all([
    db.store.findUnique({ where: { id: auth.storeId }, include: { taxEngine: true } }),
    db.terminal.findFirst({
      where: { storeId: auth.storeId, isActive: true, isDeleted: false },
      orderBy: { name: "asc" },
    }),
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
        stores: { connect: [{ id: auth.storeId }] },
      },
    });
  } else {
    const alreadyLinked = await db.customer.findFirst({
      where: { id: customer.id, stores: { some: { id: auth.storeId } } },
    });
    if (!alreadyLinked) {
      await db.customer.update({
        where: { id: customer.id },
        data: { stores: { connect: [{ id: auth.storeId }] } },
      });
    }
  }

  const productIds = [...new Set(data.lines.map((line) => line.productId))];
  const products = await db.product.findMany({
    where: { id: { in: productIds } },
    include: { hsnCode: true },
  });
  const productById = new Map(products.map((p) => [p.id, p]));

  const preparedLines: {
    product: (typeof products)[number];
    warehouseId: string;
    quantity: number;
    stockLockItemId?: string;
    lineSubtotal: number;
    tax: Awaited<ReturnType<typeof resolveTax>>;
    lineTotal: number;
  }[] = [];

  try {
    for (const line of data.lines) {
      const product = productById.get(line.productId);
      if (!product || !product.isActive || product.isDeleted) {
        throw new EcommerceBillError(`Product not found or inactive: ${line.productId}`);
      }

      const warehouse = await db.warehouse.findUnique({ where: { id: line.warehouseId } });
      if (!warehouse || warehouse.storeId !== auth.storeId) {
        throw new EcommerceBillError(`Warehouse not found for this store: ${line.warehouseId}`);
      }

      let stockLockItemId: string | undefined;
      if (product.stockTracked) {
        if (line.stockLockId) {
          const lockMain = await db.stockBlockMain.findUnique({
            where: { id: line.stockLockId },
            include: { items: true },
          });
          const lockItem = lockMain?.items.find(
            (item) => item.productId === line.productId && item.status === "active",
          );
          if (
            !lockMain ||
            lockMain.storeId !== auth.storeId ||
            lockMain.sourceType !== "ecommerce_order" ||
            lockMain.warehouseId !== line.warehouseId ||
            !lockItem ||
            lockItem.quantityBlocked !== line.quantity
          ) {
            throw new EcommerceBillError(
              `Stock lock ${line.stockLockId} doesn't match this line — release it and lock again.`,
            );
          }
          stockLockItemId = lockItem.id;
        } else {
          const { available } = await getStockLevels({
            productId: product.id,
            warehouseId: line.warehouseId,
          });
          if (line.quantity > available) {
            throw new EcommerceBillError(
              `Only ${available} of ${product.name} available at that warehouse.`,
            );
          }
        }
      }

      const lineSubtotal = Number(product.price) * line.quantity;
      const tax = await resolveTax({
        productId: product.id,
        lineSubtotal,
        storeTaxEngineCode: store.taxEngine?.code ?? null,
        storeStateId: store.stateId,
        customerStateId: customer.stateId,
        excludeTax: false,
      });

      preparedLines.push({
        product,
        warehouseId: line.warehouseId,
        quantity: line.quantity,
        stockLockItemId,
        lineSubtotal,
        tax,
        lineTotal: lineSubtotal + tax.taxAmount,
      });
    }
  } catch (error) {
    if (error instanceof EcommerceBillError) {
      return apiErrorResponse("bad_request", error.message, 400);
    }
    throw error;
  }

  const now = new Date();
  const result = await db.$transaction(async (tx) => {
    const { documentNumber } = await allocateDocumentNumber(tx, {
      seriesType: "online_bill",
      storeId: auth.storeId,
      financialYearId: financialYear.id,
    });

    const bill = await tx.bill.create({
      data: {
        documentNumber,
        financialYearId: financialYear.id,
        billType: "online_bill",
        billDate,
        storeId: auth.storeId,
        terminalId: terminal.id,
        cashierUserId: auth.createdByUserId,
        customerId: customer!.id,
        customerName: customer!.name,
        customerPhone: customer!.phone,
        customerEmail: customer!.email,
        status: "completed",
        completedAt: now,
      },
    });

    for (const line of preparedLines) {
      const billLine = await tx.billLine.create({
        data: {
          billId: bill.id,
          productId: line.product.id,
          productName: line.product.name,
          productBarcode: line.product.systemBarcode,
          quantity: line.quantity,
          unitPrice: line.product.price,
          taxBreakdown: line.tax as never,
          lineTotal: line.lineTotal,
        },
      });

      if (line.product.stockTracked) {
        await replaceBillLineAllocations(tx, {
          billLineId: billLine.id,
          allocations: [{ warehouseId: line.warehouseId, quantity: line.quantity }],
        });
        if (line.stockLockItemId) {
          await tx.stockBlockItem.update({
            where: { id: line.stockLockItemId },
            data: { status: "released", releasedByUserId: auth.createdByUserId, releasedAt: now },
          });
        }
      }
    }

    return recomputeBillTotals(tx, bill.id);
  });

  await runWithStoreContext({ storeId: auth.storeId, userId: auth.createdByUserId }, () =>
    writeAuditLog({
      userId: auth.createdByUserId,
      storeId: auth.storeId,
      action: "create",
      entityType: "bill",
      entityId: result.id,
      afterData: result,
    }),
  );

  const lines = await db.billLine.findMany({ where: { billId: result.id } });

  return Response.json({ ...result, lines }, { status: 201 });
}
