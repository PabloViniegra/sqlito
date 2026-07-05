import { findTheme, type Theme } from "../../domain/theme/Theme.ts";
import type { ThemeRepository } from "../../domain/theme/ThemeRepository.ts";

export class UnknownTheme extends Error {
  constructor(name: string) {
    super(`unknown theme: ${name}`);
    this.name = "UnknownTheme";
  }
}

export class SwitchTheme {
  private readonly repo: ThemeRepository;

  constructor(repo: ThemeRepository) {
    this.repo = repo;
  }

  async switch(name: string): Promise<Theme> {
    const theme = findTheme(name);
    if (theme === undefined) throw new UnknownTheme(name);
    await this.repo.save(theme);
    return theme;
  }
}
