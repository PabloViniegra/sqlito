import { SqliteEngine } from "./SqliteEngine.ts";
import { serializeError, type SerializedError } from "./toDatabaseError.ts";
import type {
  WorkerRequest,
  WorkerResponse,
  WorkerResult,
} from "./workerProtocol.ts";

// WorkerDatabase forks this module with the database path and readonly flag.
const path = process.argv[2] ?? "";
const readonly = process.argv[3] === "true";

let engine: SqliteEngine | undefined;
let openError: SerializedError | undefined;
try {
  engine = new SqliteEngine(path, { readonly });
} catch (err) {
  openError = serializeError(err);
}

function handle(engine: SqliteEngine, request: WorkerRequest): WorkerResult {
  switch (request.op) {
    case "execute":
      return engine.execute(request.sql, request.params, request.maxRows);
    case "exportCsv":
      return {
        rowsWritten: engine.exportCsv(
          request.sql,
          request.params,
          request.dest,
        ),
      };
    case "close":
      engine.close();
      return null;
  }
}

process.on("message", (request: WorkerRequest) => {
  let response: WorkerResponse;
  if (engine === undefined) {
    response = {
      id: request.id,
      ok: false,
      error: openError ?? { message: "database is not open" },
    };
  } else {
    try {
      response = { id: request.id, ok: true, value: handle(engine, request) };
    } catch (err) {
      response = { id: request.id, ok: false, error: serializeError(err) };
    }
  }
  process.send?.(response);
});
