import { unscoped } from "../lib/db";
import { hashSecret } from "../lib/security/hash";

const prismaBase = unscoped();

async function main() {
  const superAdminRole = await prismaBase.role.findFirstOrThrow({ where: { name: "Super Admin" } });
  const password = "TmpDesktop123!";
  const passwordHash = await hashSecret(password);

  const user = await prismaBase.user.upsert({
    where: { email: "tmp-desktop-superadmin@example.com" },
    update: { isActive: true, passwordHash, roleId: superAdminRole.id, storeId: null },
    create: {
      name: "Tmp Desktop SuperAdmin",
      email: "tmp-desktop-superadmin@example.com",
      passwordHash,
      roleId: superAdminRole.id,
      storeId: null,
    },
  });

  console.log(JSON.stringify({ email: user.email, password }));
}

main().finally(() => prismaBase.$disconnect());
