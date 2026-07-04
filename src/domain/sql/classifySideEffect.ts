const SIDE_EFFECT_KEYWORDS = new Set([
  "VACUUM",
  "REINDEX",
  "ANALYZE",
  "CREATE",
  "DROP",
  "ALTER",
]);

export function classifySideEffect(sql: string): boolean {
  const stripped = sql
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .trimStart();
  const match = stripped.match(/^([A-Za-z]+)/);
  if (!match) return false;
  const keyword = match[1].toUpperCase();
  if (SIDE_EFFECT_KEYWORDS.has(keyword)) return true;
  if (keyword === "PRAGMA") {
    if (/=/.test(stripped)) return true;
    if (/^PRAGMA\s+[A-Za-z_]+\s*\(/i.test(stripped)) return true;
  }
  return false;
}
