import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Favorite } from "../../domain/favorites/Favorite.ts";
import type { FavoritesRepository } from "../../domain/favorites/FavoritesRepository.ts";

export class XdgFavoritesRepository implements FavoritesRepository {
  private readonly path: string;
  private store: Map<string, Favorite> = new Map();
  private loaded = false;

  constructor(path: string) {
    this.path = path;
  }

  async list(): Promise<readonly Favorite[]> {
    await this.load();
    return [...this.store.values()];
  }

  async get(name: string): Promise<Favorite | undefined> {
    await this.load();
    return this.store.get(name);
  }

  async save(fav: Favorite): Promise<void> {
    await this.load();
    this.store.set(fav.name, fav);
    await this.flush();
  }

  async remove(name: string): Promise<boolean> {
    await this.load();
    const had = this.store.delete(name);
    if (had) await this.flush();
    return had;
  }

  private async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    let raw: string;
    try {
      raw = await readFile(this.path, "utf8");
    } catch (err) {
      if (isEnoent(err)) return;
      throw err;
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          if (isFavorite(entry)) {
            this.store.set(entry.name, entry);
          }
        }
      }
    } catch (err) {
      console.warn(
        `sqlito: favorites file at ${this.path} is corrupt; starting with empty library (${(err as Error).message})`,
      );
    }
  }

  private async flush(): Promise<void> {
    const payload = JSON.stringify([...this.store.values()], null, 2);
    await mkdir(dirname(this.path), { recursive: true });
    const tmp = `${this.path}.tmp`;
    await writeFile(tmp, payload);
    await rename(tmp, this.path);
  }
}

function isFavorite(value: unknown): value is Favorite {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.name === "string" &&
    typeof v.sql === "string" &&
    typeof v.updatedAt === "number"
  );
}

function isEnoent(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "ENOENT"
  );
}
