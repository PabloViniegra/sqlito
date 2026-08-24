const SCRAMBLE_POOL = "#%+=<>|~^*";

// Base flicker ~38fps; the sweep slows so the eye can follow it; a short
// beat separates the sweep from the metadata landing.
export const BASE_FRAME_MS = 26;
export const SHIMMER_FRAME_MS = 40;
export const META_BEAT_MS = 70;

// Decelerating cascade: tightening gaps build momentum into the decode.
const GAPS = [3, 2, 2, 1];
const DECODE_STAGGER = 1;
const DECODE_CYCLES = 2;

export type MascotCell = "hidden" | "ghost" | "solid";
export type IntroCell = { readonly char: string; readonly locked: boolean };

export type IntroFrame = {
  readonly mascot: readonly MascotCell[];
  readonly wordmark: readonly IntroCell[];
  readonly shimmer: number | null;
  readonly showMeta: boolean;
};

export type IntroSchedule = {
  readonly frames: readonly IntroFrame[];
  /** delays[i] = ms between frame i and frame i+1 */
  readonly delays: readonly number[];
};

/**
 * Deterministic intro storyboard: mascot rows surface as ░ wireframes that
 * fill solid on a tightening cadence, the wordmark decodes glyph by glyph,
 * one bright shimmer sweeps across, then the metadata lands on its own beat.
 */
export function buildIntroSchedule(
  mascotRowCount: number,
  wordmark: string,
): IntroSchedule {
  const letters = [...wordmark];
  const ghostStarts: number[] = [];
  for (let r = 0; r < mascotRowCount; r += 1) {
    ghostStarts.push(
      r === 0 ? 0 : ghostStarts[r - 1]! + GAPS[(r - 1) % GAPS.length]!,
    );
  }
  const decodeStart = ghostStarts[ghostStarts.length - 1] ?? 0;
  const shimmerStart =
    decodeStart + (letters.length - 1) * DECODE_STAGGER + DECODE_CYCLES + 1;
  const total = shimmerStart + letters.length + 1;

  const frames: IntroFrame[] = [];
  for (let f = 0; f < total; f += 1) {
    const mascot = Array.from({ length: mascotRowCount }, (_, r): MascotCell =>
      f >= ghostStarts[r]! + 1
        ? "solid"
        : f === ghostStarts[r]!
          ? "ghost"
          : "hidden",
    );
    const cells = letters.map((ch, i): IntroCell => {
      const start = decodeStart + i * DECODE_STAGGER;
      if (f >= start + DECODE_CYCLES) return { char: ch, locked: true };
      if (f >= start) {
        return {
          char: SCRAMBLE_POOL[(f * 3 + i * 5) % SCRAMBLE_POOL.length]!,
          locked: false,
        };
      }
      return { char: " ", locked: false };
    });
    const sweeping = f >= shimmerStart && f < shimmerStart + letters.length;
    frames.push({
      mascot,
      wordmark: cells,
      shimmer: sweeping ? f - shimmerStart : null,
      showMeta: f === total - 1,
    });
  }

  const delays: number[] = [];
  for (let i = 0; i < total - 1; i += 1) {
    if (i === total - 2) delays.push(META_BEAT_MS);
    else if (i >= shimmerStart && i <= shimmerStart + letters.length - 2) {
      delays.push(SHIMMER_FRAME_MS);
    } else delays.push(BASE_FRAME_MS);
  }

  return { frames, delays };
}
