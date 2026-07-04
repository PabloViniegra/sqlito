import { describe, expect, it } from "vitest";
import { isReadOnly } from "./isReadOnly.ts";

describe("isReadOnly", () => {
  it.each([
    ["SELECT 1", true],
    ["select 1", true],
    ["Select 1", true],
    ["  SELECT * FROM users", true],
    ["\t\n  SELECT 1", true],
    ["WITH cte AS (SELECT 1) SELECT * FROM cte", true],
    ["PRAGMA table_info(users)", true],
    ["PRAGMA user_version", true],
    ["pragma user_version", true],
    ["PRAGMA user_version = 1", false],
    ["PRAGMA journal_mode = WAL", false],
    ["EXPLAIN SELECT * FROM users", true],
    ["EXPLAIN SELECT 1", true],
    ["explain query plan select 1", true],
    ["EXPLAIN QUERY PLAN SELECT 1", true],
    ["-- comment\nSELECT 1", true],
    ["/* hi */ SELECT 1", true],
    ["/* a */ /* b */ -- c\n  PRAGMA user_version", true],
    ["INSERT INTO users VALUES (1)", false],
    ['UPDATE users SET name = "x"', false],
    ["DELETE FROM users", false],
    ["CREATE TABLE t (a INT)", false],
    ["DROP TABLE t", false],
    ["ALTER TABLE t ADD COLUMN x INT", false],
    ["REPLACE INTO users VALUES (1)", false],
    ["ATTACH 'foo.db' AS aux", false],
    ["DETACH aux", false],
    ["VACUUM", false],
    ["REINDEX", false],
    ["ANALYZE", false],
    ["SAVEPOINT x", false],
    ["RELEASE x", false],
    ["", false],
    ["   ", false],
  ])("classifies %j as %s", (sql, expected) => {
    expect(isReadOnly(sql)).toBe(expected);
  });
});
