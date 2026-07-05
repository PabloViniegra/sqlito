import type { Favorite } from "../../domain/favorites/Favorite.ts";
import type { FavoritesRepository } from "../../domain/favorites/FavoritesRepository.ts";

export class EmptyFavoriteSql extends Error {
  constructor() {
    super("cannot save a favorite with empty SQL");
    this.name = "EmptyFavoriteSql";
  }
}

export class SaveFavorite {
  private readonly repo: FavoritesRepository;

  constructor(repo: FavoritesRepository) {
    this.repo = repo;
  }

  async save(name: string, sql: string): Promise<Favorite> {
    if (sql.trim() === "") throw new EmptyFavoriteSql();
    const favorite: Favorite = { name, sql, updatedAt: Date.now() };
    await this.repo.save(favorite);
    return favorite;
  }
}
