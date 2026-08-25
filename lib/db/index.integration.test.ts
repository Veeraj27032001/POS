import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma, runWithStoreContext, unscoped } from "@/lib/db";

const marker = `__test_${randomUUID()}`;
const db = unscoped();

let roleId: string;
let storeAId: string;
let storeBId: string;
let userAId: string;
let userBId: string;

beforeAll(async () => {
  const role = await db.role.create({ data: { name: `${marker}_role` } });
  roleId = role.id;

  const storeA = await db.store.create({ data: { name: `${marker}_store_a`, address: "x" } });
  const storeB = await db.store.create({ data: { name: `${marker}_store_b`, address: "x" } });
  storeAId = storeA.id;
  storeBId = storeB.id;

  const userA = await db.user.create({
    data: {
      name: `${marker}_user_a`,
      email: `${marker}_a@example.com`,
      passwordHash: "x",
      roleId,
      storeId: storeAId,
    },
  });
  const userB = await db.user.create({
    data: {
      name: `${marker}_user_b`,
      email: `${marker}_b@example.com`,
      passwordHash: "x",
      roleId,
      storeId: storeBId,
    },
  });
  userAId = userA.id;
  userBId = userB.id;
});

afterAll(async () => {
  await db.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
  await db.store.deleteMany({ where: { id: { in: [storeAId, storeBId] } } });
  await db.role.delete({ where: { id: roleId } });
});

describe("store-scoping Prisma extension", () => {
  it("scopes findMany to the current store, excluding other stores' rows", async () => {
    const users = await runWithStoreContext({ storeId: storeAId, userId: userAId }, () =>
      prisma.user.findMany({ where: { id: { in: [userAId, userBId] } } }),
    );
    expect(users.map((u) => u.id)).toEqual([userAId]);
  });

  it("scopes findUnique so a cross-store lookup by id returns null", async () => {
    const user = await runWithStoreContext({ storeId: storeAId, userId: userAId }, () =>
      prisma.user.findUnique({ where: { id: userBId } }),
    );
    expect(user).toBeNull();
  });

  it("allows the matching store's own record through findUnique", async () => {
    const user = await runWithStoreContext({ storeId: storeAId, userId: userAId }, () =>
      prisma.user.findUnique({ where: { id: userAId } }),
    );
    expect(user?.id).toBe(userAId);
  });

  it("bypasses scoping entirely when storeId is explicitly null (cross-store admin)", async () => {
    const users = await runWithStoreContext({ storeId: null, userId: userAId }, () =>
      prisma.user.findMany({ where: { id: { in: [userAId, userBId] } } }),
    );
    expect(users.map((u) => u.id).sort()).toEqual([userAId, userBId].sort());
  });

  it("throws when no store context has been established", async () => {
    await expect(prisma.user.findMany({ where: { id: userAId } })).rejects.toThrow(
      /No store scoping context/,
    );
  });

  it("unscoped() sees every store's rows regardless of context", async () => {
    const users = await db.user.findMany({ where: { id: { in: [userAId, userBId] } } });
    expect(users.map((u) => u.id).sort()).toEqual([userAId, userBId].sort());
  });
});
