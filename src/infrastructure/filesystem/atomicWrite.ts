import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function atomicWrite(
  path: string,
  payload: string,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await writeFile(tmp, payload);
  await rename(tmp, path);
}

export function isEnoent<T>(err: T): err is T & { code: "ENOENT" } {
  if (typeof err !== "object" || err === null) return false;
  return "code" in err && err.code === "ENOENT";
}
