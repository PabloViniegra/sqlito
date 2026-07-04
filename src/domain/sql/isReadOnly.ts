const READ_KEYWORDS = new Set(["SELECT", "PRAGMA", "EXPLAIN", "WITH"]);

export function isReadOnly(sql: string): boolean {
  const stripped = sql
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .trimStart();
  const match = stripped.match(/^([A-Za-z]+)/);
  if (!match) return false;
  const keyword = match[1].toUpperCase();
  if (!READ_KEYWORDS.has(keyword)) return false;
  if (keyword === "PRAGMA" && /=/.test(stripped)) return false;
  return true;
}
