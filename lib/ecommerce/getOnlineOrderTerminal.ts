import { unscoped } from "@/lib/db";

const ONLINE_ORDER_TERMINAL_NAME = "Online Orders";

// Every store gets exactly one of these, auto-provisioned (see storeResource
// afterCreate, and the one-off backfill for stores that predate this). It's
// flagged isSystemGenerated so it never shows up in the regular Terminals
// list or any staff-facing terminal picker — online-order bills need a
// terminal to satisfy the schema, but they were never rung up at a real
// register, so they shouldn't borrow one that's actually in use.
export async function getOnlineOrderTerminal(storeId: string) {
  const db = unscoped();
  const existing = await db.terminal.findFirst({
    where: { storeId, isSystemGenerated: true },
  });
  if (existing) return existing;

  return db.terminal.create({
    data: {
      storeId,
      name: ONLINE_ORDER_TERMINAL_NAME,
      isSystemGenerated: true,
    },
  });
}
