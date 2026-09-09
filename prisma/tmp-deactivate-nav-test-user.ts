import { unscoped } from "../lib/db";
const prismaBase = unscoped();
async function main() {
  await prismaBase.user.update({
    where: { email: "tmp-nav-test@example.com" },
    data: { isActive: false },
  });
  console.log("Deactivated.");
}
main().finally(() => prismaBase.$disconnect());
