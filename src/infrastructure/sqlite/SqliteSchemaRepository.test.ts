import { describe, expect, it, vi } from "vitest";
import { BetterSqliteDatabase } from "./BetterSqliteDatabase.ts";
import { SqliteSchemaRepository } from "./SqliteSchemaRepository.ts";

function makeUsersDb(): BetterSqliteDatabase {
  const db = new BetterSqliteDatabase(":memory:");
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL);
    CREATE TABLE posts (id INTEGER, title TEXT, body TEXT);
  `);
  return db;
}

async function loadedRepo(
  db: BetterSqliteDatabase,
): Promise<SqliteSchemaRepository> {
  const repo = new SqliteSchemaRepository(db);
  await repo.refresh();
  return repo;
}

describe("SqliteSchemaRepository", () => {
  describe("listTables", () => {
    it("is empty until the first refresh", () => {
      const repo = new SqliteSchemaRepository(makeUsersDb());

      expect(repo.listTables()).toEqual([]);
    });

    it("returns the names of user tables (not sqlite_master internals)", async () => {
      const repo = await loadedRepo(makeUsersDb());

      expect(repo.listTables().map((t) => t.name)).toEqual(["posts", "users"]);
    });

    it("excludes internal sqlite_* tables", async () => {
      const db = new BetterSqliteDatabase(":memory:");
      db.exec(
        "CREATE TABLE app (x INTEGER PRIMARY KEY AUTOINCREMENT); ANALYZE;",
      );
      const repo = await loadedRepo(db);

      expect(repo.listTables().map((t) => t.name)).toEqual(["app"]);
    });

    it("returns an empty list when the database has no tables", async () => {
      const repo = await loadedRepo(new BetterSqliteDatabase(":memory:"));

      expect(repo.listTables()).toEqual([]);
    });

    it("includes views, labelled as such, with their columns", async () => {
      const db = makeUsersDb();
      db.exec("CREATE VIEW emails AS SELECT email FROM users;");
      const repo = await loadedRepo(db);

      expect(repo.describe("emails")).toEqual({
        name: "emails",
        kind: "view",
        columns: [{ name: "email", type: "TEXT" }],
      });
    });

    it("still loads every object when a view references a dropped table", async () => {
      const db = makeUsersDb();
      db.exec(
        "CREATE VIEW titles AS SELECT title FROM posts; DROP TABLE posts;",
      );
      const repo = await loadedRepo(db);

      expect(repo.listTables().map((t) => [t.name, t.kind])).toEqual([
        ["titles", "view"],
        ["users", "table"],
      ]);
      expect(repo.describe("titles")?.columns).toEqual([]);
      expect(repo.describe("users")?.columns).toHaveLength(2);
    });
  });

  describe("describe", () => {
    it("returns the columns of an existing table in declaration order with their SQLite types", async () => {
      const repo = await loadedRepo(makeUsersDb());

      expect(repo.describe("users")).toEqual({
        name: "users",
        kind: "table",
        columns: [
          { name: "id", type: "INTEGER" },
          { name: "email", type: "TEXT" },
        ],
      });
    });

    it("returns a table whose type is null when the column has no declared type", async () => {
      const db = new BetterSqliteDatabase(":memory:");
      db.exec("CREATE TABLE loosed (a, b, c);");
      const repo = await loadedRepo(db);

      expect(repo.describe("loosed")?.columns).toEqual([
        { name: "a", type: null },
        { name: "b", type: null },
        { name: "c", type: null },
      ]);
    });

    it("returns undefined for an unknown table", async () => {
      const repo = await loadedRepo(makeUsersDb());

      expect(repo.describe("nope")).toBeUndefined();
    });

    it("serves reads from the cache without querying the database", async () => {
      const db = makeUsersDb();
      const repo = await loadedRepo(db);
      const execute = vi.spyOn(db, "execute");

      repo.listTables();
      repo.describe("users");

      expect(execute).not.toHaveBeenCalled();
    });
  });

  describe("refresh", () => {
    it("picks up a CREATE issued after the last refresh", async () => {
      const db = makeUsersDb();
      const repo = await loadedRepo(db);

      db.exec("CREATE TABLE comments (id INTEGER);");
      expect(repo.describe("comments")).toBeUndefined();
      await repo.refresh();

      expect(repo.listTables().map((t) => t.name)).toEqual([
        "comments",
        "posts",
        "users",
      ]);
      expect(repo.describe("comments")?.columns).toEqual([
        { name: "id", type: "INTEGER" },
      ]);
    });

    it("drops tables removed since the last refresh", async () => {
      const db = makeUsersDb();
      const repo = await loadedRepo(db);

      db.exec("DROP TABLE posts;");
      await repo.refresh();

      expect(repo.listTables().map((t) => t.name)).toEqual(["users"]);
      expect(repo.describe("posts")).toBeUndefined();
    });

    it("keeps the newest snapshot when an older refresh resolves last", async () => {
      const db = makeUsersDb();
      const repo = new SqliteSchemaRepository(db);
      const execute = db.execute.bind(db);
      let releaseFirst: () => void = () => {};
      const firstGate = new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      vi.spyOn(db, "execute").mockImplementationOnce(async (...args) => {
        const result = await execute(...args);
        await firstGate;
        return result;
      });

      const stale = repo.refresh();
      db.exec("CREATE TABLE late (id INTEGER);");
      await repo.refresh();
      releaseFirst();
      await stale;

      expect(repo.describe("late")).toBeDefined();
    });

    it("keeps the last snapshot when the connection fails mid-refresh", async () => {
      const db = makeUsersDb();
      const repo = await loadedRepo(db);
      vi.spyOn(db, "execute").mockRejectedValue(new Error("query cancelled"));

      await expect(repo.refresh()).resolves.toBeUndefined();

      expect(repo.listTables().map((t) => t.name)).toEqual(["posts", "users"]);
    });
  });
});
