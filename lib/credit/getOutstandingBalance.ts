import { unscoped } from "@/lib/db";

// The single place step5 §13's credit balance formula lives — every
// consumer (the credit-limit check at billing, a customer statement, a
// collections list) calls this instead of re-deriving the sum itself.
export async function getOutstandingBalance(customerId: string): Promise<number> {
  const db = unscoped();

  const bills = await db.bill.findMany({
    where: { customerId, billType: "credit_bill", status: "completed" },
    select: { id: true, grandTotal: true },
  });
  if (bills.length === 0) return 0;

  const billIds = bills.map((b) => b.id);

  const [creditNoteSums, paymentSums] = await Promise.all([
    db.creditNote.groupBy({
      by: ["originalBillId"],
      where: { originalBillId: { in: billIds } },
      _sum: { amount: true },
    }),
    db.billPayment.groupBy({
      by: ["billId"],
      where: { billId: { in: billIds }, status: "success" },
      _sum: { amount: true },
    }),
  ]);

  const creditNotesByBill = new Map(
    creditNoteSums.map((row) => [row.originalBillId, Number(row._sum.amount ?? 0)]),
  );
  const paymentsByBill = new Map(
    paymentSums.map((row) => [row.billId, Number(row._sum.amount ?? 0)]),
  );

  return bills.reduce((total, bill) => {
    const creditNotes = creditNotesByBill.get(bill.id) ?? 0;
    const payments = paymentsByBill.get(bill.id) ?? 0;
    return total + (Number(bill.grandTotal) - creditNotes - payments);
  }, 0);
}
