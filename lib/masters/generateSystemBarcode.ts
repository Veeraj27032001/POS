import { randomInt } from "node:crypto";

export function generateSystemBarcode(): string {
  const digits = Array.from({ length: 11 }, () => randomInt(0, 10)).join("");
  return `20${digits}`;
}
