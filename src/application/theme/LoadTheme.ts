import type { Theme } from "../../domain/theme/Theme.ts";
import type { ThemeRepository } from "../../domain/theme/ThemeRepository.ts";

export class LoadTheme {
  private readonly repo: ThemeRepository;

  constructor(repo: ThemeRepository) {
    this.repo = repo;
  }

  async load(): Promise<Theme> {
    return this.repo.load();
  }
}
