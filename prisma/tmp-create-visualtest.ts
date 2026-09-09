import { prismaBase } from "@/lib/db/client";
import { hashSecret } from "@/lib/security/hash";

async function main() {
  const store = await prismaBase.store.findFirst({ where: { isActive: true } });
  if (!store) throw new Error("No active store found");
  const adminRole = await prismaBase.role.findFirst({ where: { name: "Admin" } });
  if (!adminRole) throw new Error("No Admin role found");

  const email = `tmp-visualtest-${Date.now()}@example.com`;
  const password = "TmpVisualTest!2026";
  const passwordHash = await hashSecret(password);

  const user = await prismaBase.user.create({
    data: {
      name: "Tmp Visual Test",
      email,
      passwordHash,
      roleId: adminRole.id,
      storeId: store.id,
      isActive: true,
    },
  });

  console.log(JSON.stringify({ email, password, userId: user.id, storeId: store.id }));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prismaBase.$disconnect());
