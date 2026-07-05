import type { FavoritesRepository } from "../../domain/favorites/FavoritesRepository.ts";

export class ListFavorites {
  private readonly repo: FavoritesRepository;

  constructor(repo: FavoritesRepository) {
    this.repo = repo;
  }

  async list(): Promise<readonly [string, string][]> {
    const favorites = await this.repo.list();
    return [...favorites]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((fav) => [fav.name, fav.sql]);
  }
}
