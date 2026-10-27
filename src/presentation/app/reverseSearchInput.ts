import type { HistoryEntry } from "../../domain/history/HistoryEntry.ts";
import type { OverlayKey } from "./overlayKey.ts";
import type { AppDispatch } from "./dotCommand.ts";

type Key = Pick<
  OverlayKey,
  "return" | "escape" | "backspace" | "delete" | "ctrl"
>;

export function handleReverseSearchInput(args: {
  input: string;
  key: Key;
  promptBeforeReverse: string;
  query: string;
  entries: readonly HistoryEntry[];
  dispatch: AppDispatch;
}): void {
  const { input, key, promptBeforeReverse, query, entries, dispatch } = args;
  if (key.escape) {
    dispatch({ type: "setPrompt", value: promptBeforeReverse });
    dispatch({ type: "reverseSearchCancel" });
    return;
  }
  if (key.ctrl && input === "c") {
    dispatch({ type: "setPrompt", value: promptBeforeReverse });
    dispatch({ type: "reverseSearchCancel" });
    return;
  }
  if (key.return) {
    dispatch({ type: "reverseSearchCommit" });
    return;
  }
  const nextQuery =
    key.backspace || key.delete
      ? query.slice(0, -1)
      : input && !key.ctrl
        ? query + input
        : query;
  dispatch({ type: "reverseSearchChange", query: nextQuery });
  dispatch({
    type: "setPrompt",
    value: matchNewest(nextQuery, entries)?.sql ?? "",
  });
}

function matchNewest(
  query: string,
  entries: readonly HistoryEntry[],
): HistoryEntry | null {
  const haystack = query.toLowerCase();
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry !== undefined && entry.sql.toLowerCase().includes(haystack)) {
      return entry;
    }
  }
  return null;
}
