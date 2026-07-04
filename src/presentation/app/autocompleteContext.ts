type FromClause = {
  name: string;
  alias?: string;
};

export function parseFromClause(sql: string): FromClause | undefined {
  const stripped = sql
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  const matches = [...stripped.matchAll(/\bFROM\s+([A-Za-z_]\w*)/gi)];
  const last = matches[matches.length - 1];
  const name = last?.[1];
  if (name === undefined) return undefined;
  const after = stripped.slice(last.index + last[0].length);
  const aliasMatch = after.match(/^\s+(?:AS\s+)?([A-Za-z_]\w*)/i);
  const alias = aliasMatch?.[1];
  return alias === undefined ? { name } : { name, alias };
}

export function findReferencedTable(
  prompt: string,
  identifier: string,
): string | undefined {
  const from = parseFromClause(prompt);
  if (from === undefined) return undefined;
  if (from.alias !== undefined && from.alias === identifier) return from.name;
  if (from.name === identifier) return from.name;
  return undefined;
}

type AutocompleteContext = {
  referencedTable?: string;
  precedingToken?: string;
};

type DerivedAutocomplete = {
  prefix: string;
  prefixBase?: string;
  context: AutocompleteContext;
};

export function deriveAutocompleteContext(prompt: string): DerivedAutocomplete {
  const trailing = prompt.match(/\S+$/)?.[0] ?? "";
  const dotIdx = trailing.lastIndexOf(".");
  if (dotIdx >= 0) {
    const id = trailing.slice(0, dotIdx);
    const ref = findReferencedTable(prompt, id);
    if (ref !== undefined) {
      const filter = trailing.slice(dotIdx + 1);
      return {
        prefix: filter,
        prefixBase: `${id}.`,
        context: { referencedTable: ref },
      };
    }
  }
  return { prefix: trailing, context: {} };
}
