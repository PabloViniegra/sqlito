const NEEDS_QUOTING = /[",\n\r]/;

export function escapeCsvField<T>(value: T): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (!NEEDS_QUOTING.test(str)) return str;
  return `"${str.replace(/"/g, '""')}"`;
}
