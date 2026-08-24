import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function atomicWrite(path: string, payload: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await writeFile(tmp, payload);
  await rename(tmp, path);
}

export function isEnoent(err: unknown): err is NodeJS.ErrnoException {
  if (typeof err !== "object" || err === null) return false;
  // SAFETY: Node attaches a `code` property to system errors; we read it via unknown and only forward when it equals ENOENT.
  const code = (err as { code?: unknown }).code;
  return code === "ENOENT";
}
