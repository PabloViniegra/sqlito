import { describe, expect, it } from "vitest";
import { classifySideEffect } from "./classifySideEffect.ts";

describe("classifySideEffect", () => {
  it.each([
    ["VACUUM", true],
    ["vacuum", true],
    ["Vacuum", true],
    ["REINDEX", true],
    ["reindex", true],
    ["ANALYZE", true],
    ["analyze", true],
    ["CREATE TABLE t (a INT)", true],
    ["create table t (a int)", true],
    ["DROP TABLE t", true],
    ["ALTER TABLE t ADD COLUMN x INT", true],
    ["PRAGMA user_version = 1", true],
    ["PRAGMA journal_mode = WAL", true],
    ["pragma user_version = 7", true],
    ["PRAGMA wal_autocheckpoint(1000)", true],
    ["PRAGMA table_info(t)", true],
    ["SELECT 1", false],
    ["INSERT INTO t VALUES (1)", false],
    ["UPDATE t SET a = 1", false],
    ["DELETE FROM t", false],
    ["PRAGMA user_version", false],
    ["PRAGMA table_info", false],
    ["", false],
    ["   ", false],
  ])("classifies %j as side-effect=%s", (sql, expected) => {
    expect(classifySideEffect(sql)).toBe(expected);
  });

  it("tolerates leading whitespace before VACUUM", () => {
    expect(classifySideEffect("   \t\n  VACUUM")).toBe(true);
  });

  it("tolerates a line comment before VACUUM", () => {
    expect(classifySideEffect("-- housekeeping\nVACUUM")).toBe(true);
  });

  it("tolerates a block comment before VACUUM", () => {
    expect(classifySideEffect("/* compact */ VACUUM")).toBe(true);
  });

  it("tolerates comments and whitespace before CREATE TABLE", () => {
    expect(
      classifySideEffect(
        "-- new table\n/* schema */\n  CREATE TABLE t (a INT)",
      ),
    ).toBe(true);
  });
});
