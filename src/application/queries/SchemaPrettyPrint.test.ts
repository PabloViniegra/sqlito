import { afterEach, describe, expect, it } from "vitest";
import { BetterSqliteDatabase } from "../../infrastructure/sqlite/BetterSqliteDatabase.ts";
import { SchemaPrettyPrint } from "./SchemaPrettyPrint.ts";

describe("SchemaPrettyPrint", () => {
  let db: BetterSqliteDatabase;

  afterEach(() => db?.close());

  const setup = (): SchemaPrettyPrint => {
    db = new BetterSqliteDatabase(":memory:");
    return new SchemaPrettyPrint(db);
  };

  const seed = (): void => {
    db.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)");
    db.exec("CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT)");
    db.exec("CREATE INDEX idx_users_name ON users(name)");
  };

  describe("tables", () => {
    it("lists user tables sorted, excluding sqlite_ internals", async () => {
      const pp = setup();
      seed();
      expect(await pp.tables()).toBe("posts\nusers");
    });

    it("reports when there are no tables", async () => {
      const pp = setup();
      expect(await pp.tables()).toBe("No tables");
    });
  });

  describe("indexes", () => {
    it("lists user indexes with their table", async () => {
      const pp = setup();
      seed();
      expect(await pp.indexes()).toBe("idx_users_name on users");
    });

    it("excludes auto-created indexes", async () => {
      const pp = setup();
      db.exec("CREATE TABLE t (id INTEGER, code TEXT UNIQUE)");
      expect(await pp.indexes()).toBe("No indexes");
    });
  });

  describe("schema (no table)", () => {
    it("concatenates every CREATE TABLE statement", async () => {
      const pp = setup();
      seed();
      const r = await pp.schema();
      expect(r).toEqual({
        ok: true,
        text:
          "CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT);\n\n" +
          "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);",
      });
    });

    it("reports when there are no tables", async () => {
      const pp = setup();
      expect(await pp.schema()).toEqual({ ok: true, text: "No tables" });
    });
  });

  describe("schema <table>", () => {
    it("prints the CREATE statement plus the table's indexes", async () => {
      const pp = setup();
      seed();
      expect(await pp.schema("users")).toEqual({
        ok: true,
        text:
          "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);\n\n" +
          "CREATE INDEX idx_users_name ON users(name);",
      });
    });

    it("prints just the CREATE statement when there are no indexes", async () => {
      const pp = setup();
      seed();
      expect(await pp.schema("posts")).toEqual({
        ok: true,
        text: "CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT);",
      });
    });

    it("errors for an unknown table", async () => {
      const pp = setup();
      seed();
      expect(await pp.schema("ghost")).toEqual({
        ok: false,
        error: "unknown table: ghost",
      });
    });
  });
});
