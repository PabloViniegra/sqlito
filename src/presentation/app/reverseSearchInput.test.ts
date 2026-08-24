import { describe, expect, it } from "vitest";
import type { AppEvent } from "./appReducer.ts";
import { handleReverseSearchInput } from "./reverseSearchInput.ts";

function makeDispatcher(): {
  events: AppEvent[];
  dispatch: (event: AppEvent) => void;
} {
  const events: AppEvent[] = [];
  return {
    events,
    dispatch: (event) => {
      events.push(event);
    },
  };
}

describe("handleReverseSearchInput", () => {
  it("cancels the search and restores the prior prompt on Ctrl+C", () => {
    const { events, dispatch } = makeDispatcher();

    handleReverseSearchInput({
      input: "c",
      key: { ctrl: true, return: false, escape: false, backspace: false, delete: false },
      promptBeforeReverse: "SELECT 1",
      query: "sel",
      entries: [],
      dispatch,
    });

    expect(events).toEqual([
      { type: "setPrompt", value: "SELECT 1" },
      { type: "reverseSearchCancel" },
    ]);
  });

  it("cancels on Esc", () => {
    const { events, dispatch } = makeDispatcher();

    handleReverseSearchInput({
      input: "",
      key: { ctrl: false, return: false, escape: true, backspace: false, delete: false },
      promptBeforeReverse: "SELECT 1",
      query: "sel",
      entries: [],
      dispatch,
    });

    expect(events).toEqual([
      { type: "setPrompt", value: "SELECT 1" },
      { type: "reverseSearchCancel" },
    ]);
  });
});
