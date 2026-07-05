import type { Favorite } from "./Favorite.ts";

export type FavoritesRepository = {
  list: () => Promise<readonly Favorite[]>;
  get: (name: string) => Promise<Favorite | undefined>;
  save: (fav: Favorite) => Promise<void>;
  remove: (name: string) => Promise<boolean>;
};

export function fakeFavoritesRepository(
  initial: readonly Favorite[] = [],
): FavoritesRepository {
  let stored: Favorite[] = [...initial];
  return {
    async list(): Promise<readonly Favorite[]> {
      return [...stored];
    },
    async get(name: string): Promise<Favorite | undefined> {
      return stored.find((f) => f.name === name);
    },
    async save(fav: Favorite): Promise<void> {
      const idx = stored.findIndex((f) => f.name === fav.name);
      if (idx === -1) {
        stored.push(fav);
      } else {
        stored[idx] = fav;
      }
    },
    async remove(name: string): Promise<boolean> {
      const before = stored.length;
      stored = stored.filter((f) => f.name !== name);
      return stored.length < before;
    },
  };
}
