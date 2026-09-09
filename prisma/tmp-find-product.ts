import { prismaBase } from "@/lib/db/client";

async function main() {
  const product = await prismaBase.product.findFirst({
    where: { isActive: true },
    select: { id: true, name: true, systemBarcode: true, price: true },
  });
  console.log(JSON.stringify(product));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prismaBase.$disconnect());
