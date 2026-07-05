import type { HistoryEntry } from "../../domain/history/HistoryEntry.ts";
import type { QueryOutcome } from "../../domain/sql/QueryOutcome.ts";

export type PastQuery = {
  sql: string;
  outcome: QueryOutcome;
};

export type AutocompleteContext = {
  precedingToken?: string;
  referencedTable?: string;
};

export type AutocompleteState = {
  open: boolean;
  index: number;
  prefix: string;
  prefixBase?: string;
  context: AutocompleteContext;
};

export type StatusMessage = {
  text: string;
  kind: "info" | "error";
};

export type ReverseSearchState = {
  query: string;
};

export type AppState = {
  prompt: string;
  history: { entries: readonly HistoryEntry[]; cursor: number };
  pastQueries: readonly PastQuery[];
  autocomplete: AutocompleteState | null;
  lastRowsOutcome: QueryOutcome | null;
  statusMessage: StatusMessage | null;
  reverseSearch: ReverseSearchState | null;
  variables: readonly [string, string][];
};

export type AppEvent =
  | { type: "setPrompt"; value: string }
  | { type: "submit"; outcome: QueryOutcome }
  | { type: "backspace" }
  | { type: "clearPrompt" }
  | { type: "exit" }
  | {
      type: "openAutocomplete";
      prefix: string;
      prefixBase?: string;
      context?: AutocompleteContext;
    }
  | { type: "closeAutocomplete" }
  | { type: "moveAutocomplete"; delta: -1 | 1; count: number }
  | { type: "commitAutocomplete"; replacement: string }
  | { type: "loadHistory"; entries: readonly HistoryEntry[] }
  | { type: "recordQuery"; entry: HistoryEntry; outcome: QueryOutcome }
  | { type: "historyUp" }
  | { type: "historyDown" }
  | { type: "reverseSearchOpen" }
  | { type: "reverseSearchChange"; query: string }
  | { type: "reverseSearchCommit" }
  | { type: "reverseSearchCancel" }
  | { type: "exportTo"; path: string }
  | { type: "command"; line: string }
  | { type: "setVariable"; name: string; raw: string }
  | { type: "unsetVariable"; name: string }
  | { type: "setStatus"; status: StatusMessage | null };

export const initialState: AppState = {
  prompt: "",
  history: { entries: [], cursor: 0 },
  pastQueries: [],
  autocomplete: null,
  lastRowsOutcome: null,
  statusMessage: null,
  reverseSearch: null,
  variables: [],
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function appReducer(state: AppState, event: AppEvent): AppState {
  switch (event.type) {
    case "setPrompt":
      return { ...state, prompt: event.value };
    case "backspace":
      return { ...state, prompt: state.prompt.slice(0, -1) };
    case "clearPrompt":
      return { ...state, prompt: "" };
    case "submit": {
      const next: AppState = {
        ...state,
        prompt: "",
        statusMessage: null,
        lastRowsOutcome: event.outcome.kind === "rows" ? event.outcome : null,
      };
      if (state.reverseSearch !== null) next.reverseSearch = null;
      return next;
    }
    case "setStatus":
      return { ...state, statusMessage: event.status };
    case "exit":
      return state;
    case "openAutocomplete":
      return {
        ...state,
        autocomplete: {
          open: true,
          index: 0,
          prefix: event.prefix,
          prefixBase: event.prefixBase,
          context: event.context ?? {},
        },
      };
    case "closeAutocomplete":
      return { ...state, autocomplete: null };
    case "moveAutocomplete": {
      if (state.autocomplete === null) return state;
      if (event.count <= 0) return state;
      const raw = state.autocomplete.index + event.delta;
      const wrapped = ((raw % event.count) + event.count) % event.count;
      return {
        ...state,
        autocomplete: { ...state.autocomplete, index: wrapped },
      };
    }
    case "commitAutocomplete":
      return { ...state, prompt: event.replacement, autocomplete: null };
    case "loadHistory":
      return {
        ...state,
        history: { entries: event.entries, cursor: 0 },
      };
    case "recordQuery": {
      const nextEntries = [...state.history.entries, event.entry];
      return {
        ...state,
        history: { ...state.history, entries: nextEntries },
        pastQueries: [
          ...state.pastQueries,
          { sql: event.entry.sql, outcome: event.outcome },
        ],
      };
    }
    case "historyUp":
      return {
        ...state,
        history: {
          ...state.history,
          cursor: clamp(
            state.history.cursor + 1,
            0,
            state.history.entries.length,
          ),
        },
      };
    case "historyDown":
      return {
        ...state,
        history: {
          ...state.history,
          cursor: clamp(
            state.history.cursor - 1,
            0,
            state.history.entries.length,
          ),
        },
      };
    case "reverseSearchOpen":
      return { ...state, reverseSearch: { query: "" } };
    case "reverseSearchChange":
      if (state.reverseSearch === null) return state;
      return { ...state, reverseSearch: { query: event.query } };
    case "reverseSearchCommit":
      return { ...state, reverseSearch: null };
    case "reverseSearchCancel":
      return { ...state, reverseSearch: null };
    case "exportTo":
      return state;
    case "command":
      return state;
    case "setVariable": {
      const pair: [string, string] = [event.name, event.raw];
      const index = state.variables.findIndex(([n]) => n === event.name);
      const variables =
        index === -1
          ? [...state.variables, pair]
          : state.variables.map((v, i) => (i === index ? pair : v));
      return { ...state, variables };
    }
    case "unsetVariable":
      return {
        ...state,
        variables: state.variables.filter(([n]) => n !== event.name),
      };
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}
