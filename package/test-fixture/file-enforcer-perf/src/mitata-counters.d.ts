/**
 * Ambient type declarations for `@mitata/counters`, which ships only
 * `src/lib.mjs` with no bundled types. Covers the low-level Linux counter API
 * that the constrained container benchmark drives directly; mitata's own
 * auto-detected use in the micro tier needs none of these.
 */

declare module '@mitata/counters' {
  /** Min, max, and mean for one accumulated hardware counter. */
  export type CounterStat = {
    readonly min: number;
    readonly max: number;
    readonly avg: number;
  };

  /** Cache-reference counter carrying an optional nested miss counter. */
  export type CounterCache = CounterStat & {
    readonly misses: CounterStat | null;
  };

  /** Linux shape from {@link translate}; per-CPU-absent fields are null. */
  export type CountersTranslation = {
    readonly cache?: CounterCache | null;
    readonly cycles: CounterStat;
    readonly instructions: CounterStat;
    readonly branches?: unknown;
    readonly _bmispred?: CounterStat | null;
  };

  /** Opens perf-counter file descriptors; throws when perf access is denied. */
  export function init(): void;

  /** Closes perf-counter file descriptors opened by {@link init}. */
  export function deinit(): void;

  /** Snapshots counter baselines at the start of a measured region. */
  export function before(): void;

  /** Accumulates counter deltas for a region opened by {@link before}. */
  export function after(): void;

  /**
   * Reads accumulated counters as per-iteration values.
   *
   * @param batch - Iterations folded into one before/after pair; divides totals
   * @param samples - before/after pairs accumulated since init; divides totals
   */
  export function translate(batch?: number, samples?: number): CountersTranslation;
}
