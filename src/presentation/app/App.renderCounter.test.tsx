import BetterSqlite3 from "better-sqlite3";
import { PassThrough } from "node:stream";
import { render } from "ink";
import { describe, expect, it, vi } from "vitest";

const counters = vi.hoisted(() => ({
  header: 0,
  statusBar: 0,
  resultsTable: 0,
  prompt: 0,
}));

vi.mock("../components/Header.tsx", async () => {
  const React = await import("react");
  const actual = await vi.importActual<
    typeof import("../components/Header.tsx")
  >("../components/Header.tsx");
  type HeaderProps = React.ComponentProps<typeof actual.Header>;
  function Stub(props: HeaderProps) {
    counters.header += 1;
    return React.createElement(actual.Header, props);
  }
  return { Header: React.memo(Stub) };
});

vi.mock("../components/StatusBar.tsx", async () => {
  const React = await import("react");
  const actual = await vi.importActual<
    typeof import("../components/StatusBar.tsx")
  >("../components/StatusBar.tsx");
  type StatusBarProps = React.ComponentProps<typeof actual.StatusBar>;
  function Stub(props: StatusBarProps) {
    counters.statusBar += 1;
    return React.createElement(actual.StatusBar, props);
  }
  return { StatusBar: React.memo(Stub) };
});

vi.mock("../components/ResultsTable.tsx", async () => {
  const React = await import("react");
  const actual = await vi.importActual<
    typeof import("../components/ResultsTable.tsx")
  >("../components/ResultsTable.tsx");
  type ResultsTableProps = React.ComponentProps<typeof actual.ResultsTable>;
  function Stub(props: ResultsTableProps) {
    counters.resultsTable += 1;
    return React.createElement(actual.ResultsTable, props);
  }
  return { ResultsTable: React.memo(Stub) };
});

vi.mock("../components/Prompt.tsx", async () => {
  const React = await import("react");
  const actual = await vi.importActual<
    typeof import("../components/Prompt.tsx")
  >("../components/Prompt.tsx");
  type PromptProps = React.ComponentProps<typeof actual.Prompt>;
  function Stub(props: PromptProps) {
    counters.prompt += 1;
    return React.createElement(actual.Prompt, props);
  }
  return { Prompt: React.memo(Stub) };
});

import { App } from "./App.tsx";
import { BetterSqliteDatabase } from "../../infrastructure/sqlite/BetterSqliteDatabase.ts";
import { SqliteSchemaRepository } from "../../infrastructure/sqlite/SqliteSchemaRepository.ts";

type FakeStdout = NodeJS.WriteStream & {
  isTTY: boolean;
  columns: number;
  rows: number;
  buffer: string;
};

function fakeStdout(columns: number, rows: number): FakeStdout {
  // SAFETY: PassThrough is duck-typed with NodeJS.WriteStream at runtime; this test fixture mutates isTTY/columns/rows/buffer/write before Ink consumes it.
  const stream = new PassThrough() as unknown as FakeStdout;
  stream.isTTY = true;
  stream.columns = columns;
  stream.rows = rows;
  stream.buffer = "";
  stream.write = (chunk: string | Uint8Array): boolean => {
    stream.buffer += chunk.toString();
    return true;
  };
  return stream;
}

type FakeStdin = NodeJS.ReadStream & {
  isTTY: boolean;
  setRawMode: (mode: boolean) => FakeStdin;
  ref: () => FakeStdin;
  unref: () => FakeStdin;
};

function fakeStdin(): FakeStdin {
  // SAFETY: PassThrough is duck-typed with NodeJS.ReadStream at runtime; this test fixture mutates isTTY/setRawMode/ref/unref before Ink consumes it.
  const stream = new PassThrough() as unknown as FakeStdin;
  stream.isTTY = true;
  stream.setRawMode = () => stream;
  stream.ref = () => stream;
  stream.unref = () => stream;
  return stream;
}

async function waitForCounterStable(
  get: () => number,
  stableMs = 80,
  timeoutMs = 500,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let last = get();
  let stableSince = Date.now();
  while (Date.now() < deadline) {
    await new Promise<void>((r) => setTimeout(r, 20));
    const next = get();
    if (next !== last) {
      last = next;
      stableSince = Date.now();
    } else if (Date.now() - stableSince >= stableMs) {
      return;
    }
  }
}

async function mountApp(): Promise<{
  send: (data: string) => Promise<void>;
  reset: () => void;
  waitForStable: (timeoutMs?: number) => Promise<void>;
  cleanup: () => Promise<void>;
}> {
  const driver = new BetterSqlite3(":memory:");
  const db = BetterSqliteDatabase.withDriver(driver);
  const schema = new SqliteSchemaRepository(driver);
  const stdout = fakeStdout(80, 24);
  const stdin = fakeStdin();
  // SAFETY: Ink's render accepts Node streams; FakeStdin/FakeStdout satisfy that surface at runtime after the fixture mutations above.
  const instance = render(<App db={db} schema={schema} dbPath=":memory:" />, {
    stdin: stdin as unknown as NodeJS.ReadStream,
    stdout: stdout as unknown as NodeJS.WriteStream,
    exitOnCtrlC: false,
    patchConsole: false,
  });
  await new Promise<void>((r) => setTimeout(r, 60));
  return {
    async send(data: string) {
      stdin.write(data);
      await new Promise<void>((r) => setTimeout(r, 60));
    },
    reset() {
      counters.header = 0;
      counters.statusBar = 0;
      counters.resultsTable = 0;
      counters.prompt = 0;
    },
    waitForStable(timeoutMs) {
      return waitForCounterStable(
        () => counters.resultsTable,
        80,
        timeoutMs,
      );
    },
    async cleanup() {
      instance.unmount();
      await new Promise<void>((r) => setImmediate(r));
      driver.close();
    },
  };
}

describe("App render-counter (memoization guard)", () => {
  it("Header does not re-render when typing 100 chars", async () => {
    const app = await mountApp();
    try {
      app.reset();
      await app.send("a".repeat(100));
      expect(counters.header).toBe(0);
    } finally {
      await app.cleanup();
    }
  });

  it("StatusBar does not re-render when typing 100 chars", async () => {
    const app = await mountApp();
    try {
      app.reset();
      await app.send("a".repeat(100));
      expect(counters.statusBar).toBe(0);
    } finally {
      await app.cleanup();
    }
  });

  it("ResultsTable re-renders when a new past query is recorded", async () => {
    const app = await mountApp();
    try {
      app.reset();
      await app.send("SELECT 1");
      await app.send("\r");
      await app.waitForStable();
      // The expected count is 1 (one render on submit/recordQuery). The
      // count may briefly exceed 1 if an async history save fails and
      // dispatches setStatus, which forces a layout recalculation; under
      // normal conditions this does not happen within the stability window.
      expect(counters.resultsTable).toBe(1);
    } finally {
      await app.cleanup();
    }
  });

  it("Prompt does not re-render when the command palette opens", async () => {
    const app = await mountApp();
    try {
      app.reset();
      await app.send("\x10");
      expect(counters.prompt).toBe(0);
    } finally {
      await app.cleanup();
    }
  });
});

describe("App render-counter (memoization guard) — real component memoization", () => {
  it("Header is wrapped in React.memo", async () => {
    const actual = await vi.importActual<
      typeof import("../components/Header.tsx")
    >("../components/Header.tsx");
    // SAFETY: React.memo-wrapped components carry a `$$typeof` symbol whose `.description` is "react.memo"; we narrow the type to read it.
    expect((actual.Header as { $$typeof: symbol }).$$typeof.description).toBe(
      "react.memo",
    );
  });

  it("StatusBar is wrapped in React.memo", async () => {
    const actual = await vi.importActual<
      typeof import("../components/StatusBar.tsx")
    >("../components/StatusBar.tsx");
    expect(
      // SAFETY: see Header test above; same React.memo introspection.
      (actual.StatusBar as { $$typeof: symbol }).$$typeof.description,
    ).toBe("react.memo");
  });

  it("Prompt is wrapped in React.memo", async () => {
    const actual = await vi.importActual<
      typeof import("../components/Prompt.tsx")
    >("../components/Prompt.tsx");
    // SAFETY: see Header test above; same React.memo introspection.
    expect((actual.Prompt as { $$typeof: symbol }).$$typeof.description).toBe(
      "react.memo",
    );
  });

  it("ResultsTable is wrapped in React.memo", async () => {
    const actual = await vi.importActual<
      typeof import("../components/ResultsTable.tsx")
    >("../components/ResultsTable.tsx");
    expect(
      // SAFETY: see Header test above; same React.memo introspection.
      (actual.ResultsTable as { $$typeof: symbol }).$$typeof.description,
    ).toBe("react.memo");
  });
});
