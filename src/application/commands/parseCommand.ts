export type ParseResult =
  { ok: true; path: string } | { ok: false; error: string };

type NoArgResult = { ok: true } | { ok: false; error: string };
type SchemaResult = { ok: true; table?: string } | { ok: false; error: string };
type SetResult =
  { ok: true; name: string; raw: string } | { ok: false; error: string };
type UnsetResult = { ok: true; name: string } | { ok: false; error: string };

export type DotCommand =
  | { kind: "export"; path: string }
  | { kind: "tables" }
  | { kind: "schema"; table?: string }
  | { kind: "indexes" }
  | { kind: "help" }
  | { kind: "quit" }
  | { kind: "set"; name: string; raw: string }
  | { kind: "unset"; name: string }
  | { kind: "vars" }
  | { kind: "explain" };

export type DotCommandResult =
  { ok: true; command: DotCommand } | { ok: false; error: string };

function tokenize(line: string): { name: string; args: string[] } | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith(".")) return null;
  const tokens = trimmed.split(/\s+/);
  const name = tokens[0]?.slice(1) ?? "";
  return { name, args: tokens.slice(1) };
}

function unknown(line: string): { ok: false; error: string } {
  return { ok: false, error: `unknown command: ${line.trim()}` };
}

export function parseExportCommand(line: string): ParseResult {
  const parsed = tokenize(line);
  if (parsed === null || parsed.name !== "export") return unknown(line);
  if (parsed.args.length < 1 || parsed.args[0] === "") {
    return { ok: false, error: "export: missing path" };
  }
  if (parsed.args.length > 1) {
    return { ok: false, error: "export: too many arguments" };
  }
  return { ok: true, path: parsed.args[0] };
}

export function parseTablesCommand(line: string): NoArgResult {
  return parseNoArg(line, "tables");
}

export function parseIndexesCommand(line: string): NoArgResult {
  return parseNoArg(line, "indexes");
}

export function parseHelpCommand(line: string): NoArgResult {
  return parseNoArg(line, "help");
}

export function parseQuitCommand(line: string): NoArgResult {
  const parsed = tokenize(line);
  if (parsed === null || (parsed.name !== "quit" && parsed.name !== "exit")) {
    return unknown(line);
  }
  if (parsed.args.length > 0) {
    return { ok: false, error: "quit: too many arguments" };
  }
  return { ok: true };
}

export function parseSchemaCommand(line: string): SchemaResult {
  const parsed = tokenize(line);
  if (parsed === null || parsed.name !== "schema") return unknown(line);
  if (parsed.args.length > 1) {
    return { ok: false, error: "schema: too many arguments" };
  }
  return parsed.args.length === 0
    ? { ok: true }
    : { ok: true, table: parsed.args[0] };
}

export function parseVarsCommand(line: string): NoArgResult {
  return parseNoArg(line, "vars");
}

export function parseExplainCommand(line: string): NoArgResult {
  return parseNoArg(line, "explain");
}

export function parseSetCommand(line: string): SetResult {
  const parsed = tokenize(line);
  if (parsed === null || parsed.name !== "set") return unknown(line);
  if (parsed.args.length < 1) return { ok: false, error: "set: missing name" };
  if (parsed.args.length < 2) return { ok: false, error: "set: missing value" };
  return {
    ok: true,
    name: parsed.args[0],
    raw: parsed.args.slice(1).join(" "),
  };
}

export function parseUnsetCommand(line: string): UnsetResult {
  const parsed = tokenize(line);
  if (parsed === null || parsed.name !== "unset") return unknown(line);
  if (parsed.args.length < 1) {
    return { ok: false, error: "unset: missing name" };
  }
  if (parsed.args.length > 1) {
    return { ok: false, error: "unset: too many arguments" };
  }
  return { ok: true, name: parsed.args[0] };
}

function parseNoArg(line: string, name: string): NoArgResult {
  const parsed = tokenize(line);
  if (parsed === null || parsed.name !== name) return unknown(line);
  if (parsed.args.length > 0) {
    return { ok: false, error: `${name}: too many arguments` };
  }
  return { ok: true };
}

export function parseDotCommand(line: string): DotCommandResult {
  const parsed = tokenize(line);
  if (parsed === null) return unknown(line);
  switch (parsed.name) {
    case "export": {
      const r = parseExportCommand(line);
      return r.ok ? { ok: true, command: { kind: "export", path: r.path } } : r;
    }
    case "tables": {
      const r = parseTablesCommand(line);
      return r.ok ? { ok: true, command: { kind: "tables" } } : r;
    }
    case "schema": {
      const r = parseSchemaCommand(line);
      if (!r.ok) return r;
      return r.table === undefined
        ? { ok: true, command: { kind: "schema" } }
        : { ok: true, command: { kind: "schema", table: r.table } };
    }
    case "indexes": {
      const r = parseIndexesCommand(line);
      return r.ok ? { ok: true, command: { kind: "indexes" } } : r;
    }
    case "help": {
      const r = parseHelpCommand(line);
      return r.ok ? { ok: true, command: { kind: "help" } } : r;
    }
    case "quit":
    case "exit": {
      const r = parseQuitCommand(line);
      return r.ok ? { ok: true, command: { kind: "quit" } } : r;
    }
    case "set": {
      const r = parseSetCommand(line);
      return r.ok
        ? { ok: true, command: { kind: "set", name: r.name, raw: r.raw } }
        : r;
    }
    case "unset": {
      const r = parseUnsetCommand(line);
      return r.ok ? { ok: true, command: { kind: "unset", name: r.name } } : r;
    }
    case "vars": {
      const r = parseVarsCommand(line);
      return r.ok ? { ok: true, command: { kind: "vars" } } : r;
    }
    case "explain": {
      const r = parseExplainCommand(line);
      return r.ok ? { ok: true, command: { kind: "explain" } } : r;
    }
    default:
      return unknown(line);
  }
}
