import { fork, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  DatabaseError,
  QueryCancelled,
  type BindParams,
  type Database,
  type ExecuteOptions,
  type StatementResult,
} from "../../domain/database/Database.ts";
import type {
  WorkerRequest,
  WorkerResponse,
  WorkerResult,
  WorkerResults,
} from "./workerProtocol.ts";

// Under tsx/vitest this module is the .ts source; in the tsup bundle it is
// dist/cli.js and the worker is emitted next to it as a separate entry.
const FROM_SOURCE = import.meta.url.endsWith(".ts");
const WORKER_PATH = fileURLToPath(
  new URL(
    FROM_SOURCE ? "./sqliteWorker.ts" : "./sqliteWorker.js",
    import.meta.url,
  ),
);
// the parent's execArgv carries vitest/tsx internals; the source worker only
// needs a TS loader, which Node < 22.18 lacks natively
const WORKER_EXEC_ARGV = FROM_SOURCE ? ["--import", "tsx"] : [];

type Pending = {
  resolve: (value: WorkerResult) => void;
  reject: (error: Error) => void;
};

type RequestFor<Op extends WorkerRequest["op"]> = Omit<
  Extract<WorkerRequest, { op: Op }>,
  "id"
>;

/**
 * Runs SQLite in a child process so the UI stays responsive and a running
 * statement can be cancelled. better-sqlite3 has no sqlite3_interrupt and a
 * worker thread blocked in native code can't be terminated, so cancelling
 * kills the process and the next request opens a fresh connection.
 */
export class WorkerDatabase implements Database {
  private readonly path: string;
  private readonly readonly: boolean;
  private worker: ChildProcess | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private closed = false;

  constructor(path: string, { readonly = false } = {}) {
    this.path = path;
    this.readonly = readonly;
    this.worker = this.spawn();
  }

  execute(
    sql: string,
    params: BindParams = {},
    options: ExecuteOptions = {},
  ): Promise<StatementResult> {
    return this.request<"execute">({
      op: "execute",
      sql,
      params,
      maxRows: options.maxRows ?? Infinity,
    });
  }

  exportCsv(
    sql: string,
    params: BindParams,
    dest: string,
  ): Promise<{ rowsWritten: number }> {
    return this.request<"exportCsv">({ op: "exportCsv", sql, params, dest });
  }

  cancel(): boolean {
    if (this.pending.size === 0) return false;
    this.killWorker();
    this.failAll(new QueryCancelled());
    if (!this.closed) this.worker = this.spawn();
    return true;
  }

  async close(): Promise<void> {
    if (this.closed) return;
    if (this.worker !== null && this.pending.size === 0) {
      await this.request<"close">({ op: "close" }).catch(() => undefined);
    }
    this.closed = true;
    this.killWorker();
    this.failAll(new DatabaseError("database is closed"));
  }

  private spawn(): ChildProcess {
    const child = fork(WORKER_PATH, [this.path, String(this.readonly)], {
      // advanced serialization keeps bigint, Uint8Array and Infinity intact
      serialization: "advanced",
      stdio: ["ignore", "ignore", "ignore", "ipc"],
      execArgv: WORKER_EXEC_ARGV,
    });
    child.on("message", (response: WorkerResponse) => this.settle(response));
    child.on("error", (err) => {
      if (this.worker === child) this.failAll(new DatabaseError(err.message));
    });
    child.on("exit", () => {
      if (this.worker !== child) return;
      this.worker = null;
      this.failAll(new DatabaseError("database worker exited unexpectedly"));
    });
    holdProcessOpen(child, false);
    return child;
  }

  private killWorker(): void {
    const child = this.worker;
    if (child === null) return;
    this.worker = null;
    child.removeAllListeners();
    child.on("error", () => {});
    child.kill("SIGKILL");
  }

  private request<Op extends WorkerRequest["op"]>(
    message: RequestFor<Op>,
  ): Promise<WorkerResults[Op]> {
    if (this.closed) {
      return Promise.reject(new DatabaseError("database is closed"));
    }
    const child = (this.worker ??= this.spawn());
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      // SAFETY: sqliteWorker answers each op with WorkerResults[op] under the same id.
      const settle = resolve as (value: WorkerResult) => void;
      this.pending.set(id, { resolve: settle, reject });
      holdProcessOpen(child, true);
      // SAFETY: re-attaching the id to a request variant keeps its discriminant.
      child.send({ ...message, id } as WorkerRequest);
    });
  }

  private settle(response: WorkerResponse): void {
    const pending = this.pending.get(response.id);
    if (pending === undefined) return;
    this.pending.delete(response.id);
    if (this.pending.size === 0 && this.worker !== null) {
      holdProcessOpen(this.worker, false);
    }
    if (response.ok) pending.resolve(response.value);
    else
      pending.reject(
        new DatabaseError(response.error.message, response.error.code),
      );
  }

  private failAll(error: Error): void {
    const entries = [...this.pending.values()];
    this.pending.clear();
    for (const pending of entries) pending.reject(error);
  }
}

// An idle worker must not keep the parent alive; one with requests in flight must.
function holdProcessOpen(child: ChildProcess, hold: boolean): void {
  if (hold) {
    child.ref();
    child.channel?.ref();
  } else {
    child.unref();
    child.channel?.unref();
  }
}
