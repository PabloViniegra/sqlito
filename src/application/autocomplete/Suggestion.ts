export type SuggestionKind = "keyword" | "table" | "column";

export type Suggestion = {
  label: string;
  detail?: string;
  kind: SuggestionKind;
};

export type AutocompleteContext = {
  precedingToken?: string;
  referencedTable?: string;
};
