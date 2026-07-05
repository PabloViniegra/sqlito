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
    db.prepare("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)").run();
    db.prepare("CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT)").run();
    db.prepare("CREATE INDEX idx_users_name ON users(name)").run();
  };

  describe("tables", () => {
    it("lists user tables sorted, excluding sqlite_ internals", () => {
      const pp = setup();
      seed();
      expect(pp.tables()).toBe("posts\nusers");
    });

    it("reports when there are no tables", () => {
      const pp = setup();
      expect(pp.tables()).toBe("No tables");
    });
  });

  describe("indexes", () => {
    it("lists user indexes with their table", () => {
      const pp = setup();
      seed();
      expect(pp.indexes()).toBe("idx_users_name on users");
    });

    it("excludes auto-created indexes", () => {
      const pp = setup();
      db.prepare("CREATE TABLE t (id INTEGER, code TEXT UNIQUE)").run();
      expect(pp.indexes()).toBe("No indexes");
    });
  });

  describe("schema (no table)", () => {
    it("concatenates every CREATE TABLE statement", () => {
      const pp = setup();
      seed();
      const r = pp.schema();
      expect(r).toEqual({
        ok: true,
        text:
          "CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT);\n\n" +
          "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);",
      });
    });

    it("reports when there are no tables", () => {
      const pp = setup();
      expect(pp.schema()).toEqual({ ok: true, text: "No tables" });
    });
  });

  describe("schema <table>", () => {
    it("prints the CREATE statement plus the table's indexes", () => {
      const pp = setup();
      seed();
      expect(pp.schema("users")).toEqual({
        ok: true,
        text:
          "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);\n\n" +
          "CREATE INDEX idx_users_name ON users(name);",
      });
    });

    it("prints just the CREATE statement when there are no indexes", () => {
      const pp = setup();
      seed();
      expect(pp.schema("posts")).toEqual({
        ok: true,
        text: "CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT);",
      });
    });

    it("errors for an unknown table", () => {
      const pp = setup();
      seed();
      expect(pp.schema("ghost")).toEqual({
        ok: false,
        error: "unknown table: ghost",
      });
    });
  });
});
