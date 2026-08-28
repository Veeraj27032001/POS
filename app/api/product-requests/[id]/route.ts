import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { unscoped } from "@/lib/db";
import { dateOnlyToUtcMidnight, toDateOnly } from "@/lib/datetime/dateOnly";
import {
  productRequestEditSchema,
  productRequestUpdateStatusSchema,
} from "@/lib/documents/schemas";
import { writeAuditLog } from "@/lib/security/audit";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

import { productRequestResource } from "@/lib/documents/resources";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return productRequestResource.getOne(request, id);
}

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ["sent", "cancelled"],
  sent: ["cancelled", "draft"],
  partially_received: ["cancelled"],
  cancelled: ["draft"],
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "stock", "update")) {
    return apiErrorResponse("forbidden", "You don't have permission to update stock.", 403);
  }

  const { id } = await params;
  const parsed = await parseJsonOrRespond(request, productRequestUpdateStatusSchema);
  if ("response" in parsed) return parsed.response;

  return withStoreContext(async () => {
    const db = unscoped();
    const existing = await db.productRequestMain.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existing) return apiErrorResponse("not_found", "Record not found.", 404);

    const allowed = ALLOWED_TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(parsed.data.status)) {
      return apiErrorResponse(
        "bad_request",
        `Can't move a ${existing.status} request to ${parsed.data.status}.`,
        400,
      );
    }

    if (
      parsed.data.status === "draft" &&
      existing.items.some((item) => item.quantityReceived > 0)
    ) {
      return apiErrorResponse(
        "bad_request",
        "Can't revert to draft — items have already been received against this request.",
        400,
      );
    }

    const updated = await db.productRequestMain.update({
      where: { id },
      data: { status: parsed.data.status },
    });

    await writeAuditLog({
      userId: session.user.id,
      storeId: session.user.storeId,
      action: "update",
      entityType: "product_request",
      entityId: id,
      beforeData: existing,
      afterData: updated,
    });

    return Response.json(updated);
  });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "stock", "update")) {
    return apiErrorResponse("forbidden", "You don't have permission to update stock.", 403);
  }

  const { id } = await params;
  const parsed = await parseJsonOrRespond(request, productRequestEditSchema);
  if ("response" in parsed) return parsed.response;

  return withStoreContext(async () => {
    const db = unscoped();
    const existing = await db.productRequestMain.findUnique({ where: { id } });
    if (!existing) return apiErrorResponse("not_found", "Record not found.", 404);
    if (existing.status !== "draft") {
      return apiErrorResponse(
        "bad_request",
        "Can only edit a request while it's still in draft.",
        400,
      );
    }

    const products = await db.product.findMany({
      where: { id: { in: parsed.data.items.map((item) => item.productId) } },
      include: { hsnCode: { select: { hsnCode: true } } },
    });
    const productById = new Map(products.map((p) => [p.id, p]));

    const result = await db.$transaction(async (tx) => {
      const updated = await tx.productRequestMain.update({
        where: { id },
        data: {
          supplierId: parsed.data.supplierId,
          requestDate: dateOnlyToUtcMidnight(toDateOnly(parsed.data.requestDate)),
        },
      });

      await tx.productRequestItem.deleteMany({ where: { productRequestMainId: id } });

      const items = [];
      for (const item of parsed.data.items) {
        const product = productById.get(item.productId);
        if (!product) {
          throw new Error(`Unknown product: ${item.productId}`);
        }
        items.push(
          await tx.productRequestItem.create({
            data: {
              productRequestMainId: id,
              productId: item.productId,
              productName: product.name,
              productBarcode: product.systemBarcode,
              productPrice: product.price,
              productHsnCode: product.hsnCode?.hsnCode ?? null,
              quantityRequested: item.quantityRequested,
              expectedUnitCost: item.expectedUnitCost ?? null,
            },
          }),
        );
      }

      return { main: updated, items };
    });

    await writeAuditLog({
      userId: session.user.id,
      storeId: session.user.storeId,
      action: "update",
      entityType: "product_request",
      entityId: id,
      beforeData: existing,
      afterData: result,
    });

    return Response.json(result);
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "stock", "delete")) {
    return apiErrorResponse("forbidden", "You don't have permission to delete stock records.", 403);
  }

  const { id } = await params;

  return withStoreContext(async () => {
    const db = unscoped();
    const existing = await db.productRequestMain.findUnique({ where: { id } });
    if (!existing) return apiErrorResponse("not_found", "Record not found.", 404);
    if (existing.status !== "draft") {
      return apiErrorResponse(
        "bad_request",
        "Can only delete a request while it's still in draft.",
        400,
      );
    }

    await db.productRequestMain.delete({ where: { id } });

    await writeAuditLog({
      userId: session.user.id,
      storeId: session.user.storeId,
      action: "delete",
      entityType: "product_request",
      entityId: id,
      beforeData: existing,
    });

    return Response.json({ id });
  });
}
