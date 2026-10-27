const NEEDS_QUOTING = /[",\n\r]/;
const UTF8 = new TextDecoder();

export function escapeCsvField<T>(value: T): string {
  if (value === null || value === undefined) return "";
  const str = value instanceof Uint8Array ? UTF8.decode(value) : String(value);
  if (!NEEDS_QUOTING.test(str)) return str;
  return `"${str.replace(/"/g, '""')}"`;
}
