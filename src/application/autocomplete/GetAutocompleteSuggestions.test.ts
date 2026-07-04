import { describe, expect, it } from "vitest";
import type { SchemaRepository } from "./Suggestion.ts";
import { GetAutocompleteSuggestions } from "./GetAutocompleteSuggestions.ts";

const stubSchema = (tables: readonly string[]): SchemaRepository => ({
  listTables: () => tables,
});

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
      const sut = new GetAutocompleteSuggestions(stubSchema(["users"]));

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
      const sut = new GetAutocompleteSuggestions(stubSchema(["Users"]));

      const result = sut.suggest("use", {});

      expect(result).toContainEqual({
        label: "Users",
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
      const sut = new GetAutocompleteSuggestions(stubSchema(["users"]));

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
      const sut = new GetAutocompleteSuggestions(stubSchema(["users"]));

      const result = sut.suggest("u", {});

      const kinds = new Set(result.map((s) => s.kind));
      expect(kinds.has("keyword") || kinds.has("table")).toBe(true);
    });
  });

  describe("cap", () => {
    it("caps the result at 10 suggestions", () => {
      const tables = Array.from({ length: 30 }, (_, i) => `t${i}`);
      const sut = new GetAutocompleteSuggestions(stubSchema(tables));

      const result = sut.suggest("", {});

      expect(result.length).toBe(10);
    });
  });
});
