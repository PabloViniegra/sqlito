import { describe, expect, it } from "vitest";
import { NoTabularOutcome, renderCsv } from "./renderCsv.ts";

describe("renderCsv", () => {
  it("renders a single-column single-row outcome with LF line endings", () => {
    expect(renderCsv(["a"], [[1]])).toBe("a\n1\n");
  });

  it("renders headers and rows with mixed primitive types", () => {
    expect(
      renderCsv(
        ["id", "name", "score"],
        [
          [1, "Ada", 9.5],
          [2, "Lin", null],
          [3, "Mia", true],
        ],
      ),
    ).toBe("id,name,score\n1,Ada,9.5\n2,Lin,\n3,Mia,true\n");
  });

  it("quotes fields containing comma, quote, newline per RFC 4180", () => {
    expect(
      renderCsv(
        ["a", "b", "c"],
        [["hello, world", 'he said "hi"', "line1\nline2"]],
      ),
    ).toBe('a,b,c\n"hello, world","he said ""hi""","line1\nline2"\n');
  });

  it("renders CRLF-containing fields with embedded CRLF intact (no extra quoting)", () => {
    expect(renderCsv(["v"], [["a\r\nb"]])).toBe('v\n"a\r\nb"\n');
  });

  it("renders unicode unchanged and quotes when needed", () => {
    expect(renderCsv(["name"], [["café, 漢字 🚀"]])).toBe(
      'name\n"café, 漢字 🚀"\n',
    );
  });

  it("renders header-only output when there are no rows", () => {
    expect(renderCsv(["a", "b"], [])).toBe("a,b\n");
  });

  it("does not emit a BOM character", () => {
    expect(renderCsv(["a"], [["x"]]).charCodeAt(0)).not.toBe(0xfeff);
  });
});

describe("NoTabularOutcome", () => {
  it("reports the export action in its message", () => {
    expect(new NoTabularOutcome("export").message).toBe(
      "No tabular result to export",
    );
  });

  it("reports the copy action in its message", () => {
    expect(new NoTabularOutcome("copy").message).toBe(
      "No tabular result to copy",
    );
  });

  it("sets its error name", () => {
    expect(new NoTabularOutcome("export").name).toBe("NoTabularOutcome");
  });
});
