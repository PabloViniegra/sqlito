import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { clearScreen, clearScreenSequence } from "./clearScreen.ts";

describe("clearScreenSequence", () => {
  it("returns the canonical three-part VT sequence to clear the alt-screen buffer and home the cursor", () => {
    expect(clearScreenSequence()).toBe("\x1b[3J\x1b[H\x1b[2J");
  });
});

describe("clearScreen", () => {
  it("writes the clear sequence to the supplied stdout exactly once", () => {
    const sink = new PassThrough();
    let wrote = "";
    sink.write = (chunk: string | Uint8Array): boolean => {
      wrote += chunk.toString();
      return true;
    };
    const stdout = sink as unknown as NodeJS.WriteStream;
    clearScreen(stdout);
    expect(wrote).toBe("\x1b[3J\x1b[H\x1b[2J");
    expect(wrote).toBe(clearScreenSequence());
  });
});
