import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const customer = await prisma.customer.findUnique({
  where: { id: "3cb2726b-d010-4c2c-a418-274edad95edd" },
  select: { id: true, name: true, address: true, phone: true, email: true },
});
console.log(JSON.stringify(customer, null, 2));
await prisma.$disconnect();
