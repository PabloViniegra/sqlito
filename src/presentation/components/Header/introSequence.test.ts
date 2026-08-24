import { describe, expect, it } from "vitest";
import {
  BASE_FRAME_MS,
  META_BEAT_MS,
  SHIMMER_FRAME_MS,
  buildIntroSchedule,
} from "./introSequence.ts";

const { frames, delays } = buildIntroSchedule(4, "SQLITO");

describe("buildIntroSchedule", () => {
  it("starts fully hidden with a blank wordmark", () => {
    const first = frames[0]!;

    expect(first.mascot).toEqual(["ghost", "hidden", "hidden", "hidden"]);
    expect(first.wordmark.map((c) => c.char).join("")).toBe("      ");
    expect(first.shimmer).toBeNull();
    expect(first.showMeta).toBe(false);
  });

  it("surfaces mascot rows on a tightening cadence", () => {
    // ghost starts at 0, 3, 5, 7 — gaps shrink so momentum builds
    expect(frames[1]!.mascot).toEqual(["solid", "hidden", "hidden", "hidden"]);
    expect(frames[3]!.mascot).toEqual(["solid", "ghost", "hidden", "hidden"]);
    expect(frames[5]!.mascot).toEqual(["solid", "solid", "ghost", "hidden"]);
    expect(frames[7]!.mascot).toEqual(["solid", "solid", "solid", "ghost"]);

    const last = frames[frames.length - 1]!;
    expect(last.mascot.every((cell) => cell === "solid")).toBe(true);
  });

  it("locks the wordmark left to right after scrambling", () => {
    const lockedCounts = frames.map(
      (f) => f.wordmark.filter((c) => c.locked).length,
    );

    for (let i = 1; i < lockedCounts.length; i += 1) {
      expect(lockedCounts[i]).toBeGreaterThanOrEqual(lockedCounts[i - 1]!);
    }
    expect(lockedCounts[0]).toBe(0);

    const preShimmer = frames.filter((f) => f.shimmer === null && !f.showMeta);
    const finalDecode = preShimmer[preShimmer.length - 1]!;
    expect(finalDecode.wordmark.map((c) => c.char).join("")).toBe("SQLITO");
    expect(finalDecode.wordmark.every((c) => c.locked)).toBe(true);
  });

  it("sweeps the shimmer across every position exactly once", () => {
    const sweeps = frames
      .filter((f) => f.shimmer !== null)
      .map((f) => (f.shimmer === null ? -1 : f.shimmer));

    expect(sweeps).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("gives the metadata a dedicated frame after the sweep", () => {
    const metaFrames = frames.filter((f) => f.showMeta);

    expect(metaFrames).toHaveLength(1);
    expect(metaFrames[0]!.shimmer).toBeNull();
    expect(frames[frames.length - 2]!.shimmer).not.toBeNull();
  });

  it("paces the sweep slower and holds a beat before metadata", () => {
    const shimmerStart = frames.findIndex((f) => f.shimmer !== null);

    for (let i = shimmerStart; i < shimmerStart + 4; i += 1) {
      expect(delays[i]).toBe(SHIMMER_FRAME_MS);
    }
    expect(delays[delays.length - 1]).toBe(META_BEAT_MS);
    expect(delays[0]).toBe(BASE_FRAME_MS);
  });

  it("stays snappy and deterministic", () => {
    const totalMs = delays.reduce((a, b) => a + b, 0);
    expect(totalMs).toBeLessThan(750);
    for (const frame of frames) {
      for (const cell of frame.wordmark) {
        if (!cell.locked && cell.char !== " ") {
          expect(cell.char).toMatch(/[#%+=<>|~^*]/);
        }
      }
    }
  });
});
