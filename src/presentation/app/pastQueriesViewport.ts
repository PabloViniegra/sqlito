import type { PastQuery } from "./appReducer.ts";

export type PastQueriesViewport = {
  readonly visible: readonly PastQuery[];
  readonly overflowBelow: number;
  readonly canScrollUp: boolean;
  readonly canScrollDown: boolean;
};

export function pastQueriesViewport(
  queries: readonly PastQuery[],
  maxVisible: number,
  offset: number,
): PastQueriesViewport {
  const maxOffset = Math.max(0, queries.length - maxVisible);
  const clampedOffset = Math.min(Math.max(0, offset), maxOffset);
  const end = queries.length - clampedOffset;
  const start = Math.max(0, end - maxVisible);
  const visible = queries.slice(start, end);
  const overflowBelow = Math.max(
    0,
    queries.length - maxVisible - clampedOffset,
  );
  return {
    visible,
    overflowBelow,
    canScrollUp: clampedOffset < maxOffset,
    canScrollDown: clampedOffset > 0,
  };
}
