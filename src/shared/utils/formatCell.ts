import { Buffer } from "node:buffer";
import cliTruncate from "cli-truncate";

export function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number") return value.toString();
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return value;
  if (Buffer.isBuffer(value)) return "<binary>";
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

export function truncateCell(value: string, maxWidth: number): string {
  if (maxWidth <= 0) return "";
  return cliTruncate(value, maxWidth, { truncationCharacter: "…" });
}
