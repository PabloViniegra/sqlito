const NEEDS_QUOTING = /[",\n\r]/;

export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = typeof value === "string" ? value : String(value);
  if (!NEEDS_QUOTING.test(str)) return str;
  return `"${str.replace(/"/g, '""')}"`;
}
