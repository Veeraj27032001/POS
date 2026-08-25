import { readFile } from "node:fs/promises";
import { join, normalize } from "node:path";

import { NextResponse } from "next/server";

const UPLOAD_ROOT = join(process.cwd(), ".uploads");

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const relative = normalize(join(...path));
  if (relative.startsWith("..")) {
    return NextResponse.json(
      { error: { code: "invalid_path", message: "Invalid path" } },
      { status: 400 },
    );
  }

  const filePath = join(UPLOAD_ROOT, relative);
  try {
    const file = await readFile(filePath);
    return new NextResponse(new Uint8Array(file));
  } catch {
    return NextResponse.json(
      { error: { code: "not_found", message: "File not found" } },
      { status: 404 },
    );
  }
}
