import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveXdgConfigPath } from "./resolveXdgConfigPath.ts";

describe("resolveXdgConfigPath", () => {
  it("uses XDG_CONFIG_HOME when set", () => {
    expect(resolveXdgConfigPath({ XDG_CONFIG_HOME: "/custom/config" })).toBe(
      "/custom/config/sqlito/config.json",
    );
  });

  it("falls back to ~/.config/sqlito/config.json", () => {
    expect(resolveXdgConfigPath({ XDG_CONFIG_HOME: undefined })).toBe(
      join(homedir(), ".config", "sqlito", "config.json"),
    );
  });

  it("falls back when XDG_CONFIG_HOME is the empty string", () => {
    expect(resolveXdgConfigPath({ XDG_CONFIG_HOME: "" })).toBe(
      join(homedir(), ".config", "sqlito", "config.json"),
    );
  });
});
