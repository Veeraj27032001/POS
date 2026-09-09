import { prismaBase } from "@/lib/db/client";

async function main() {
  const format = await prismaBase.billFormat.findFirst({
    where: { storeId: "777d2b52-cacc-4abf-8aee-71356c39c329" },
    select: { id: true, name: true, storeId: true },
  });
  console.log(JSON.stringify(format));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prismaBase.$disconnect());
