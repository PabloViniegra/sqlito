import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  DEFAULT_THEME,
  findTheme,
  type Theme,
} from "../../domain/theme/Theme.ts";
import type { ThemeRepository } from "../../domain/theme/ThemeRepository.ts";

export class XdgThemeRepository implements ThemeRepository {
  private readonly path: string;

  constructor(path: string) {
    this.path = path;
  }

  async load(): Promise<Theme> {
    let raw: string;
    try {
      raw = await readFile(this.path, "utf8");
    } catch {
      return DEFAULT_THEME;
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      const theme = isConfig(parsed) ? findTheme(parsed.theme) : undefined;
      return theme ?? DEFAULT_THEME;
    } catch (err) {
      console.warn(
        `sqlito: config file at ${this.path} is corrupt; falling back to the default theme (${(err as Error).message})`,
      );
      return DEFAULT_THEME;
    }
  }

  async save(theme: Theme): Promise<void> {
    const payload = JSON.stringify({ theme: theme.name }, null, 2);
    await mkdir(dirname(this.path), { recursive: true });
    const tmp = `${this.path}.tmp`;
    await writeFile(tmp, payload);
    await rename(tmp, this.path);
  }
}

function isConfig(value: unknown): value is { theme: string } {
  if (typeof value !== "object" || value === null) return false;
  return typeof (value as Record<string, unknown>).theme === "string";
}
