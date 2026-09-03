import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { unscoped } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

export async function GET(request: Request) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "products", "view")) {
    return apiErrorResponse("forbidden", "You don't have permission to view products.", 403);
  }

  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.trim() || undefined;
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.max(1, Math.min(200, Number(url.searchParams.get("pageSize") ?? 25)));
  const countOnly = url.searchParams.get("countOnly") === "1";

  return withStoreContext(async () => {
    const where = {
      isActive: true,
      isDeleted: false,
      skuBarcode: { not: null },
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { skuBarcode: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const db = unscoped();
    const totalRecords = await db.product.count({ where });
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    const clampedPage = Math.min(page, totalPages);

    const data = countOnly
      ? []
      : await db.product.findMany({
          where,
          select: { id: true, name: true, skuBarcode: true, price: true },
          orderBy: { name: "asc" },
          skip: (clampedPage - 1) * pageSize,
          take: pageSize,
        });

    return Response.json({ totalRecords, totalPages, page: clampedPage, pageSize, data });
  });
}
