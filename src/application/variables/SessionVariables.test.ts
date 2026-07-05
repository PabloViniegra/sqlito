import { describe, expect, it } from "vitest";
import { InvalidVariableName, SessionVariables } from "./SessionVariables.ts";

describe("SessionVariables", () => {
  describe("type detection at set time", () => {
    it("stores an integer-looking value as a number", () => {
      const vars = new SessionVariables();
      vars.set("n", "100");
      expect(vars.entries()).toEqual({ n: 100 });
    });

    it("stores a float-looking value as a number", () => {
      const vars = new SessionVariables();
      vars.set("rate", "1.5");
      expect(vars.entries()).toEqual({ rate: 1.5 });
    });

    it("stores 'true'/'false' as booleans", () => {
      const vars = new SessionVariables();
      vars.set("flag", "true");
      vars.set("off", "false");
      expect(vars.entries()).toEqual({ flag: true, off: false });
    });

    it("stores 'null' as null", () => {
      const vars = new SessionVariables();
      vars.set("x", "null");
      expect(vars.entries()).toEqual({ x: null });
    });

    it("stores everything else as a string", () => {
      const vars = new SessionVariables();
      vars.set("greeting", "hello world");
      expect(vars.entries()).toEqual({ greeting: "hello world" });
    });

    it("treats an empty string as a string, not a number", () => {
      const vars = new SessionVariables();
      vars.set("blank", "");
      expect(vars.entries()).toEqual({ blank: "" });
    });
  });

  describe("name validation", () => {
    it("throws InvalidVariableName for a leading digit", () => {
      const vars = new SessionVariables();
      expect(() => vars.set("1bad", "x")).toThrow(InvalidVariableName);
    });

    it("throws InvalidVariableName for a dash", () => {
      const vars = new SessionVariables();
      expect(() => vars.set("has-dash", "x")).toThrow(InvalidVariableName);
    });

    it("accepts underscores and mixed case", () => {
      const vars = new SessionVariables();
      vars.set("_myVar1", "1");
      expect(vars.entries()).toEqual({ _myVar1: 1 });
    });
  });

  describe("unset", () => {
    it("returns false for a missing variable", () => {
      const vars = new SessionVariables();
      expect(vars.unset("missing")).toBe(false);
    });

    it("returns true and removes an existing variable", () => {
      const vars = new SessionVariables();
      vars.set("n", "1");
      expect(vars.unset("n")).toBe(true);
      expect(vars.entries()).toEqual({});
    });
  });

  describe("entries snapshot", () => {
    it("returns a plain object that does not leak later mutations", () => {
      const vars = new SessionVariables();
      vars.set("a", "1");
      const snapshot = vars.entries();
      vars.set("b", "2");
      expect(snapshot).toEqual({ a: 1 });
    });
  });

  describe("list", () => {
    it("returns [name, raw-input] pairs in insertion order", () => {
      const vars = new SessionVariables();
      vars.set("b", "2");
      vars.set("a", "hello");
      expect(vars.list()).toEqual([
        ["b", "2"],
        ["a", "hello"],
      ]);
    });

    it("keeps position when a variable is re-set", () => {
      const vars = new SessionVariables();
      vars.set("a", "1");
      vars.set("b", "2");
      vars.set("a", "9");
      expect(vars.list()).toEqual([
        ["a", "9"],
        ["b", "2"],
      ]);
    });
  });
});
