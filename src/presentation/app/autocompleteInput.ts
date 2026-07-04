import type { GetAutocompleteSuggestions } from "../../application/autocomplete/GetAutocompleteSuggestions.ts";
import type {
  AppEvent,
  AutocompleteContext,
  AutocompleteState,
} from "./appReducer.ts";

type Dispatch = (event: AppEvent) => void;

export type Key = {
  return: boolean;
  escape: boolean;
  tab: boolean;
  upArrow: boolean;
  downArrow: boolean;
  backspace: boolean;
  delete: boolean;
  ctrl: boolean;
  meta: boolean;
};

export function handleAutocompleteInput(args: {
  input: string;
  key: Key;
  autocomplete: GetAutocompleteSuggestions;
  prompt: string;
  popup: AutocompleteState;
  dispatch: Dispatch;
}): void {
  const { input, key, autocomplete: ac, prompt, popup, dispatch } = args;
  const suggestions = ac.suggest(popup.prefix, {} as AutocompleteContext);
  if (key.escape) {
    dispatch({ type: "closeAutocomplete" });
    return;
  }
  if (key.return || key.tab) {
    const picked = suggestions[popup.index];
    if (picked === undefined) {
      dispatch({ type: "closeAutocomplete" });
      return;
    }
    const nextPrompt = prompt.replace(/\S+$/, picked.label);
    dispatch({ type: "commitAutocomplete", replacement: nextPrompt });
    return;
  }
  if (key.upArrow) {
    dispatch({
      type: "moveAutocomplete",
      delta: -1,
      count: suggestions.length,
    });
    return;
  }
  if (key.downArrow) {
    dispatch({ type: "moveAutocomplete", delta: 1, count: suggestions.length });
    return;
  }
  if (key.backspace || key.delete || (input && !key.ctrl && !key.meta)) {
    const nextPrompt =
      key.backspace || key.delete ? prompt.slice(0, -1) : prompt + input;
    const prefix = nextPrompt.match(/\S+$/)?.[0] ?? "";
    dispatch({ type: "setPrompt", value: nextPrompt });
    dispatch({ type: "openAutocomplete", prefix });
  }
}
