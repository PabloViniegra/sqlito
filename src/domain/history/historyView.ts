export function newestFirst<T>(
  entries: readonly T[],
  limit: number,
): readonly T[] {
  const start = Math.max(0, entries.length - limit);
  return entries.slice(start).reverse();
}
