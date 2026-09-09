import { unscoped } from "../lib/db";

const prismaBase = unscoped();

async function main() {
  const result = await prismaBase.user.updateMany({
    where: { email: "tmp-desktop-superadmin@example.com" },
    data: { isActive: true },
  });
  console.log(`Reactivated ${result.count} user(s).`);
}

main().finally(() => prismaBase.$disconnect());
