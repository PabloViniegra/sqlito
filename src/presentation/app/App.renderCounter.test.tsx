import BetterSqlite3 from "better-sqlite3";
import { render } from "ink";
import {
  Profiler,
  memo,
  type ComponentProps,
  type ProfilerOnRenderCallback,
} from "react";
import { describe, expect, it, vi } from "vitest";
import { BetterSqliteDatabase } from "../../infrastructure/sqlite/BetterSqliteDatabase.ts";
import { SqliteSchemaRepository } from "../../infrastructure/sqlite/SqliteSchemaRepository.ts";
import { Header } from "../components/Header.tsx";
import { Prompt } from "../components/Prompt.tsx";
import { ResultsTable } from "../components/ResultsTable.tsx";
import { StatusBar } from "../components/StatusBar.tsx";
import { createApp } from "./createApp.tsx";
import { fakeStdin, fakeStdout } from "../../shared/utils/inkTestStreams.ts";

const counters = {
  header: vi.fn<ProfilerOnRenderCallback>(),
  statusBar: vi.fn<ProfilerOnRenderCallback>(),
  resultsTable: vi.fn<ProfilerOnRenderCallback>(),
  prompt: vi.fn<ProfilerOnRenderCallback>(),
};

const App = createApp({
  Header: memo(function CountedHeader(props: ComponentProps<typeof Header>) {
    return (
      <Profiler id="Header" onRender={counters.header}>
        <Header {...props} />
      </Profiler>
    );
  }),
  StatusBar: memo(function CountedStatusBar(
    props: ComponentProps<typeof StatusBar>,
  ) {
    return (
      <Profiler id="StatusBar" onRender={counters.statusBar}>
        <StatusBar {...props} />
      </Profiler>
    );
  }),
  ResultsTable: memo(function CountedResultsTable(
    props: ComponentProps<typeof ResultsTable>,
  ) {
    return (
      <Profiler id="ResultsTable" onRender={counters.resultsTable}>
        <ResultsTable {...props} />
      </Profiler>
    );
  }),
  Prompt: memo(function CountedPrompt(props: ComponentProps<typeof Prompt>) {
    return (
      <Profiler id="Prompt" onRender={counters.prompt}>
        <Prompt {...props} />
      </Profiler>
    );
  }),
});

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
  const db = new BetterSqliteDatabase(driver);
  const schema = new SqliteSchemaRepository(db);
  const stdout = fakeStdout(80, 24);
  const stdin = fakeStdin();
  // SAFETY: Ink's render accepts Node streams; FakeStdin/FakeStdout satisfy that surface at runtime after the fixture mutations above.
  const instance = render(<App db={db} schema={schema} dbPath=":memory:" />, {
    stdin: stdin as NodeJS.ReadStream,
    stdout: stdout as NodeJS.WriteStream,
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
      counters.header.mockClear();
      counters.statusBar.mockClear();
      counters.resultsTable.mockClear();
      counters.prompt.mockClear();
    },
    waitForStable(timeoutMs) {
      return waitForCounterStable(
        () => counters.resultsTable.mock.calls.length,
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
      expect(counters.header).toHaveBeenCalledTimes(0);
    } finally {
      await app.cleanup();
    }
  });

  it("StatusBar does not re-render when typing 100 chars", async () => {
    const app = await mountApp();
    try {
      app.reset();
      await app.send("a".repeat(100));
      expect(counters.statusBar).toHaveBeenCalledTimes(0);
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
      expect(counters.resultsTable).toHaveBeenCalledTimes(1);
    } finally {
      await app.cleanup();
    }
  });

  it("Prompt does not re-render when the command palette opens", async () => {
    const app = await mountApp();
    try {
      app.reset();
      await app.send("\x10");
      expect(counters.prompt).toHaveBeenCalledTimes(0);
    } finally {
      await app.cleanup();
    }
  });
});

describe("App render-counter (memoization guard) — real component memoization", () => {
  it("Header is wrapped in React.memo", async () => {
    // SAFETY: React.memo-wrapped components carry a `$$typeof` symbol whose `.description` is "react.memo"; we narrow the type to read it.
    expect((Header as { $$typeof: symbol }).$$typeof.description).toBe(
      "react.memo",
    );
  });

  it("StatusBar is wrapped in React.memo", async () => {
    expect(
      // SAFETY: see Header test above; same React.memo introspection.
      (StatusBar as { $$typeof: symbol }).$$typeof.description,
    ).toBe("react.memo");
  });

  it("Prompt is wrapped in React.memo", async () => {
    // SAFETY: see Header test above; same React.memo introspection.
    expect((Prompt as { $$typeof: symbol }).$$typeof.description).toBe(
      "react.memo",
    );
  });

  it("ResultsTable is wrapped in React.memo", async () => {
    expect(
      // SAFETY: see Header test above; same React.memo introspection.
      (ResultsTable as { $$typeof: symbol }).$$typeof.description,
    ).toBe("react.memo");
  });
});
