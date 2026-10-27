import type {
  BindParams,
  StatementResult,
} from "../../domain/database/Database.ts";
import type { SerializedError } from "./toDatabaseError.ts";

export type WorkerRequest =
  | {
      id: number;
      op: "execute";
      sql: string;
      params: BindParams;
      maxRows: number;
    }
  | {
      id: number;
      op: "exportCsv";
      sql: string;
      params: BindParams;
      dest: string;
    }
  | { id: number; op: "close" };

export type WorkerResults = {
  execute: StatementResult;
  exportCsv: { rowsWritten: number };
  close: null;
};

export type WorkerResult = WorkerResults[keyof WorkerResults];

export type WorkerResponse =
  | { id: number; ok: true; value: WorkerResult }
  | { id: number; ok: false; error: SerializedError };
