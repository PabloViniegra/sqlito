import { describe, expect, it } from "vitest";
import { escapeCsvField } from "./escapeCsvField.ts";

describe("escapeCsvField", () => {
  it("returns the raw string for a plain value", () => {
    expect(escapeCsvField("hello")).toBe("hello");
  });

  it("returns empty string for null", () => {
    expect(escapeCsvField(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(escapeCsvField(undefined)).toBe("");
  });

  it("returns empty string for an empty string", () => {
    expect(escapeCsvField("")).toBe("");
  });

  it("quotes and escapes a value containing a comma", () => {
    expect(escapeCsvField("a,b")).toBe('"a,b"');
  });

  it("quotes and escapes a value containing a double quote", () => {
    expect(escapeCsvField('he said "hi"')).toBe('"he said ""hi"""');
  });

  it("quotes a value containing an LF newline", () => {
    expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
  });

  it("quotes a value containing a CRLF", () => {
    expect(escapeCsvField("line1\r\nline2")).toBe('"line1\r\nline2"');
  });

  it("quotes a value containing a bare CR", () => {
    expect(escapeCsvField("a\rb")).toBe('"a\rb"');
  });

  it("stringifies a number", () => {
    expect(escapeCsvField(42)).toBe("42");
  });

  it("stringifies a float", () => {
    expect(escapeCsvField(3.14)).toBe("3.14");
  });

  it("stringifies a boolean", () => {
    expect(escapeCsvField(true)).toBe("true");
    expect(escapeCsvField(false)).toBe("false");
  });

  it("stringifies a BigInt", () => {
    expect(escapeCsvField(10n)).toBe("10");
  });

  it("passes unicode through unchanged", () => {
    expect(escapeCsvField("café 漢字 🚀")).toBe("café 漢字 🚀");
  });

  it("quotes unicode that contains a comma", () => {
    expect(escapeCsvField("café, 漢字")).toBe('"café, 漢字"');
  });

  it("decodes a blob as UTF-8 whether it is a Buffer or a cloned Uint8Array", () => {
    expect(escapeCsvField(Buffer.from("a,b"))).toBe('"a,b"');
    expect(escapeCsvField(new Uint8Array([104, 105]))).toBe("hi");
  });
});
