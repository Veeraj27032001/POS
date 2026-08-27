import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

async function main() {
  const emails = [
    process.env.SEED_ADMIN_EMAIL ?? "admin@example.com",
    process.env.SEED_ADMIN2_EMAIL,
  ].filter((e): e is string => Boolean(e));

  const users = await db.user.findMany({ where: { email: { in: emails } } });
  for (const user of users) {
    await db.mfaDevice.deleteMany({ where: { userId: user.id } });
    await db.user.update({ where: { id: user.id }, data: { mfaMethod: null } });
    console.log(`Reset MFA for ${user.email}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
