import { SQL_KEYWORDS } from "../../domain/sql/keywords.ts";
import type {
  AutocompleteContext,
  SchemaRepository,
  Suggestion,
} from "./Suggestion.ts";

export type {
  AutocompleteContext,
  SchemaRepository,
  Suggestion,
} from "./Suggestion.ts";

export class GetAutocompleteSuggestions {
  private readonly schema: SchemaRepository;

  constructor(schema: SchemaRepository) {
    this.schema = schema;
  }

  suggest(prefix: string, _context: AutocompleteContext): Suggestion[] {
    const trimmed = prefix.trim();
    const haystack = trimmed.toLowerCase();

    const keywordMatches = SQL_KEYWORDS.filter((kw) =>
      matches(haystack, kw.toLowerCase()),
    ).map<Suggestion>((label) => ({ label, kind: "keyword" }));

    const tableMatches = this.schema
      .listTables()
      .filter((t) => matches(haystack, t.toLowerCase()))
      .map<Suggestion>((label) => ({
        label,
        kind: "table" as const,
        detail: "table",
      }));

    const combined = [...keywordMatches, ...tableMatches];
    if (haystack === "") return combined.slice(0, 10);
    return rank(combined, haystack).slice(0, 10);
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
