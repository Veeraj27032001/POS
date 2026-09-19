import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const country = await prisma.country.findFirst({ select: { id: true, name: true } });
const state = await prisma.state.findFirst({
  where: { countryId: country?.id },
  select: { id: true, name: true },
});
console.log(JSON.stringify({ country, state }));
await prisma.$disconnect();
