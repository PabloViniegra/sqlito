import type { FavoritesRepository } from "../../domain/favorites/FavoritesRepository.ts";

export class ForgetFavorite {
  private readonly repo: FavoritesRepository;

  constructor(repo: FavoritesRepository) {
    this.repo = repo;
  }

  async forget(name: string): Promise<boolean> {
    return this.repo.remove(name);
  }
}
