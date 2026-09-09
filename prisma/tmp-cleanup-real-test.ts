import { del } from "@vercel/blob";

import { unscoped } from "../lib/db";

const prismaBase = unscoped();

async function main() {
  const releases = await prismaBase.desktopAppRelease.findMany({
    where: { uploadedBy: { email: { startsWith: "tmp-desktop-" } } },
  });
  for (const r of releases) {
    await del(r.fileUrl, { token: process.env.BLOB_READ_WRITE_TOKEN }).catch((err) =>
      console.error(`Failed to remove blob ${r.fileUrl}:`, err),
    );
    await prismaBase.desktopAppRelease.delete({ where: { id: r.id } });
    console.log(`Deleted release ${r.version} (${r.id})`);
  }

  const deactivated = await prismaBase.user.updateMany({
    where: { email: { startsWith: "tmp-desktop-" } },
    data: { isActive: false },
  });
  console.log(`Deactivated ${deactivated.count} temp user(s).`);
}

main().finally(() => prismaBase.$disconnect());
