import { render } from "ink";
import { PassThrough } from "node:stream";
import stripAnsi from "strip-ansi";
import { describe, expect, it } from "vitest";
import type { Suggestion } from "../../application/autocomplete/Suggestion.ts";
import { AutocompletePopup } from "./AutocompletePopup.tsx";

async function capture(node: React.ReactElement): Promise<string> {
  const stdout = new PassThrough() as unknown as NodeJS.WriteStream & {
    columns: number;
  };
  let buffer = "";
  stdout.columns = 80;
  stdout.write = (chunk: string | Uint8Array): boolean => {
    buffer += chunk.toString();
    return true;
  };
  const instance = render(node, {
    stdout: stdout as unknown as NodeJS.WriteStream,
    exitOnCtrlC: false,
    patchConsole: false,
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
  instance.unmount();
  return stripAnsi(buffer).replace(/\r/g, "");
}

const KW = (label: string): Suggestion => ({ label, kind: "keyword" });
const TBL = (label: string): Suggestion => ({
  label,
  kind: "table",
  detail: "table",
});

describe("AutocompletePopup", () => {
  it("renders the suggestion list when there are matches", async () => {
    const frame = await capture(
      <AutocompletePopup
        suggestions={[KW("SELECT"), KW("FROM"), KW("WHERE")]}
        index={0}
      />,
    );

    expect(frame).toContain("SELECT");
    expect(frame).toContain("FROM");
    expect(frame).toContain("WHERE");
  });

  it("renders the empty state when there are no matches", async () => {
    const frame = await capture(
      <AutocompletePopup suggestions={[]} index={0} />,
    );

    expect(frame).toContain("(no matches)");
    expect(frame).toContain("Esc");
  });

  it("renders a single suggestion without crashing", async () => {
    const frame = await capture(
      <AutocompletePopup suggestions={[KW("SELECT")]} index={0} />,
    );

    expect(frame).toContain("SELECT");
    expect(frame).not.toContain("FROM");
  });

  it("renders table suggestions with the 'table' detail", async () => {
    const frame = await capture(
      <AutocompletePopup
        suggestions={[TBL("users"), KW("UPDATE")]}
        index={0}
      />,
    );

    expect(frame).toContain("users");
    expect(frame).toContain("table");
    expect(frame).toContain("UPDATE");
  });

  it("shows movement/commit/close hints", async () => {
    const frame = await capture(
      <AutocompletePopup suggestions={[KW("SELECT"), KW("SET")]} index={0} />,
    );

    expect(frame).toContain("\u2191\u2193");
    expect(frame).toContain("Enter");
    expect(frame).toContain("Esc");
  });

  it("renders different items at different indices without error", async () => {
    const first = await capture(
      <AutocompletePopup
        suggestions={[KW("SELECT"), KW("SET"), KW("FROM")]}
        index={0}
      />,
    );
    const second = await capture(
      <AutocompletePopup
        suggestions={[KW("SELECT"), KW("SET"), KW("FROM")]}
        index={1}
      />,
    );

    expect(first).toContain("SELECT");
    expect(second).toContain("SET");
  });
});
