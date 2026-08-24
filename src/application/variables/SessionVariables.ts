const VALID_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export class InvalidVariableName extends Error {
  constructor(name: string) {
    super(`invalid variable name: ${name}`);
    this.name = "InvalidVariableName";
  }
}

export type VariableValue = string | number | boolean | null;

type Entry = { raw: string; value: VariableValue };

export class SessionVariables {
  private readonly store = new Map<string, Entry>();

  set(name: string, raw: string): void {
    if (!VALID_NAME.test(name)) throw new InvalidVariableName(name);
    this.store.set(name, { raw, value: detectValue(raw) });
  }

  unset(name: string): boolean {
    return this.store.delete(name);
  }

  entries() {
    const snapshot: Record<string, VariableValue> = {};
    for (const [name, entry] of this.store) snapshot[name] = entry.value;
    return snapshot;
  }

  list(): readonly [string, string][] {
    return [...this.store].map(([name, entry]) => [name, entry.raw]);
  }
}

function detectValue(raw: string): VariableValue {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null") return null;
  if (raw !== "" && !Number.isNaN(Number(raw))) return Number(raw);
  return raw;
}