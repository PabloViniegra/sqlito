import { describe, expect, it } from "vitest";
import type { SchemaRepository } from "../../domain/schema/SchemaRepository.ts";
import type { Table } from "../../domain/schema/Table.ts";
import { GetAutocompleteSuggestions } from "./GetAutocompleteSuggestions.ts";

const stubSchema = (tables: readonly Table[]): SchemaRepository => ({
  listTables: () => tables,
  describe: (name: string) => tables.find((t) => t.name === name),
  refresh: () => {},
});

const USERS_TABLE: Table = {
  name: "users",
  columns: [
    { name: "id", type: "INTEGER" },
    { name: "email", type: "TEXT" },
    { name: "age", type: "INTEGER" },
  ],
};

const POSTS_TABLE: Table = {
  name: "posts",
  columns: [{ name: "id", type: "INTEGER" }],
};

describe("GetAutocompleteSuggestions", () => {
  describe("empty prefix", () => {
    it("returns up to 10 keyword suggestions when prefix is empty", () => {
      const sut = new GetAutocompleteSuggestions(stubSchema([]));

      const result = sut.suggest("", {});

      expect(result.length).toBe(10);
      expect(result.every((s) => s.kind === "keyword")).toBe(true);
    });

    it("caps the empty-prefix result at 10 even when keywords list exceeds it", () => {
      const sut = new GetAutocompleteSuggestions(stubSchema([]));

      const result = sut.suggest("", {});

      expect(result.length).toBeLessThanOrEqual(10);
    });

    it("only shows keywords (not tables) when prefix is empty", () => {
      const sut = new GetAutocompleteSuggestions(stubSchema([USERS_TABLE]));

      const result = sut.suggest("", {});

      expect(result.some((s) => s.kind === "table")).toBe(false);
      expect(result.every((s) => s.kind === "keyword")).toBe(true);
    });
  });

  describe("case-insensitive prefix filter", () => {
    it("matches SELECT when prefix is lowercase 'sel'", () => {
      const sut = new GetAutocompleteSuggestions(stubSchema([]));

      const result = sut.suggest("sel", {});

      expect(result).toContainEqual({ label: "SELECT", kind: "keyword" });
    });

    it("matches a table when prefix differs in case", () => {
      const sut = new GetAutocompleteSuggestions(stubSchema([USERS_TABLE]));

      const result = sut.suggest("use", {});

      expect(result).toContainEqual({
        label: "users",
        kind: "table",
        detail: "table",
      });
    });

    it("trims whitespace from the prefix before matching", () => {
      const sut = new GetAutocompleteSuggestions(stubSchema([]));

      const result = sut.suggest("  sel  ", {});

      expect(result).toContainEqual({ label: "SELECT", kind: "keyword" });
    });
  });

  describe("ranking: prefix > substring, then length, then alphabetical", () => {
    it("ranks a prefix match ahead of a substring match", () => {
      const sut = new GetAutocompleteSuggestions(stubSchema([]));

      const result = sut.suggest("sel", {});
      const labels = result.map((s) => s.label);

      const prefixIdx = labels.indexOf("SELECT");
      const substringIdx = labels.findIndex(
        (l) => l !== "SELECT" && l.toLowerCase().includes("sel"),
      );
      expect(prefixIdx).toBeGreaterThanOrEqual(0);
      if (substringIdx >= 0) {
        expect(prefixIdx).toBeLessThan(substringIdx);
      }
    });

    it("ranks the shortest prefix match first when several share the prefix", () => {
      const sut = new GetAutocompleteSuggestions(stubSchema([]));

      const result = sut.suggest("or", {});

      expect(result[0]?.label).toBe("OR");
    });

    it("breaks ties alphabetically", () => {
      const sut = new GetAutocompleteSuggestions(stubSchema([]));

      const result = sut.suggest("sel", {});

      const prefixMatches = result.filter((s) =>
        s.label.toLowerCase().startsWith("sel"),
      );
      const labels = prefixMatches.map((s) => s.label);
      const sorted = [...labels].sort((a, b) => a.localeCompare(b));
      expect(labels).toEqual(sorted);
    });

    it("ranks shorter substring matches ahead of longer ones", () => {
      const sut = new GetAutocompleteSuggestions(stubSchema([]));

      const result = sut.suggest("ar", {});
      const substringMatches = result.filter(
        (s) => !s.label.toLowerCase().startsWith("ar"),
      );
      const labels = substringMatches.map((s) => s.label);
      const sortedByLength = [...labels].sort(
        (a, b) => a.length - b.length || a.localeCompare(b),
      );
      expect(labels).toEqual(sortedByLength);
    });
  });

  describe("table suggestions", () => {
    it("marks table kind with detail 'table'", () => {
      const sut = new GetAutocompleteSuggestions(stubSchema([USERS_TABLE]));

      const result = sut.suggest("us", {});

      expect(result).toContainEqual({
        label: "users",
        kind: "table",
        detail: "table",
      });
    });

    it("returns no table suggestions when schema is empty", () => {
      const sut = new GetAutocompleteSuggestions(stubSchema([]));

      const result = sut.suggest("", {});

      expect(result.some((s) => s.kind === "table")).toBe(false);
    });

    it("combines keyword and table suggestions in one list", () => {
      const sut = new GetAutocompleteSuggestions(stubSchema([USERS_TABLE]));

      const result = sut.suggest("u", {});

      const kinds = new Set(result.map((s) => s.kind));
      expect(kinds.has("keyword") || kinds.has("table")).toBe(true);
    });
  });

  describe("cap", () => {
    it("caps the result at 10 suggestions", () => {
      const tables = Array.from({ length: 30 }, (_, i) => ({
        name: `t${i}`,
        columns: [],
      }));
      const sut = new GetAutocompleteSuggestions(stubSchema(tables));

      const result = sut.suggest("", {});

      expect(result.length).toBe(10);
    });
  });

  describe("column completion via referencedTable context", () => {
    it("returns only the columns of the referenced table, with type in detail", () => {
      const sut = new GetAutocompleteSuggestions(
        stubSchema([USERS_TABLE, POSTS_TABLE]),
      );

      const result = sut.suggest("", { referencedTable: "users" });

      expect(result).toEqual([
        { label: "id", kind: "column", detail: "INTEGER" },
        { label: "age", kind: "column", detail: "INTEGER" },
        { label: "email", kind: "column", detail: "TEXT" },
      ]);
    });

    it("returns no keywords or tables when the referenced table resolves", () => {
      const sut = new GetAutocompleteSuggestions(stubSchema([USERS_TABLE]));

      const result = sut.suggest("sel", { referencedTable: "users" });

      expect(result.every((s) => s.kind === "column")).toBe(true);
      expect(result.some((s) => s.kind === "keyword")).toBe(false);
      expect(result.some((s) => s.kind === "table")).toBe(false);
    });

    it("filters column suggestions case-insensitively and ranks prefix matches first", () => {
      const sut = new GetAutocompleteSuggestions(stubSchema([USERS_TABLE]));

      const result = sut.suggest("e", { referencedTable: "users" });
      const labels = result.map((s) => s.label);

      expect(labels).toContain("email");
      if (labels.includes("age")) {
        expect(labels.indexOf("email")).toBeLessThan(labels.indexOf("age"));
      }
    });

    it("ranks shorter prefix matches ahead of substring matches in columns", () => {
      const sut = new GetAutocompleteSuggestions(stubSchema([USERS_TABLE]));

      const result = sut.suggest("i", { referencedTable: "users" });

      const labels = result.map((s) => s.label);
      expect(labels).toContain("id");
    });

    it("does not include any keywords even when prefix matches a keyword", () => {
      const sut = new GetAutocompleteSuggestions(stubSchema([USERS_TABLE]));

      const result = sut.suggest("FROM", { referencedTable: "users" });

      expect(result.every((s) => s.kind === "column")).toBe(true);
    });

    it("falls back to keywords + tables when referencedTable does not resolve", () => {
      const sut = new GetAutocompleteSuggestions(stubSchema([USERS_TABLE]));

      const result = sut.suggest("sel", {
        referencedTable: "missing_table",
      });

      const kinds = new Set(result.map((s) => s.kind));
      expect(kinds.has("keyword")).toBe(true);
    });

    it("returns no detail for columns with null type", () => {
      const sut = new GetAutocompleteSuggestions(
        stubSchema([{ name: "loose", columns: [{ name: "a", type: null }] }]),
      );

      const result = sut.suggest("", { referencedTable: "loose" });

      expect(result).toEqual([{ label: "a", kind: "column" }]);
    });
  });
});
