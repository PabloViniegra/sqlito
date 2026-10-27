import { readFile } from "node:fs/promises";
import { z } from "zod";
import type { Favorite } from "../../domain/favorites/Favorite.ts";
import type { FavoritesRepository } from "../../domain/favorites/FavoritesRepository.ts";
import { atomicWrite, isEnoent } from "./atomicWrite.ts";

const FavoriteSchema = z.object({
  name: z.string(),
  sql: z.string(),
  updatedAt: z.number(),
}) satisfies z.ZodType<Favorite>;

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
          const favorite = FavoriteSchema.safeParse(entry);
          if (favorite.success) {
            this.store.set(favorite.data.name, favorite.data);
          }
        }
      }
    } catch (err) {
      console.warn(
        // SAFETY: JSON.parse throws SyntaxError whose `.message` we forward into the user-facing diagnostic.
        `sqlito: favorites file at ${this.path} is corrupt; starting with empty library (${(err as Error).message})`,
      );
    }
  }

  private async flush(): Promise<void> {
    await atomicWrite(
      this.path,
      JSON.stringify([...this.store.values()], null, 2),
    );
  }
}
