export type ParseResult =
  { ok: true; path: string } | { ok: false; error: string };

export function parseExportCommand(line: string): ParseResult {
  const trimmed = line.trim();
  if (!trimmed.startsWith(".")) {
    return { ok: false, error: `unknown command: ${trimmed}` };
  }
  const tokens = trimmed.split(/\s+/);
  const name = tokens[0]?.slice(1) ?? "";
  if (name !== "export") {
    return { ok: false, error: `unknown command: ${trimmed}` };
  }
  if (tokens.length < 2 || tokens[1] === "") {
    return { ok: false, error: "export: missing path" };
  }
  if (tokens.length > 2) {
    return { ok: false, error: "export: too many arguments" };
  }
  return { ok: true, path: tokens[1] };
}
