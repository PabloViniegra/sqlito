import { DatabaseError } from "../../domain/database/Database.ts";

export type SerializedError = { message: string; code?: string };

export function serializeError<T>(err: T): SerializedError {
  if (!(err instanceof Error)) return { message: String(err) };
  return "code" in err && typeof err.code === "string"
    ? { message: err.message, code: err.code }
    : { message: err.message };
}

export function toDatabaseError<T>(err: T): DatabaseError {
  if (err instanceof DatabaseError) return err;
  const { message, code } = serializeError(err);
  return new DatabaseError(message, code);
}
