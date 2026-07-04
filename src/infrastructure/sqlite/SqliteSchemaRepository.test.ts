import BetterSqlite3 from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { SqliteSchemaRepository } from "./SqliteSchemaRepository.ts";

function openInMemoryDb(): BetterSqlite3.Database {
  return new BetterSqlite3(":memory:");
}

function makeUsersDb(): BetterSqlite3.Database {
  const db = openInMemoryDb();
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL);
    CREATE TABLE posts (id INTEGER, title TEXT, body TEXT);
  `);
  return db;
}

describe("SqliteSchemaRepository", () => {
  describe("listTables", () => {
    it("returns the names of user tables (not sqlite_master internals)", () => {
      const repo = new SqliteSchemaRepository(makeUsersDb());

      const tables = repo.listTables();

      expect(tables.map((t) => t.name)).toEqual(["posts", "users"]);
    });

    it("excludes internal sqlite_* tables", () => {
      const db = openInMemoryDb();
      db.exec("CREATE TABLE app (x INTEGER);");
      const repo = new SqliteSchemaRepository(db);

      const tables = repo.listTables();

      expect(tables.map((t) => t.name)).toEqual(["app"]);
    });

    it("returns an empty list when the database has no tables", () => {
      const repo = new SqliteSchemaRepository(openInMemoryDb());

      expect(repo.listTables()).toEqual([]);
    });
  });

  describe("describe", () => {
    it("returns the columns of an existing table in declaration order with their SQLite types", () => {
      const repo = new SqliteSchemaRepository(makeUsersDb());

      const table = repo.describe("users");

      expect(table).toEqual({
        name: "users",
        columns: [
          { name: "id", type: "INTEGER" },
          { name: "email", type: "TEXT" },
        ],
      });
    });

    it("returns a table whose type is null when the column has no declared type", () => {
      const db = openInMemoryDb();
      db.exec("CREATE TABLE loosed (a, b, c);");
      const repo = new SqliteSchemaRepository(db);

      const table = repo.describe("loosed");

      expect(table?.columns).toEqual([
        { name: "a", type: null },
        { name: "b", type: null },
        { name: "c", type: null },
      ]);
    });

    it("returns undefined for an unknown table", () => {
      const repo = new SqliteSchemaRepository(makeUsersDb());

      expect(repo.describe("nope")).toBeUndefined();
    });
  });

  describe("refresh", () => {
    it("is callable without throwing", () => {
      const repo = new SqliteSchemaRepository(makeUsersDb());

      expect(() => repo.refresh()).not.toThrow();
    });

    it("returns updated tables after a CREATE issued against the underlying driver and refresh", () => {
      const db = makeUsersDb();
      const repo = new SqliteSchemaRepository(db);
      expect(repo.listTables().map((t) => t.name)).toEqual(["posts", "users"]);

      db.exec("CREATE TABLE comments (id INTEGER);");
      repo.refresh();

      expect(repo.listTables().map((t) => t.name)).toEqual([
        "comments",
        "posts",
        "users",
      ]);
      expect(repo.describe("comments")?.columns).toEqual([
        { name: "id", type: "INTEGER" },
      ]);
    });

    it("returns updated tables after a DROP issued against the underlying driver and refresh", () => {
      const db = makeUsersDb();
      const repo = new SqliteSchemaRepository(db);

      db.exec("DROP TABLE posts;");
      repo.refresh();

      expect(repo.listTables().map((t) => t.name)).toEqual(["users"]);
      expect(repo.describe("posts")).toBeUndefined();
    });
  });
});
