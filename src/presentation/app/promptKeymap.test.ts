import { describe, expect, it } from "vitest";
import { promptKeymapReadlineIntent } from "./promptKeymap.ts";

describe("promptKeymapReadlineIntent", () => {
  it("maps Ctrl+U to KillToStart", () => {
    expect(promptKeymapReadlineIntent("u", { ctrl: true })).toEqual({
      type: "KillToStart",
    });
  });

  it("maps Ctrl+K to KillToEnd", () => {
    expect(promptKeymapReadlineIntent("k", { ctrl: true })).toEqual({
      type: "KillToEnd",
    });
  });

  it("maps Ctrl+W to KillWord", () => {
    expect(promptKeymapReadlineIntent("w", { ctrl: true })).toEqual({
      type: "KillWord",
    });
  });

  it("maps Ctrl+A to MoveHome", () => {
    expect(promptKeymapReadlineIntent("a", { ctrl: true })).toEqual({
      type: "MoveHome",
    });
  });

  it("maps Ctrl+E to MoveEnd", () => {
    expect(promptKeymapReadlineIntent("e", { ctrl: true })).toEqual({
      type: "MoveEnd",
    });
  });

  it("maps Alt+LeftArrow to WordLeft", () => {
    expect(
      promptKeymapReadlineIntent("", { meta: true, leftArrow: true }),
    ).toEqual({ type: "WordLeft" });
  });

  it("maps Alt+RightArrow to WordRight", () => {
    expect(
      promptKeymapReadlineIntent("", { meta: true, rightArrow: true }),
    ).toEqual({ type: "WordRight" });
  });

  it("returns null for unrelated keys", () => {
    expect(promptKeymapReadlineIntent("a", {})).toBeNull();
    expect(promptKeymapReadlineIntent("", { leftArrow: true })).toBeNull();
    expect(promptKeymapReadlineIntent("", { meta: true })).toBeNull();
    expect(promptKeymapReadlineIntent("x", { ctrl: true })).toBeNull();
  });

  it("does not map Alt+LeftArrow without meta", () => {
    expect(promptKeymapReadlineIntent("", { leftArrow: true })).toBeNull();
  });

  it("does not confuse Ctrl+U with bare 'u' input", () => {
    expect(promptKeymapReadlineIntent("u", {})).toBeNull();
  });
});
