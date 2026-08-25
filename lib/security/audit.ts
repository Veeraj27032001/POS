import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export type AuditAction = "create" | "update" | "delete";

export interface WriteAuditLogParams {
  userId?: string | null;
  storeId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  beforeData?: unknown;
  afterData?: unknown;
}

function toJsonSafe(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function writeAuditLog(params: WriteAuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        storeId: params.storeId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        beforeData: toJsonSafe(params.beforeData),
        afterData: toJsonSafe(params.afterData),
      },
    });
  } catch (error) {
    console.error(
      `writeAuditLog failed for ${params.action} ${params.entityType}:${params.entityId}`,
      error,
    );
  }
}
