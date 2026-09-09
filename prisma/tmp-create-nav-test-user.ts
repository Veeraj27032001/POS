import { unscoped } from "../lib/db";
import { hashSecret } from "../lib/security/hash";

const prismaBase = unscoped();

async function main() {
  const role = await prismaBase.role.findFirstOrThrow({ where: { name: "Admin" } });
  const store = await prismaBase.store.findFirstOrThrow({
    where: { id: "777d2b52-cacc-4abf-8aee-71356c39c329" },
  });
  const password = "TmpNavTest123!";
  const passwordHash = await hashSecret(password);

  const user = await prismaBase.user.upsert({
    where: { email: "tmp-nav-test@example.com" },
    update: { isActive: true, passwordHash, roleId: role.id, storeId: store.id },
    create: {
      name: "Tmp Nav Test",
      email: "tmp-nav-test@example.com",
      passwordHash,
      roleId: role.id,
      storeId: store.id,
    },
  });

  console.log(JSON.stringify({ email: user.email, password }));
}

main().finally(() => prismaBase.$disconnect());
