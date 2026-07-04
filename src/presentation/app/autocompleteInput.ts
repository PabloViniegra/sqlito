import type { GetAutocompleteSuggestions } from "../../application/autocomplete/GetAutocompleteSuggestions.ts";
import type {
  AppEvent,
  AutocompleteContext,
  AutocompleteState,
} from "./appReducer.ts";
import { deriveAutocompleteContext } from "./autocompleteContext.ts";

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
  const suggestions = ac.suggest(popup.prefix, popup.context);
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
    const trailing = prompt.match(/\S+$/)?.[0] ?? "";
    const base = popup.prefixBase ?? "";
    const nextPrompt =
      trailing.length === 0
        ? prompt + base + picked.label
        : prompt.slice(0, prompt.length - trailing.length) +
          base +
          picked.label;
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
    const context: AutocompleteContext = popup.context;
    const derived =
      context.referencedTable !== undefined
        ? keepColumnContext(nextPrompt, context)
        : deriveAutocompleteContext(nextPrompt);
    dispatch({ type: "setPrompt", value: nextPrompt });
    dispatch({
      type: "openAutocomplete",
      prefix: derived.prefix,
      prefixBase: derived.prefixBase,
      context: derived.context,
    });
  }
}

function keepColumnContext(
  prompt: string,
  context: AutocompleteContext,
): {
  prefix: string;
  prefixBase?: string;
  context: AutocompleteContext;
} {
  const trailing = prompt.match(/\S+$/)?.[0] ?? "";
  const dotIdx = trailing.lastIndexOf(".");
  if (dotIdx >= 0) {
    const id = trailing.slice(0, dotIdx);
    const filter = trailing.slice(dotIdx + 1);
    const nextContext: AutocompleteContext = { ...context };
    return {
      prefix: filter,
      prefixBase: `${id}.`,
      context: nextContext,
    };
  }
  return deriveAutocompleteContext(prompt);
}
