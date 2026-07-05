import { describe, expect, it } from "vitest";
import { resolveXdgFavoritesPath } from "./resolveXdgFavoritesPath.ts";

describe("resolveXdgFavoritesPath", () => {
  it("uses XDG_DATA_HOME when set", () => {
    expect(resolveXdgFavoritesPath({ XDG_DATA_HOME: "/custom/data" })).toBe(
      "/custom/data/sqlito/favorites.json",
    );
  });

  it("falls back to ~/.local/share/sqlito/favorites.json when XDG_DATA_HOME is unset", () => {
    const path = resolveXdgFavoritesPath({});
    expect(path).toMatch(/\.local[/\\]share[/\\]sqlito[/\\]favorites\.json$/);
  });

  it("treats empty XDG_DATA_HOME as unset", () => {
    const path = resolveXdgFavoritesPath({ XDG_DATA_HOME: "" });
    expect(path).toMatch(/\.local[/\\]share[/\\]sqlito[/\\]favorites\.json$/);
  });
});
