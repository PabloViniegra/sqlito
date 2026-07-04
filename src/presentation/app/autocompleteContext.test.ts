import { describe, expect, it } from "vitest";
import {
  deriveAutocompleteContext,
  findReferencedTable,
  parseFromClause,
} from "./autocompleteContext.ts";

describe("parseFromClause", () => {
  it("returns the table name when FROM has no alias", () => {
    expect(parseFromClause("SELECT * FROM users")).toEqual({ name: "users" });
  });

  it("returns the table name and alias when FROM has an alias", () => {
    expect(parseFromClause("SELECT * FROM users u")).toEqual({
      name: "users",
      alias: "u",
    });
  });

  it("returns the alias when FROM uses the AS keyword", () => {
    expect(parseFromClause("SELECT * FROM users AS u")).toEqual({
      name: "users",
      alias: "u",
    });
  });

  it("strips line comments before parsing", () => {
    expect(
      parseFromClause("SELECT 1;\n-- FROM skip\nSELECT * FROM users"),
    ).toEqual({
      name: "users",
    });
  });

  it("strips block comments before parsing", () => {
    expect(parseFromClause("/* FROM skip */ SELECT * FROM users")).toEqual({
      name: "users",
    });
  });

  it("returns the last FROM clause when there are multiple", () => {
    expect(
      parseFromClause("SELECT * FROM users u JOIN orders o ON u.id = o.uid"),
    ).toEqual({ name: "users", alias: "u" });
  });

  it("matches case-insensitively", () => {
    expect(parseFromClause("select * from Users")).toEqual({ name: "Users" });
  });

  it("returns undefined when there is no FROM clause", () => {
    expect(parseFromClause("SELECT 1")).toBeUndefined();
  });

  it("returns undefined when the trailing identifier is incomplete", () => {
    expect(parseFromClause("SELECT * FROM")).toBeUndefined();
  });
});

describe("findReferencedTable", () => {
  it("returns the table name when the identifier matches the alias", () => {
    expect(findReferencedTable("SELECT * FROM users u", "u")).toBe("users");
  });

  it("returns the table name when the identifier matches the table name", () => {
    expect(findReferencedTable("SELECT * FROM users", "users")).toBe("users");
  });

  it("returns undefined when the identifier is unrelated", () => {
    expect(findReferencedTable("SELECT * FROM users u", "z")).toBeUndefined();
  });

  it("returns undefined when there is no FROM clause", () => {
    expect(findReferencedTable("SELECT 1", "users")).toBeUndefined();
  });
});

describe("deriveAutocompleteContext", () => {
  it("returns the trailing token as prefix and no context for empty sql", () => {
    const ac = deriveAutocompleteContext("");
    expect(ac).toEqual({ prefix: "", context: {} });
  });

  it("returns the trailing token as prefix for plain keywords", () => {
    const ac = deriveAutocompleteContext("SELE");
    expect(ac).toEqual({ prefix: "SELE", context: {} });
  });

  it("returns empty prefix and prefixBase 'u.' when prefix is exactly the alias", () => {
    const ac = deriveAutocompleteContext("SELECT * FROM users u.");
    expect(ac).toEqual({
      prefix: "",
      prefixBase: "u.",
      context: { referencedTable: "users" },
    });
  });

  it("returns the filter portion after the dot in prefix 'u.i'", () => {
    const ac = deriveAutocompleteContext("SELECT * FROM users u.i");
    expect(ac).toEqual({
      prefix: "i",
      prefixBase: "u.",
      context: { referencedTable: "users" },
    });
  });

  it("matches table name without alias when prefix is just '<name>.'", () => {
    const ac = deriveAutocompleteContext("SELECT * FROM users.");
    expect(ac).toEqual({
      prefix: "",
      prefixBase: "users.",
      context: { referencedTable: "users" },
    });
  });

  it("falls back to plain prefix when identifier is unknown", () => {
    const unrelated = deriveAutocompleteContext("SELECT * FROM users u. z.");
    expect(unrelated).toEqual({ prefix: "z.", context: {} });
  });

  it("preserves uppercase typing and resolves it to the alias", () => {
    const ac = deriveAutocompleteContext("SELECT * FROM users U.");
    expect(ac).toEqual({
      prefix: "",
      prefixBase: "U.",
      context: { referencedTable: "users" },
    });
  });
});
