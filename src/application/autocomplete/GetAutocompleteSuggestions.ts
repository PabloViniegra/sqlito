import type { SchemaRepository } from "../../domain/schema/SchemaRepository.ts";
import type { Table } from "../../domain/schema/Table.ts";
import { SQL_KEYWORDS } from "../../domain/sql/keywords.ts";
import type { AutocompleteContext, Suggestion } from "./Suggestion.ts";

export type { AutocompleteContext, Suggestion } from "./Suggestion.ts";
export { type SchemaRepository } from "../../domain/schema/SchemaRepository.ts";

export class GetAutocompleteSuggestions {
  private readonly schema: SchemaRepository;

  constructor(schema: SchemaRepository) {
    this.schema = schema;
  }

  suggest(prefix: string, context: AutocompleteContext): Suggestion[] {
    if (context.referencedTable !== undefined) {
      const table = this.schema.describe(context.referencedTable);
      if (table !== undefined) {
        return this.columnSuggestions(prefix, table);
      }
    }

    const trimmed = prefix.trim();
    const haystack = trimmed.toLowerCase();

    const keywordMatches = SQL_KEYWORDS.filter((kw) =>
      matches(haystack, kw.toLowerCase()),
    ).map<Suggestion>((label) => ({ label, kind: "keyword" }));

    const tableMatches = this.schema
      .listTables()
      .map((t) => t.name)
      .filter((name) => matches(haystack, name.toLowerCase()))
      .map<Suggestion>((label) => ({
        label,
        kind: "table" as const,
        detail: "table",
      }));

    const combined = [...keywordMatches, ...tableMatches];
    if (haystack === "") return combined.slice(0, 10);
    return rank(combined, haystack).slice(0, 10);
  }

  private columnSuggestions(prefix: string, table: Table): Suggestion[] {
    const trimmed = prefix.trim();
    const haystack = trimmed.toLowerCase();
    const matched = table.columns.filter((c) =>
      matches(haystack, c.name.toLowerCase()),
    );
    const ranked = rank(
      matched.map<Suggestion>((c) => ({
        label: c.name,
        kind: "column",
        detail: c.type === null ? undefined : c.type,
      })),
      haystack,
    );
    return ranked.slice(0, 10);
  }
}

function matches(haystack: string, candidate: string): boolean {
  if (haystack === "") return true;
  return candidate.startsWith(haystack) || candidate.includes(haystack);
}

function rank(suggestions: Suggestion[], haystack: string): Suggestion[] {
  return [...suggestions].sort((a, b) => {
    const aPrefix = a.label.toLowerCase().startsWith(haystack) ? 0 : 1;
    const bPrefix = b.label.toLowerCase().startsWith(haystack) ? 0 : 1;
    if (aPrefix !== bPrefix) return aPrefix - bPrefix;
    if (a.label.length !== b.label.length)
      return a.label.length - b.label.length;
    return a.label.localeCompare(b.label);
  });
}
