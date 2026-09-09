import { unscoped } from "@/lib/db";
import {
  DEFAULT_BILL_TEMPLATE_HTML,
  DEFAULT_CREDIT_NOTE_TEMPLATE_HTML,
  DEFAULT_RECEIPT_TEMPLATE_HTML,
  DEFAULT_REFUND_TEMPLATE_HTML,
} from "@/lib/billing/defaultBillFormatTemplates";

const BILL_TYPES = ["cash_bill", "credit_bill", "online_bill"] as const;
const FORMAT_KINDS = [
  { formatKind: "bill" as const, templateHtml: DEFAULT_BILL_TEMPLATE_HTML },
  { formatKind: "receipt" as const, templateHtml: DEFAULT_RECEIPT_TEMPLATE_HTML },
  { formatKind: "credit_note" as const, templateHtml: DEFAULT_CREDIT_NOTE_TEMPLATE_HTML },
  { formatKind: "refund" as const, templateHtml: DEFAULT_REFUND_TEMPLATE_HTML },
];
const DEFAULT_EFFECTIVE_FROM = new Date("2020-01-01T00:00:00.000Z");

export async function createDefaultBillFormats(storeId: string) {
  const db = unscoped();
  let createdCount = 0;

  for (const billType of BILL_TYPES) {
    for (const { formatKind, templateHtml } of FORMAT_KINDS) {
      const existing = await db.billFormat.findFirst({
        where: { storeId, billType, formatKind, isDeleted: false },
      });
      if (existing) continue;

      await db.billFormat.create({
        data: {
          storeId,
          billType,
          formatKind,
          name: "Default",
          effectiveFrom: DEFAULT_EFFECTIVE_FROM,
          templateHtml,
          isDefault: true,
        },
      });
      createdCount += 1;
    }
  }

  return { createdCount };
}
