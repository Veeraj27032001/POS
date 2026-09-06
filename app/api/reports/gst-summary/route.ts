import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import { unscoped } from "@/lib/db";
import type { TaxBreakdown } from "@/lib/billing/resolveTax";
import { apiErrorResponse } from "@/lib/validation/response";
import { withStoreContext } from "@/middleware/scope";

interface GstSummaryRow {
  hsnCode: string;
  description: string;
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTax: number;
}

export async function GET(request: Request) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "reports", "view")) {
    return apiErrorResponse("forbidden", "You don't have permission to view reports.", 403);
  }

  const url = new URL(request.url);
  const storeId = url.searchParams.get("storeId") || undefined;
  const dateFrom = url.searchParams.get("dateFrom") || undefined;
  const dateTo = url.searchParams.get("dateTo") || undefined;
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.max(1, Math.min(200, Number(url.searchParams.get("pageSize") ?? 25)));
  const countOnly = url.searchParams.get("countOnly") === "1";

  return withStoreContext(async () => {
    const db = unscoped();
    const effectiveStoreId = session.user.storeId ?? storeId;
    if (!effectiveStoreId) {
      return apiErrorResponse("bad_request", "Select a store first.", 400);
    }

    const billDateFilter: { gte?: Date; lte?: Date } = {};
    if (dateFrom) billDateFilter.gte = new Date(`${dateFrom}T00:00:00.000Z`);
    if (dateTo) billDateFilter.lte = new Date(`${dateTo}T23:59:59.999Z`);

    const lines = await db.billLine.findMany({
      where: {
        status: "active",
        bill: {
          storeId: effectiveStoreId,
          status: "completed",
          ...(dateFrom || dateTo ? { billDate: billDateFilter } : {}),
        },
      },
      select: {
        lineTotal: true,
        taxBreakdown: true,
        product: { select: { hsnCode: { select: { hsnCode: true, description: true } } } },
      },
    });

    const byHsn = new Map<string, GstSummaryRow>();
    let noHsnRow: GstSummaryRow | null = null;

    for (const line of lines) {
      const tax = line.taxBreakdown as unknown as TaxBreakdown;
      const taxAmount = tax?.taxAmount ?? 0;
      const taxableValue = Number(line.lineTotal) - taxAmount;
      const hsn = line.product.hsnCode;

      let row: GstSummaryRow;
      if (!hsn) {
        if (!noHsnRow) {
          noHsnRow = {
            hsnCode: "—",
            description: "No HSN code",
            taxableValue: 0,
            cgstAmount: 0,
            sgstAmount: 0,
            igstAmount: 0,
            totalTax: 0,
          };
        }
        row = noHsnRow;
      } else {
        const existing = byHsn.get(hsn.hsnCode);
        if (existing) {
          row = existing;
        } else {
          row = {
            hsnCode: hsn.hsnCode,
            description: hsn.description,
            taxableValue: 0,
            cgstAmount: 0,
            sgstAmount: 0,
            igstAmount: 0,
            totalTax: 0,
          };
          byHsn.set(hsn.hsnCode, row);
        }
      }

      row.taxableValue += taxableValue;
      row.cgstAmount += tax?.cgstAmount ?? 0;
      row.sgstAmount += tax?.sgstAmount ?? 0;
      row.igstAmount += tax?.igstAmount ?? 0;
      row.totalTax += taxAmount;
    }

    let allRows = [...byHsn.values()].sort((a, b) => a.hsnCode.localeCompare(b.hsnCode));
    if (noHsnRow) allRows = [...allRows, noHsnRow];
    allRows = allRows.map((row) => ({
      ...row,
      taxableValue: Math.round(row.taxableValue * 100) / 100,
      cgstAmount: Math.round(row.cgstAmount * 100) / 100,
      sgstAmount: Math.round(row.sgstAmount * 100) / 100,
      igstAmount: Math.round(row.igstAmount * 100) / 100,
      totalTax: Math.round(row.totalTax * 100) / 100,
    }));

    const grandTotalTax =
      Math.round(allRows.reduce((sum, row) => sum + row.totalTax, 0) * 100) / 100;

    const totalRecords = allRows.length;
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    const clampedPage = Math.min(page, totalPages);
    const data = countOnly
      ? []
      : allRows.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    return Response.json({
      totalRecords,
      totalPages,
      page: clampedPage,
      pageSize,
      data,
      grandTotalTax,
    });
  });
}
