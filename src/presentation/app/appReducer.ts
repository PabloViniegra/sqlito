import type { HistoryEntry } from "../../domain/history/HistoryEntry.ts";
import type { QueryOutcome } from "../../domain/sql/QueryOutcome.ts";
import { DEFAULT_THEME, type Theme } from "../../domain/theme/Theme.ts";
import {
  readlineReducer,
  type ReadlineIntent,
  type ReadlineState,
} from "./readline.ts";

export const MAX_VISIBLE_QUERIES = 5;

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

export type CommandPaletteState = {
  query: string;
  index: number;
};

export type AppState = {
  prompt: ReadlineState;
  history: { entries: readonly HistoryEntry[] };
  pastQueries: readonly PastQuery[];
  pastQueriesScrollOffset: number;
  autocomplete: AutocompleteState | null;
  lastOutcome: QueryOutcome | null;
  statusMessage: StatusMessage | null;
  reverseSearch: ReverseSearchState | null;
  variables: readonly [string, string][];
  favorites: readonly [string, string][];
  theme: Theme;
  commandPalette: CommandPaletteState | null;
};

export type AppEvent =
  | { type: "readline"; intent: ReadlineIntent }
  | { type: "setPrompt"; value: string }
  | { type: "submit"; outcome: QueryOutcome }
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
  | { type: "recordError"; sql: string; outcome: QueryOutcome }
  | { type: "reverseSearchOpen" }
  | { type: "reverseSearchChange"; query: string }
  | { type: "reverseSearchCommit" }
  | { type: "reverseSearchCancel" }
  | { type: "exportTo"; path: string }
  | { type: "command"; line: string }
  | { type: "setVariable"; name: string; raw: string }
  | { type: "unsetVariable"; name: string }
  | { type: "loadFavorites"; favorites: readonly [string, string][] }
  | { type: "commitFavorite"; name: string; sql: string }
  | { type: "removeFavorite"; name: string }
  | { type: "setStatus"; status: StatusMessage | null }
  | { type: "setTheme"; theme: Theme }
  | { type: "openCommandPalette" }
  | { type: "closeCommandPalette" }
  | { type: "setCommandPaletteQuery"; query: string }
  | { type: "moveCommandPalette"; delta: -1 | 1; count: number }
  | { type: "pastQueriesPageUp" }
  | { type: "pastQueriesPageDown" };

export const initialState: AppState = {
  prompt: { text: "", cursor: 0 },
  history: { entries: [] },
  pastQueries: [],
  pastQueriesScrollOffset: 0,
  autocomplete: null,
  lastOutcome: null,
  statusMessage: null,
  reverseSearch: null,
  variables: [],
  favorites: [],
  theme: DEFAULT_THEME,
  commandPalette: null,
};

function wrapIndex(raw: number, count: number): number {
  return ((raw % count) + count) % count;
}

export function appReducer(state: AppState, event: AppEvent): AppState {
  switch (event.type) {
    case "readline":
      return { ...state, prompt: readlineReducer(state.prompt, event.intent) };
    case "setPrompt":
      return {
        ...state,
        prompt: readlineReducer(state.prompt, {
          type: "Reset",
          text: event.value,
        }),
      };
    case "submit": {
      const next: AppState = {
        ...state,
        prompt: readlineReducer(state.prompt, { type: "Reset", text: "" }),
        statusMessage: null,
        lastOutcome: event.outcome,
        pastQueriesScrollOffset: 0,
      };
      if (state.reverseSearch !== null) next.reverseSearch = null;
      return next;
    }
    case "setStatus": {
      if (event.status === null) {
        return { ...state, statusMessage: null, pastQueriesScrollOffset: 0 };
      }
      return { ...state, statusMessage: event.status };
    }
    case "pastQueriesPageUp": {
      const maxOffset = Math.max(
        0,
        state.pastQueries.length - MAX_VISIBLE_QUERIES,
      );
      if (state.pastQueriesScrollOffset >= maxOffset) return state;
      return {
        ...state,
        pastQueriesScrollOffset: state.pastQueriesScrollOffset + 1,
      };
    }
    case "pastQueriesPageDown":
      if (state.pastQueriesScrollOffset <= 0) return state;
      return {
        ...state,
        pastQueriesScrollOffset: state.pastQueriesScrollOffset - 1,
      };
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
      const wrapped = wrapIndex(
        state.autocomplete.index + event.delta,
        event.count,
      );
      return {
        ...state,
        autocomplete: { ...state.autocomplete, index: wrapped },
      };
    }
    case "commitAutocomplete":
      return {
        ...state,
        prompt: readlineReducer(state.prompt, {
          type: "Reset",
          text: event.replacement,
        }),
        autocomplete: null,
      };
    case "loadHistory":
      return {
        ...state,
        history: { entries: event.entries },
      };
    case "recordQuery": {
      const nextEntries = [...state.history.entries, event.entry];
      return {
        ...state,
        history: { entries: nextEntries },
        pastQueries: [
          ...state.pastQueries,
          { sql: event.entry.sql, outcome: event.outcome },
        ],
      };
    }
    case "recordError":
      // errors show in the results flow but stay out of the ↑/Ctrl+R recall corpus
      return {
        ...state,
        pastQueries: [
          ...state.pastQueries,
          { sql: event.sql, outcome: event.outcome },
        ],
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
      return {
        ...state,
        prompt: readlineReducer(state.prompt, { type: "Reset", text: "" }),
      };
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
    case "loadFavorites":
      return { ...state, favorites: event.favorites };
    case "commitFavorite": {
      const pair: [string, string] = [event.name, event.sql];
      const index = state.favorites.findIndex(([n]) => n === event.name);
      const favorites =
        index === -1
          ? [...state.favorites, pair]
          : state.favorites.map((f, i) => (i === index ? pair : f));
      return { ...state, favorites };
    }
    case "removeFavorite":
      return {
        ...state,
        favorites: state.favorites.filter(([n]) => n !== event.name),
      };
    case "setTheme":
      return { ...state, theme: event.theme };
    case "openCommandPalette":
      return { ...state, commandPalette: { query: "", index: 0 } };
    case "closeCommandPalette":
      return { ...state, commandPalette: null };
    case "setCommandPaletteQuery":
      if (state.commandPalette === null) return state;
      return {
        ...state,
        commandPalette: { query: event.query, index: 0 },
      };
    case "moveCommandPalette": {
      if (state.commandPalette === null) return state;
      if (event.count <= 0) return state;
      const wrapped = wrapIndex(
        state.commandPalette.index + event.delta,
        event.count,
      );
      return {
        ...state,
        commandPalette: { ...state.commandPalette, index: wrapped },
      };
    }
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

export type { ReadlineState };
