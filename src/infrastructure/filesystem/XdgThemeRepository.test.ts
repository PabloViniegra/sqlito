import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_THEME,
  HIGH_CONTRAST_THEME,
} from "../../domain/theme/Theme.ts";
import { XdgThemeRepository } from "./XdgThemeRepository.ts";

describe("XdgThemeRepository", () => {
  let dir: string;
  let path: string;
  let repo: XdgThemeRepository;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "sqlito-theme-"));
    path = join(dir, "config.json");
    repo = new XdgThemeRepository(path);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("persists save -> load against a temp dir (round trip)", async () => {
    await repo.save(HIGH_CONTRAST_THEME);

    const fresh = new XdgThemeRepository(path);
    expect(await fresh.load()).toEqual(HIGH_CONTRAST_THEME);
  });

  it("falls back to the default theme when no config file exists", async () => {
    expect(await repo.load()).toEqual(DEFAULT_THEME);
  });

  it("falls back to the default theme when the config file is corrupt JSON", async () => {
    await writeFile(path, "this is not json");

    const errors: string[] = [];
    const original = console.warn;
    console.warn = (msg: string): void => {
      errors.push(msg);
    };

    try {
      expect(await repo.load()).toEqual(DEFAULT_THEME);
    } finally {
      console.warn = original;
    }

    expect(errors.some((e) => e.includes("corrupt"))).toBe(true);
  });

  it("falls back to the default theme when the theme name is unrecognized", async () => {
    await writeFile(path, JSON.stringify({ theme: "nonexistent" }));
    expect(await repo.load()).toEqual(DEFAULT_THEME);
  });
});
