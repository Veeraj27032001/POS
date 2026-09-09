import { unscoped } from "../lib/db";

const prismaBase = unscoped();

async function main() {
  const release = await prismaBase.desktopAppRelease.findUnique({
    where: { version: "0.1.0-filename-test" },
  });
  if (!release) {
    console.log("Release not found.");
    return;
  }
  console.log("fileUrl:", release.fileUrl);
  const res = await fetch(release.fileUrl, { method: "HEAD" });
  console.log("HEAD status:", res.status);
  console.log("Content-Length:", res.headers.get("content-length"));
  console.log("Content-Type:", res.headers.get("content-type"));
  console.log("Content-Disposition:", res.headers.get("content-disposition"));
}

main().finally(() => prismaBase.$disconnect());
