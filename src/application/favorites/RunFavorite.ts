import type { FavoritesRepository } from "../../domain/favorites/FavoritesRepository.ts";

export class RunFavorite {
  private readonly repo: FavoritesRepository;

  constructor(repo: FavoritesRepository) {
    this.repo = repo;
  }

  async get(name: string): Promise<string | undefined> {
    const favorite = await this.repo.get(name);
    return favorite?.sql;
  }
}
