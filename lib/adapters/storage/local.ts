import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { StorageAdapter } from "./types";

const UPLOAD_ROOT = join(process.cwd(), ".uploads");

export const localStorageAdapter: StorageAdapter = {
  async put({ key, body }) {
    const filePath = join(UPLOAD_ROOT, key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, body);
    return { url: `/api/uploads/${key}` };
  },

  async get(key) {
    return readFile(join(UPLOAD_ROOT, key));
  },

  async remove(key) {
    const filePath = join(UPLOAD_ROOT, key);
    await rm(filePath, { force: true });
  },
};
