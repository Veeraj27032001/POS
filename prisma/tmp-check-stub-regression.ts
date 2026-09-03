import { unscoped } from "../lib/db";

async function main() {
  const db = unscoped();
  const testUser = await db.user.findFirst({ where: { email: "veerajshetty27032001@gmail.com" } });
  if (!testUser) {
    console.log("test user not found");
    return;
  }

  const recentBills = await db.bill.findMany({
    where: { cashierUserId: testUser.id },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, documentNumber: true, status: true, createdAt: true },
  });
  console.log("recent bills:", JSON.stringify(recentBills, null, 2));

  const recentRequests = await db.paymentRequest.findMany({
    where: { createdByUserId: testUser.id },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      billId: true,
      method: true,
      status: true,
      gatewayReference: true,
      createdAt: true,
    },
  });
  console.log("recent payment requests:", JSON.stringify(recentRequests, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
