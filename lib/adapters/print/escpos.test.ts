import { describe, expect, it } from "vitest";

import { encodeReceipt } from "./escpos";
import type { ReceiptPrintPayload } from "./types";

function render(payload: ReceiptPrintPayload, width: 58 | 80 = 58): string[] {
  return (
    Buffer.from(encodeReceipt(payload, width))
      .toString("latin1")
      // Strip the command bytes so only what lands on paper is left.
      .replace(/\x1b[@aE!]?.?|\x1d[!VWHhk].?.?/g, "")
      .split("\n")
  );
}

function bill(overrides: Partial<ReceiptPrintPayload> = {}): ReceiptPrintPayload {
  return {
    kind: "receipt",
    storeName: "Test Store",
    documentNumber: "BILL/STR1/25-26/0001",
    lines: [{ name: "Item", quantity: 1, unitPrice: 10, lineTotal: 10 }],
    subtotal: 10,
    discountTotal: 0,
    taxTotal: 0,
    grandTotal: 10,
    ...overrides,
  };
}

describe("encodeReceipt", () => {
  it("keeps every line within the paper width", () => {
    const lines = render(
      bill({
        lines: [
          {
            name: "A very long product name that will never fit on one line of paper",
            quantity: 1,
            unitPrice: 1234.56,
            lineTotal: 1234.56,
          },
        ],
      }),
    );

    for (const line of lines) expect(line.length).toBeLessThanOrEqual(32);
  });

  it("wraps on word boundaries rather than mid-word", () => {
    const lines = render(
      bill({
        lines: [
          { name: "Parle-G Biscuit Family Pack 500g", quantity: 1, unitPrice: 1, lineTotal: 1 },
        ],
      }),
    );

    expect(lines).toContain("Parle-G Biscuit Family Pack 500g");
  });

  it("spells out characters a thermal printer cannot render", () => {
    const bytes = encodeReceipt(bill({ footerText: "Total ₹100 — thanks" }), 58);

    expect(Buffer.from(bytes).toString("latin1")).toContain("Rs.100 - thanks");
    expect([...bytes].some((b) => b > 126)).toBe(false);
  });

  it("flushes the amount to the right edge", () => {
    const lines = render(bill({ grandTotal: 1260 }));
    const total = lines.find((line) => line.startsWith("TOTAL"));

    expect(total).toBe("TOTAL" + " ".repeat(20) + "1260.00");
  });
});
