import { describe, expect, it } from "vitest";
import { fakeFavoritesRepository } from "../../domain/favorites/FavoritesRepository.ts";
import { EmptyFavoriteSql, SaveFavorite } from "./SaveFavorite.ts";
import { ListFavorites } from "./ListFavorites.ts";
import { RunFavorite } from "./RunFavorite.ts";
import { ForgetFavorite } from "./ForgetFavorite.ts";

describe("SaveFavorite", () => {
  it("persists a favorite and returns it", async () => {
    const repo = fakeFavoritesRepository();
    const saved = await new SaveFavorite(repo).save("top", "SELECT 1");
    expect(saved.name).toBe("top");
    expect(saved.sql).toBe("SELECT 1");
    expect(typeof saved.updatedAt).toBe("number");
    expect(await repo.get("top")).toMatchObject({
      name: "top",
      sql: "SELECT 1",
    });
  });

  it("throws EmptyFavoriteSql for empty SQL", async () => {
    const repo = fakeFavoritesRepository();
    await expect(
      new SaveFavorite(repo).save("x", "   "),
    ).rejects.toBeInstanceOf(EmptyFavoriteSql);
  });

  it("overwrites an existing favorite on name collision", async () => {
    const repo = fakeFavoritesRepository();
    const save = new SaveFavorite(repo);
    await save.save("q", "SELECT 1");
    await save.save("q", "SELECT 2");
    expect((await repo.list()).length).toBe(1);
    expect(await repo.get("q")).toMatchObject({ sql: "SELECT 2" });
  });
});

describe("ListFavorites", () => {
  it("returns [name, sql] pairs sorted alphabetically", async () => {
    const repo = fakeFavoritesRepository([
      { name: "beta", sql: "SELECT 2", updatedAt: 2 },
      { name: "alpha", sql: "SELECT 1", updatedAt: 1 },
    ]);
    expect(await new ListFavorites(repo).list()).toEqual([
      ["alpha", "SELECT 1"],
      ["beta", "SELECT 2"],
    ]);
  });

  it("returns an empty list when there are no favorites", async () => {
    const repo = fakeFavoritesRepository();
    expect(await new ListFavorites(repo).list()).toEqual([]);
  });
});

describe("RunFavorite", () => {
  it("returns the SQL for a known favorite", async () => {
    const repo = fakeFavoritesRepository([
      { name: "q", sql: "SELECT 42", updatedAt: 1 },
    ]);
    expect(await new RunFavorite(repo).get("q")).toBe("SELECT 42");
  });

  it("returns undefined for an unknown favorite", async () => {
    const repo = fakeFavoritesRepository();
    expect(await new RunFavorite(repo).get("ghost")).toBeUndefined();
  });
});

describe("ForgetFavorite", () => {
  it("returns true and removes an existing favorite", async () => {
    const repo = fakeFavoritesRepository([
      { name: "q", sql: "SELECT 1", updatedAt: 1 },
    ]);
    expect(await new ForgetFavorite(repo).forget("q")).toBe(true);
    expect(await repo.get("q")).toBeUndefined();
  });

  it("returns false for an unknown favorite", async () => {
    const repo = fakeFavoritesRepository();
    expect(await new ForgetFavorite(repo).forget("ghost")).toBe(false);
  });
});
