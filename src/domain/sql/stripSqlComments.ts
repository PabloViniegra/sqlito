const LINE_COMMENT = /--[^\n]*/g;
const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;

export function stripSqlComments(sql: string): string {
  return sql.replace(LINE_COMMENT, "").replace(BLOCK_COMMENT, "");
}
