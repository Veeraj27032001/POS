import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { unscoped } from "@/lib/db";
import { dateOnlyToUtcMidnight, toDateOnly } from "@/lib/datetime/dateOnly";
import { stockTransferCreateSchema } from "@/lib/documents/schemas";
import { allocateDocumentNumber } from "@/lib/numbering/allocateDocumentNumber";
import { getStockLevels } from "@/lib/stock/getStockLevels";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

class ValidationError extends Error {}

async function requireSession(action: string) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return { error: apiErrorResponse("unauthorized", "You must be signed in.", 401) } as const;
  }
  if (!hasPermission(session.user.permissions, "stock", action)) {
    return {
      error: apiErrorResponse("forbidden", `You don't have permission to ${action} stock.`, 403),
    } as const;
  }
  return { session } as const;
}

export async function GET(request: Request) {
  const authResult = await requireSession("view");
  if ("error" in authResult) return authResult.error;
  const { session } = authResult;

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.max(1, Math.min(200, Number(url.searchParams.get("pageSize") ?? 25)));

  return withStoreContext(async () => {
    const db = unscoped();
    const where = {
      ...(session.user.storeId ? { storeId: session.user.storeId } : {}),
      ...(session.user.financialYearId ? { financialYearId: session.user.financialYearId } : {}),
    };

    const totalRecords = await db.stockTransferMain.count({ where });
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    const data = await db.stockTransferMain.findMany({
      where,
      orderBy: { requestedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return Response.json({ totalRecords, totalPages, page, pageSize, data });
  });
}

export async function POST(request: Request) {
  const authResult = await requireSession("create");
  if ("error" in authResult) return authResult.error;
  const { session } = authResult;

  if (!session.user.financialYearId) {
    return apiErrorResponse("bad_request", "Select a financial year first.", 400);
  }
  if (!session.user.storeId) {
    return apiErrorResponse(
      "forbidden",
      "A Super Admin session has no single store — sign in as a store user to create documents.",
      403,
    );
  }

  const parsed = await parseJsonOrRespond(request, stockTransferCreateSchema);
  if ("response" in parsed) return parsed.response;
  const data = parsed.data;

  return withStoreContext(async () => {
    const db = unscoped();

    const sourceWarehouse = await db.warehouse.findUnique({
      where: { id: data.sourceWarehouseId },
    });
    if (!sourceWarehouse || sourceWarehouse.storeId !== session.user.storeId) {
      return apiErrorResponse(
        "bad_request",
        "Select a source storage location belonging to your store.",
        400,
      );
    }

    let destinationStoreId: string;
    let sameStoreDestinationWarehouseId: string | null = null;

    if (data.destinationType === "warehouse") {
      const destWarehouse = await db.warehouse.findUnique({ where: { id: data.destinationId } });
      if (!destWarehouse || destWarehouse.storeId !== session.user.storeId) {
        return apiErrorResponse(
          "bad_request",
          "Select a destination storage location belonging to your own store.",
          400,
        );
      }
      if (destWarehouse.id === sourceWarehouse.id) {
        return apiErrorResponse(
          "bad_request",
          "Destination storage location must be different from the source storage location.",
          400,
        );
      }
      destinationStoreId = session.user.storeId!;
      sameStoreDestinationWarehouseId = destWarehouse.id;
    } else {
      const destStore = await db.store.findUnique({ where: { id: data.destinationId } });
      if (!destStore || !destStore.isActive) {
        return apiErrorResponse("bad_request", "Select an active destination store.", 400);
      }
      if (destStore.id === session.user.storeId) {
        return apiErrorResponse(
          "bad_request",
          "For a transfer within your own store, pick a destination storage location instead of a store.",
          400,
        );
      }
      destinationStoreId = destStore.id;
    }

    for (const item of data.items) {
      const { available } = await getStockLevels({
        productId: item.productId,
        warehouseId: sourceWarehouse.id,
      });
      if (item.quantity > available) {
        return apiErrorResponse(
          "bad_request",
          `Cannot transfer ${item.quantity} — only ${available} available at the source warehouse.`,
          400,
        );
      }
    }

    const isSameStore = sameStoreDestinationWarehouseId !== null;
    const transferDate = dateOnlyToUtcMidnight(toDateOnly(data.transferDate));

    try {
      const result = await db.$transaction(async (tx) => {
        const { documentNumber } = await allocateDocumentNumber(tx, {
          seriesType: "stock_transfer",
          storeId: session.user.storeId!,
          financialYearId: session.user.financialYearId!,
        });

        const products = await tx.product.findMany({
          where: { id: { in: data.items.map((item) => item.productId) } },
          include: { hsnCode: { select: { hsnCode: true } } },
        });
        const productById = new Map(products.map((p) => [p.id, p]));

        const now = new Date();
        const main = await tx.stockTransferMain.create({
          data: {
            documentNumber,
            financialYearId: session.user.financialYearId!,
            storeId: session.user.storeId!,
            sourceWarehouseId: sourceWarehouse.id,
            destinationStoreId,
            status: isSameStore ? "accepted" : "pending",
            requestedByUserId: session.user.id,
            requestedAt: transferDate,
            respondedByUserId: isSameStore ? session.user.id : null,
            respondedAt: isSameStore ? now : null,
            receivedDate: isSameStore ? transferDate : null,
            notes: data.notes ?? null,
          },
        });

        const items = [];
        for (const item of data.items) {
          const product = productById.get(item.productId);
          if (!product) throw new ValidationError(`Unknown product: ${item.productId}`);
          items.push(
            await tx.stockTransferItem.create({
              data: {
                stockTransferMainId: main.id,
                productId: item.productId,
                productName: product.name,
                productBarcode: product.systemBarcode,
                productPrice: product.price,
                productHsnCode: product.hsnCode?.hsnCode ?? null,
                quantity: item.quantity,
                destinationWarehouseId: sameStoreDestinationWarehouseId,
                quantityAccepted: isSameStore ? item.quantity : null,
                quantityRejected: isSameStore ? 0 : null,
              },
            }),
          );
        }

        if (!isSameStore) {
          const reason = await tx.reasonCode.findFirst({
            where: { category: "stock_block", label: "Reserved — pending transfer" },
          });
          if (!reason) {
            throw new ValidationError("Missing the 'Reserved — pending transfer' reason code.");
          }

          const { documentNumber: blockDocumentNumber } = await allocateDocumentNumber(tx, {
            seriesType: "stock_block",
            storeId: session.user.storeId!,
            financialYearId: session.user.financialYearId!,
          });

          const blockMain = await tx.stockBlockMain.create({
            data: {
              documentNumber: blockDocumentNumber,
              financialYearId: session.user.financialYearId!,
              storeId: session.user.storeId!,
              warehouseId: sourceWarehouse.id,
              sourceType: "pending_transfer",
              sourceId: main.id,
              blockedByUserId: session.user.id,
              blockedAt: now,
            },
          });

          for (const item of data.items) {
            const product = productById.get(item.productId)!;
            await tx.stockBlockItem.create({
              data: {
                stockBlockMainId: blockMain.id,
                productId: item.productId,
                productName: product.name,
                productBarcode: product.systemBarcode,
                productPrice: product.price,
                productHsnCode: product.hsnCode?.hsnCode ?? null,
                quantityBlocked: item.quantity,
                reasonCodeId: reason.id,
              },
            });
          }
        }

        return { main, items };
      });

      await writeAuditLog({
        userId: session.user.id,
        storeId: session.user.storeId,
        action: "create",
        entityType: "stock_transfer",
        entityId: result.main.id,
        afterData: result,
      });

      return Response.json(result, { status: 201 });
    } catch (error) {
      if (error instanceof ValidationError) {
        return apiErrorResponse("bad_request", error.message, 400);
      }
      throw error;
    }
  });
}
