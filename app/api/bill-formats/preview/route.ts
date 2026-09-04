import { z } from "zod";

import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/rbac";
import { asAppSession } from "@/lib/auth/types";
import {
  renderBillTemplate,
  renderCreditNoteTemplate,
  renderRefundTemplate,
} from "@/lib/billing/renderBillTemplate";
import {
  SAMPLE_BILL_DATA,
  SAMPLE_CREDIT_NOTE_DATA,
  SAMPLE_REFUND_DATA,
} from "@/lib/billing/sampleBillFormatData";
import { apiErrorResponse, parseJsonOrRespond } from "@/lib/validation/response";

const previewSchema = z.object({
  formatKind: z.enum(["receipt", "bill", "credit_note", "refund"]),
  templateHtml: z.string().min(1, "Template HTML is required."),
});

export async function POST(request: Request) {
  const session = asAppSession(await auth());
  if (!session?.user) {
    return apiErrorResponse("unauthorized", "You must be signed in.", 401);
  }
  if (!hasPermission(session.user.permissions, "bill_formats", "view")) {
    return apiErrorResponse("forbidden", "You don't have permission to view this.", 403);
  }

  const parsed = await parseJsonOrRespond(request, previewSchema);
  if ("response" in parsed) return parsed.response;
  const { formatKind, templateHtml } = parsed.data;

  let html: string;
  try {
    if (formatKind === "credit_note") {
      html = renderCreditNoteTemplate(templateHtml, SAMPLE_CREDIT_NOTE_DATA);
    } else if (formatKind === "refund") {
      html = renderRefundTemplate(templateHtml, SAMPLE_REFUND_DATA);
    } else {
      html = renderBillTemplate(templateHtml, SAMPLE_BILL_DATA);
    }
  } catch (err) {
    return apiErrorResponse(
      "bad_request",
      err instanceof Error ? `Template error: ${err.message}` : "Failed to render the template.",
      400,
    );
  }

  return Response.json({ html });
}
