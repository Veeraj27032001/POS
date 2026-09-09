import { prismaBase } from "@/lib/db/client";
import { hashSecret } from "@/lib/security/hash";

async function main() {
  const superAdminRole = await prismaBase.role.findFirst({ where: { name: "Super Admin" } });
  if (!superAdminRole) throw new Error("No Super Admin role found");

  const email = `tmp-superadmintest-${Date.now()}@example.com`;
  const password = "TmpSuperAdminTest!2026";
  const passwordHash = await hashSecret(password);

  const user = await prismaBase.user.create({
    data: {
      name: "Tmp Super Admin Test",
      email,
      passwordHash,
      roleId: superAdminRole.id,
      storeId: null,
      isActive: true,
    },
  });

  console.log(JSON.stringify({ email, password, userId: user.id }));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prismaBase.$disconnect());
