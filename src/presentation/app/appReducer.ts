import type { QueryOutcome } from "../../domain/sql/QueryOutcome.ts";

export type HistoryEntry = {
  sql: string;
  outcome: "ok" | "affected" | "side-effect";
  timestamp: number;
};

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
  context: AutocompleteContext;
};

export type AppState = {
  prompt: string;
  history: { entries: readonly HistoryEntry[]; cursor: number };
  pastQueries: readonly PastQuery[];
  autocomplete: AutocompleteState | null;
  lastRowsOutcome: QueryOutcome | null;
  statusMessage: string | null;
};

export type AppEvent =
  | { type: "setPrompt"; value: string }
  | { type: "submit" }
  | { type: "backspace" }
  | { type: "clearPrompt" }
  | { type: "exit" }
  | { type: "openAutocomplete" }
  | { type: "closeAutocomplete" }
  | { type: "moveAutocomplete"; delta: -1 | 1 }
  | { type: "commitAutocomplete" }
  | { type: "historyUp" }
  | { type: "historyDown" }
  | { type: "exportTo"; path: string }
  | { type: "command"; line: string };

export const initialState: AppState = {
  prompt: "",
  history: { entries: [], cursor: 0 },
  pastQueries: [],
  autocomplete: null,
  lastRowsOutcome: null,
  statusMessage: null,
};

export function appReducer(state: AppState, event: AppEvent): AppState {
  switch (event.type) {
    case "setPrompt":
      return { ...state, prompt: event.value };
    case "backspace":
      return { ...state, prompt: state.prompt.slice(0, -1) };
    case "clearPrompt":
      return { ...state, prompt: "" };
    case "submit":
      return { ...state, prompt: "", statusMessage: null };
    case "exit":
      return state;
    case "openAutocomplete":
      return {
        ...state,
        autocomplete: { open: true, index: 0, prefix: "", context: {} },
      };
    case "closeAutocomplete":
      return { ...state, autocomplete: null };
    case "moveAutocomplete": {
      if (state.autocomplete === null) return state;
      const nextIndex = Math.max(0, state.autocomplete.index + event.delta);
      return {
        ...state,
        autocomplete: { ...state.autocomplete, index: nextIndex },
      };
    }
    case "commitAutocomplete":
      return { ...state, autocomplete: null };
    case "historyUp":
      return {
        ...state,
        history: {
          ...state.history,
          cursor: Math.max(0, state.history.cursor - 1),
        },
      };
    case "historyDown":
      return {
        ...state,
        history: {
          ...state.history,
          cursor: Math.min(
            state.history.entries.length,
            state.history.cursor + 1,
          ),
        },
      };
    case "exportTo":
      return state;
    case "command":
      return state;
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}
