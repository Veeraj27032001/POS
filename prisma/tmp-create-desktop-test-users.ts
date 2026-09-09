import { unscoped } from "../lib/db";
import { hashSecret } from "../lib/security/hash";

const prismaBase = unscoped();

async function main() {
  const superAdminRole = await prismaBase.role.findFirstOrThrow({ where: { name: "Super Admin" } });
  const cashierRole = await prismaBase.role.findFirstOrThrow({ where: { name: "Cashier" } });
  const store = await prismaBase.store.findFirstOrThrow({ where: { isActive: true } });

  const password = "TmpDesktop123!";
  const passwordHash = await hashSecret(password);

  const superAdmin = await prismaBase.user.upsert({
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

  const cashier = await prismaBase.user.upsert({
    where: { email: "tmp-desktop-cashier@example.com" },
    update: { isActive: true, passwordHash, roleId: cashierRole.id, storeId: store.id },
    create: {
      name: "Tmp Desktop Cashier",
      email: "tmp-desktop-cashier@example.com",
      passwordHash,
      roleId: cashierRole.id,
      storeId: store.id,
    },
  });

  console.log(
    JSON.stringify({
      password,
      superAdminEmail: superAdmin.email,
      cashierEmail: cashier.email,
    }),
  );
}

main().finally(() => prismaBase.$disconnect());
