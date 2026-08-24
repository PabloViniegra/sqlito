export type ParseResult =
  { ok: true; path: string } | { ok: false; error: string };

type NoArgResult = { ok: true } | { ok: false; error: string };
type SchemaResult = { ok: true; table?: string } | { ok: false; error: string };
type SetResult =
  { ok: true; name: string; raw: string } | { ok: false; error: string };
type UnsetResult = { ok: true; name: string } | { ok: false; error: string };
type NamedResult = { ok: true; name: string } | { ok: false; error: string };

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
  | { kind: "explain" }
  | { kind: "save"; name: string }
  | { kind: "favorites" }
  | { kind: "run"; name: string }
  | { kind: "forget"; name: string }
  | { kind: "theme"; name: string }
  | { kind: "copy" };

export type DotCommandResult =
  { ok: true; command: DotCommand } | { ok: false; error: string };

type Args = readonly string[];
type Validator = (args: Args) =>
  | { ok: true; command: DotCommand }
  | { ok: false; error: string };

const validators: Record<string, Validator> = {
  export(args) {
    if (args.length < 1 || args[0] === "") {
      return { ok: false, error: "export: missing path" };
    }
    if (args.length > 1) return { ok: false, error: "export: too many arguments" };
    return { ok: true, command: { kind: "export", path: args[0]! } };
  },
  tables(args) {
    if (args.length > 0) return { ok: false, error: "tables: too many arguments" };
    return { ok: true, command: { kind: "tables" } };
  },
  schema(args) {
    if (args.length > 1) return { ok: false, error: "schema: too many arguments" };
    return {
      ok: true,
      command: args[0] === undefined ? { kind: "schema" } : { kind: "schema", table: args[0] },
    };
  },
  indexes(args) {
    if (args.length > 0) return { ok: false, error: "indexes: too many arguments" };
    return { ok: true, command: { kind: "indexes" } };
  },
  help(args) {
    if (args.length > 0) return { ok: false, error: "help: too many arguments" };
    return { ok: true, command: { kind: "help" } };
  },
  quit(args) {
    if (args.length > 0) return { ok: false, error: "quit: too many arguments" };
    return { ok: true, command: { kind: "quit" } };
  },
  set(args) {
    if (args.length < 1) return { ok: false, error: "set: missing name" };
    if (args.length < 2) return { ok: false, error: "set: missing value" };
    return {
      ok: true,
      command: { kind: "set", name: args[0]!, raw: args.slice(1).join(" ") },
    };
  },
  unset(args) {
    if (args.length < 1) return { ok: false, error: "unset: missing name" };
    if (args.length > 1) return { ok: false, error: "unset: too many arguments" };
    return { ok: true, command: { kind: "unset", name: args[0]! } };
  },
  vars(args) {
    if (args.length > 0) return { ok: false, error: "vars: too many arguments" };
    return { ok: true, command: { kind: "vars" } };
  },
  explain(args) {
    if (args.length > 0) return { ok: false, error: "explain: too many arguments" };
    return { ok: true, command: { kind: "explain" } };
  },
  save(args) {
    if (args.length < 1) return { ok: false, error: "save: missing name" };
    if (args.length > 1) return { ok: false, error: "save: too many arguments" };
    return { ok: true, command: { kind: "save", name: args[0]! } };
  },
  favorites(args) {
    if (args.length > 0) return { ok: false, error: "favorites: too many arguments" };
    return { ok: true, command: { kind: "favorites" } };
  },
  run(args) {
    if (args.length < 1) return { ok: false, error: "run: missing name" };
    if (args.length > 1) return { ok: false, error: "run: too many arguments" };
    return { ok: true, command: { kind: "run", name: args[0]! } };
  },
  forget(args) {
    if (args.length < 1) return { ok: false, error: "forget: missing name" };
    if (args.length > 1) return { ok: false, error: "forget: too many arguments" };
    return { ok: true, command: { kind: "forget", name: args[0]! } };
  },
  theme(args) {
    if (args.length < 1) return { ok: false, error: "theme: missing name" };
    if (args.length > 1) return { ok: false, error: "theme: too many arguments" };
    return { ok: true, command: { kind: "theme", name: args[0]! } };
  },
  copy(args) {
    if (args.length > 0) return { ok: false, error: "copy: too many arguments" };
    return { ok: true, command: { kind: "copy" } };
  },
};

const ALIASES: Record<string, string> = { exit: "quit" };

function tokenize(line: string): { name: string; args: Args } | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith(".")) return null;
  const tokens = trimmed.split(/\s+/);
  return { name: tokens[0]?.slice(1) ?? "", args: tokens.slice(1) };
}

type UnknownResult = { ok: false; error: string };

function unknown(line: string): UnknownResult {
  return { ok: false, error: `unknown command: ${line.trim()}` };
}

function runValidator(
  line: string,
  expectedNames: readonly string[],
):
  | { ok: true; command: DotCommand }
  | { ok: false; error: string } {
  const tok = tokenize(line);
  if (tok === null) return unknown(line);
  if (!expectedNames.includes(tok.name) && !expectedNames.includes(ALIASES[tok.name] ?? "")) {
    return unknown(line);
  }
  const resolvedName = ALIASES[tok.name] ?? tok.name;
  const validator = validators[resolvedName];
  if (validator === undefined) return unknown(line);
  return validator(tok.args);
}

export function parseDotCommand(line: string): DotCommandResult {
  const tok = tokenize(line);
  if (tok === null) return unknown(line);
  const resolvedName = ALIASES[tok.name] ?? tok.name;
  const validator = validators[resolvedName];
  if (validator === undefined) return unknown(line);
  return validator(tok.args);
}

export function parseExportCommand(line: string): ParseResult {
  const r = runValidator(line, ["export"]);
  if (!r.ok) return r;
  if (r.command.kind !== "export") return unknown(line);
  return { ok: true, path: r.command.path };
}

export function parseTablesCommand(line: string): NoArgResult {
  const r = runValidator(line, ["tables"]);
  return r.ok && r.command.kind === "tables" ? { ok: true } : r;
}

export function parseIndexesCommand(line: string): NoArgResult {
  const r = runValidator(line, ["indexes"]);
  return r.ok && r.command.kind === "indexes" ? { ok: true } : r;
}

export function parseHelpCommand(line: string): NoArgResult {
  const r = runValidator(line, ["help"]);
  return r.ok && r.command.kind === "help" ? { ok: true } : r;
}

export function parseQuitCommand(line: string): NoArgResult {
  const r = runValidator(line, ["quit", "exit"]);
  return r.ok && r.command.kind === "quit" ? { ok: true } : r;
}

export function parseSchemaCommand(line: string): SchemaResult {
  const r = runValidator(line, ["schema"]);
  if (!r.ok) return r;
  if (r.command.kind !== "schema") return unknown(line);
  return r.command.table === undefined
    ? { ok: true }
    : { ok: true, table: r.command.table };
}

export function parseVarsCommand(line: string): NoArgResult {
  const r = runValidator(line, ["vars"]);
  return r.ok && r.command.kind === "vars" ? { ok: true } : r;
}

export function parseExplainCommand(line: string): NoArgResult {
  const r = runValidator(line, ["explain"]);
  return r.ok && r.command.kind === "explain" ? { ok: true } : r;
}

export function parseFavoritesCommand(line: string): NoArgResult {
  const r = runValidator(line, ["favorites"]);
  return r.ok && r.command.kind === "favorites" ? { ok: true } : r;
}

export function parseCopyCommand(line: string): NoArgResult {
  const r = runValidator(line, ["copy"]);
  return r.ok && r.command.kind === "copy" ? { ok: true } : r;
}

export function parseSaveCommand(line: string): NamedResult {
  const r = runValidator(line, ["save"]);
  if (!r.ok) return r;
  if (r.command.kind !== "save") return unknown(line);
  return { ok: true, name: r.command.name };
}

export function parseRunCommand(line: string): NamedResult {
  const r = runValidator(line, ["run"]);
  if (!r.ok) return r;
  if (r.command.kind !== "run") return unknown(line);
  return { ok: true, name: r.command.name };
}

export function parseForgetCommand(line: string): NamedResult {
  const r = runValidator(line, ["forget"]);
  if (!r.ok) return r;
  if (r.command.kind !== "forget") return unknown(line);
  return { ok: true, name: r.command.name };
}

export function parseThemeCommand(line: string): NamedResult {
  const r = runValidator(line, ["theme"]);
  if (!r.ok) return r;
  if (r.command.kind !== "theme") return unknown(line);
  return { ok: true, name: r.command.name };
}

export function parseSetCommand(line: string): SetResult {
  const r = runValidator(line, ["set"]);
  if (!r.ok) return r;
  if (r.command.kind !== "set") return unknown(line);
  return { ok: true, name: r.command.name, raw: r.command.raw };
}

export function parseUnsetCommand(line: string): UnsetResult {
  const r = runValidator(line, ["unset"]);
  if (!r.ok) return r;
  if (r.command.kind !== "unset") return unknown(line);
  return { ok: true, name: r.command.name };
}
