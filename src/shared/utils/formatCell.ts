import cliTruncate from "cli-truncate";

export function formatCell<T>(value: T): string {
  if (value === null || value === undefined) return "NULL";
  if (value instanceof Uint8Array) return "<binary>";
  if (isSimpleCell(value)) return String(value);
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function isSimpleCell<T>(
  value: T,
): value is T & (string | number | bigint | boolean) {
  return (
    typeof value === "boolean" ||
    typeof value === "bigint" ||
    typeof value === "number" ||
    typeof value === "string"
  );
}

export function truncateCell(value: string, maxWidth: number): string {
  if (maxWidth <= 0) return "";
  return cliTruncate(value, maxWidth, { truncationCharacter: "…" });
}
