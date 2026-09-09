import { unscoped } from "../lib/db";

const prismaBase = unscoped();

async function main() {
  const count = await prismaBase.hsnCode.count({ where: { isDeleted: false } });
  console.log(`HSN code count: ${count}`);
}

main().finally(() => prismaBase.$disconnect());
