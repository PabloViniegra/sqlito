const READ_KEYWORDS = new Set(["SELECT", "PRAGMA", "EXPLAIN", "WITH"]);
const PRAGMA_FUNC_CALL_WRITERS = new Set(["wal_autocheckpoint"]);

export function isReadOnly(sql: string): boolean {
  const stripped = sql
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .trimStart();
  const match = stripped.match(/^([A-Za-z]+)/);
  if (!match) return false;
  const keyword = match[1].toUpperCase();
  if (!READ_KEYWORDS.has(keyword)) return false;
  if (keyword === "PRAGMA") {
    const funcCall = stripped.match(/^PRAGMA\s+([A-Za-z_]+)\s*\(/i);
    if (funcCall && PRAGMA_FUNC_CALL_WRITERS.has(funcCall[1].toLowerCase())) {
      return false;
    }
    if (/=/.test(stripped)) return false;
  }
  return true;
}
