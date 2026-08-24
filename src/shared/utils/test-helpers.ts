/**
 * Cast a partial mock object to a fully-typed interface for test injection.
 * Tests supply only the methods the system-under-test will exercise, so the
 * stub is intentionally narrower than the production interface.
 */
export function stub<T>(partial: Partial<T>): T {
  // SAFETY: test stubs omit dependencies the system-under-test won't invoke; full interfaces would couple tests to methods they don't exercise.
  return partial as T;
}