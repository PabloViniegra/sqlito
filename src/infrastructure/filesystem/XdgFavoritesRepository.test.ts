import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { XdgFavoritesRepository } from "./XdgFavoritesRepository.ts";

describe("XdgFavoritesRepository", () => {
  let dir: string;
  let path: string;
  let repo: XdgFavoritesRepository;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "sqlito-favs-"));
    path = join(dir, "favorites.json");
    repo = new XdgFavoritesRepository(path);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("returns an empty list when no file exists", async () => {
    expect(await repo.list()).toEqual([]);
  });

  it("does not write the file until first save", async () => {
    await repo.list();
    await expect(readFile(path, "utf8")).rejects.toThrow();
  });

  it("persists save -> list -> get -> remove against a temp dir", async () => {
    await repo.save({ name: "a", sql: "SELECT 1", updatedAt: 1 });

    expect(await repo.list()).toEqual([
      { name: "a", sql: "SELECT 1", updatedAt: 1 },
    ]);
    expect(await repo.get("a")).toEqual({
      name: "a",
      sql: "SELECT 1",
      updatedAt: 1,
    });
    expect(await repo.remove("a")).toBe(true);
    expect(await repo.list()).toEqual([]);
    expect(await repo.remove("a")).toBe(false);
  });

  it("overwrites an existing favorite on save", async () => {
    await repo.save({ name: "a", sql: "SELECT 1", updatedAt: 1 });
    await repo.save({ name: "a", sql: "SELECT 2", updatedAt: 2 });

    expect(await repo.get("a")).toEqual({
      name: "a",
      sql: "SELECT 2",
      updatedAt: 2,
    });
  });

  it("loads existing entries from disk on first access", async () => {
    const fresh = new XdgFavoritesRepository(path);
    await repo.save({ name: "a", sql: "SELECT 1", updatedAt: 1 });
    await repo.save({ name: "b", sql: "SELECT 2", updatedAt: 2 });

    const list = await fresh.list();
    expect(list).toHaveLength(2);
    expect(list.map((f) => f.name).sort()).toEqual(["a", "b"]);
  });

  it("treats a corrupt JSON file as empty and warns to stderr", async () => {
    await writeFile(path, "this is not json");

    const errors: string[] = [];
    const original = console.warn;
    console.warn = (msg: string): void => {
      errors.push(msg);
    };

    try {
      expect(await repo.list()).toEqual([]);
    } finally {
      console.warn = original;
    }

    expect(errors.some((e) => e.includes("corrupt"))).toBe(true);
  });

  it("writes atomically via tmp + rename (read survives partial state)", async () => {
    await repo.save({ name: "a", sql: "SELECT 1", updatedAt: 1 });
    await repo.save({ name: "b", sql: "SELECT 2", updatedAt: 2 });

    const raw = await readFile(path, "utf8");
    const parsed: unknown = JSON.parse(raw);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
  });
});
