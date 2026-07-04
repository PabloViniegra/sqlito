export function isReadOnly(sql: string): boolean {
  const stripped = sql
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trimStart();
  const match = stripped.match(/^([A-Za-z]+)/);
  if (!match) return false;
  const keyword = match[1].toUpperCase();
  return keyword === 'SELECT' || keyword === 'PRAGMA' || keyword === 'EXPLAIN' || keyword === 'WITH';
}