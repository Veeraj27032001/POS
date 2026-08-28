import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { unscoped } from "@/lib/db";
import { productSupplierPriceCreateSchema } from "@/lib/masters/schemas";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "products", "view")) {
    return apiErrorResponse("forbidden", "You don't have permission to view products.", 403);
  }

  const { id } = await params;
  return withStoreContext(async () => {
    const prices = await unscoped().productSupplierPrice.findMany({
      where: { productId: id, isDeleted: false },
      orderBy: { createdAt: "desc" },
    });
    return Response.json({ data: prices });
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "products", "update")) {
    return apiErrorResponse("forbidden", "You don't have permission to update products.", 403);
  }

  const { id } = await params;
  const parsed = await parseJsonOrRespond(request, productSupplierPriceCreateSchema);
  if ("response" in parsed) return parsed.response;

  return withStoreContext(async () => {
    const db = unscoped();
    const [, created] = await db.$transaction([
      db.productSupplierPrice.updateMany({
        where: { productId: id, supplierId: parsed.data.supplierId, isDeleted: false },
        data: { isDeleted: true },
      }),
      db.productSupplierPrice.create({
        data: {
          productId: id,
          supplierId: parsed.data.supplierId,
          cost: parsed.data.cost,
          createdByUserId: session.user.id,
        },
      }),
    ]);
    return Response.json(created, { status: 201 });
  });
}
