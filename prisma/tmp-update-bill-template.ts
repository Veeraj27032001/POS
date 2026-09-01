import { unscoped } from "@/lib/db";
import { DEFAULT_BILL_TEMPLATE_HTML } from "@/lib/billing/defaultBillFormatTemplates";

async function main() {
  const db = unscoped();
  const result = await db.billFormat.updateMany({
    where: { name: "Default", formatKind: "bill" },
    data: { templateHtml: DEFAULT_BILL_TEMPLATE_HTML },
  });
  console.log(`Updated ${result.count} row(s)`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
