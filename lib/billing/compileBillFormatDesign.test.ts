import { describe, expect, it } from "vitest";

import type { BillFormatDesign } from "./billFormatDesign.types";
import { compileBillFormatDesign } from "./compileBillFormatDesign";
import { DEFAULT_BILL_FORMAT_DESIGNS } from "./defaultBillFormatDesigns";
import {
  renderBillTemplate,
  renderCreditNoteTemplate,
  renderRefundTemplate,
} from "./renderBillTemplate";
import {
  SAMPLE_BILL_DATA,
  SAMPLE_CREDIT_NOTE_DATA,
  SAMPLE_REFUND_DATA,
} from "./sampleBillFormatData";

describe("compileBillFormatDesign", () => {
  it("compiles and renders the default bill design", () => {
    const html = compileBillFormatDesign(DEFAULT_BILL_FORMAT_DESIGNS.bill);
    const rendered = renderBillTemplate(html, SAMPLE_BILL_DATA);
    expect(rendered).toContain(SAMPLE_BILL_DATA.documentNumber);
    expect(rendered).toContain("Sample Product A");
    expect(rendered).toContain("568.00");
  });

  it("compiles and renders the default receipt design", () => {
    const html = compileBillFormatDesign(DEFAULT_BILL_FORMAT_DESIGNS.receipt);
    const rendered = renderBillTemplate(html, SAMPLE_BILL_DATA);
    expect(rendered).toContain(SAMPLE_BILL_DATA.documentNumber);
  });

  it("compiles and renders the default credit note design", () => {
    const html = compileBillFormatDesign(DEFAULT_BILL_FORMAT_DESIGNS.credit_note);
    const rendered = renderCreditNoteTemplate(html, SAMPLE_CREDIT_NOTE_DATA);
    expect(rendered).toContain(SAMPLE_CREDIT_NOTE_DATA.documentNumber);
    expect(rendered).toContain("161.78");
  });

  it("compiles and renders the default refund design", () => {
    const html = compileBillFormatDesign(DEFAULT_BILL_FORMAT_DESIGNS.refund);
    const rendered = renderRefundTemplate(html, SAMPLE_REFUND_DATA);
    expect(rendered).toContain(SAMPLE_REFUND_DATA.documentNumber);
  });

  it("hides a field-truthy conditional row when the field is zero", () => {
    const design: BillFormatDesign = {
      version: 1,
      formatKind: "bill",
      blocks: [
        {
          id: "totals",
          type: "totals_block",
          config: {
            rows: [
              {
                id: "t1",
                label: "Add : IGST",
                field: "igstAmount",
                visibleIf: "field-truthy",
                emphasis: false,
              },
            ],
          },
          style: {},
        },
      ],
    };
    const html = compileBillFormatDesign(design);
    const rendered = renderBillTemplate(html, SAMPLE_BILL_DATA);
    expect(rendered).not.toContain("Add : IGST");
  });

  it("escapes literal free-text content but leaves merge-field tokens intact", () => {
    const design: BillFormatDesign = {
      version: 1,
      formatKind: "bill",
      blocks: [
        {
          id: "note",
          type: "free_text",
          config: { content: "Ts & Cs apply <strict>. Total: {{grandTotal}}" },
          style: {},
        },
      ],
    };
    const html = compileBillFormatDesign(design);
    expect(html).toContain("Ts &amp; Cs apply &lt;strict&gt;. Total: {{grandTotal}}");
    const rendered = renderBillTemplate(html, SAMPLE_BILL_DATA);
    expect(rendered).toContain("568");
  });
});
