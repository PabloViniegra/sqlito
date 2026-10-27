import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

// history and favorites hold raw SQL, which can embed credentials or PII
export const PRIVATE_FILE_MODE = 0o600;

export async function atomicWrite(
  path: string,
  payload: string,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  // unique per write so two sqlito sessions never interleave into one tmp file
  const tmp = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(tmp, payload, { mode: PRIVATE_FILE_MODE });
    await rename(tmp, path);
  } catch (err) {
    await rm(tmp, { force: true });
    throw err;
  }
}

export function isEnoent<T>(err: T): err is T & { code: "ENOENT" } {
  if (typeof err !== "object" || err === null) return false;
  return "code" in err && err.code === "ENOENT";
}
