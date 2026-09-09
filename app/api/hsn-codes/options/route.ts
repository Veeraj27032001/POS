import { auth } from "@/auth";
import { unscoped } from "@/lib/db";
import { apiErrorResponse } from "@/lib/validation/response";

// Lightly gated, like stores/options — every user needs to pick an HSN
// code when creating a product, even though managing the HSN Code master
// itself stays Super-Admin-only.
//
// The HSN Code master is a full GST catalog (20,000+ rows) — returning it
// all unconditionally, as this route originally did, meant SearchableSelect
// rendered 20,000+ DOM nodes on every open, appearing to hang. Search now
// happens server-side, capped to a page small enough to actually render.
const RESULT_LIMIT = 50;

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const search = searchParams.get("search")?.trim();

  const db = unscoped();

  // Resolves a single already-selected value's label — the search list
  // itself only ever holds a capped page, so a previously-picked code
  // outside that page still needs its own lookup to display correctly.
  if (id) {
    const hsnCode = await db.hsnCode.findFirst({
      where: { id, isActive: true, isDeleted: false },
      select: { id: true, hsnCode: true },
    });
    return Response.json({ data: hsnCode ? [hsnCode] : [] });
  }

  const hsnCodes = await db.hsnCode.findMany({
    where: {
      isActive: true,
      isDeleted: false,
      ...(search
        ? {
            OR: [
              { hsnCode: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { hsnCode: "asc" },
    select: { id: true, hsnCode: true },
    take: RESULT_LIMIT,
  });

  return Response.json({
    data: hsnCodes,
    totalRecords: hsnCodes.length,
    totalPages: 1,
    page: 1,
    pageSize: RESULT_LIMIT,
  });
}
