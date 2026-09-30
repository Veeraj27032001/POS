import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { unscoped } from "@/lib/db";

import { allocateDocumentNumber } from "./allocateDocumentNumber";

const marker = `__test_${randomUUID()}`;
const db = unscoped();

let storeId: string;
let financialYearId: string;

beforeAll(async () => {
  const store = await db.store.create({
    data: { name: `${marker}_store`, code: `${marker}_s`, address: "x" },
  });
  storeId = store.id;

  const fy = await db.financialYear.create({
    data: {
      label: `${marker}_fy`,
      startDate: new Date("2027-04-01"),
      endDate: new Date("2028-03-31"),
    },
  });
  financialYearId = fy.id;

  await db.numberingSeries.create({
    data: {
      seriesType: "cash_bill",
      storeId,
      financialYearId,
      prefix: "CB",
      currentNumber: 0,
    },
  });
});

afterAll(async () => {
  await db.numberingSeries.deleteMany({ where: { storeId } });
  await db.financialYear.delete({ where: { id: financialYearId } });
  await db.store.delete({ where: { id: storeId } });
});

describe("allocateDocumentNumber", () => {
  it("formats the document number as prefix/store code/fy label/padded number", async () => {
    const result = await db.$transaction((tx) =>
      allocateDocumentNumber(tx, { seriesType: "cash_bill", storeId, financialYearId }),
    );
    expect(result.documentNumber).toBe(`CB/${marker}_s/${marker}_fy/0001`);
    expect(result.number).toBe(1);
  });

  it("increments on each successive allocation", async () => {
    const second = await db.$transaction((tx) =>
      allocateDocumentNumber(tx, { seriesType: "cash_bill", storeId, financialYearId }),
    );
    expect(second.number).toBe(2);
  });

  it("never issues a duplicate number under concurrent allocation", async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }).map(() =>
        db.$transaction((tx) =>
          allocateDocumentNumber(tx, { seriesType: "cash_bill", storeId, financialYearId }),
        ),
      ),
    );
    const numbers = results.map((r) => r.number);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it("throws when no numbering series exists for the requested combination", async () => {
    await expect(
      db.$transaction((tx) =>
        allocateDocumentNumber(tx, {
          seriesType: "credit_bill",
          storeId,
          financialYearId,
        }),
      ),
    ).rejects.toThrow(/No active numbering series/);
  });
});
