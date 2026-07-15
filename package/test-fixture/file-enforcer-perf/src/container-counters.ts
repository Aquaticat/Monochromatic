/**
 * Best-effort hardware-counter capture for the constrained container benchmark.
 *
 * The container tier times file-enforcer config runs with `performance.now()`
 * rather than mitata, so it drives `@mitata/counters`' low-level API directly.
 * Every counter call is guarded: when the host denies perf access (the default
 * rootless podman case at `perf_event_paranoid >= 1` without CAP_PERFMON), the
 * region is still timed and the counter snapshot is null.
 *
 * Per-region isolation uses init/deinit bracketing because `translate`
 * accumulates min/max/total across every before/after pair since `init` without
 * resetting; a fresh init/deinit per region yields that region's values alone.
 */

import type { CountersTranslation, } from '@mitata/counters';

/** Reduced per-region counter snapshot recorded in the benchmark JSON output. */
export type CountersSnapshot = {
  readonly instructions: number;
  readonly cycles: number;
  readonly ipc: number;
  readonly cacheRefs: number | null;
  readonly cacheMisses: number | null;
  readonly branchMisses: number | null;
};

/** Timing for one region, with counters present only when perf is available. */
export type RegionResult = {
  readonly ms: number;
  readonly counters: CountersSnapshot | null;
};

/** Runtime surface of `@mitata/counters` consumed here. */
type CountersModule = {
  init(): void;
  deinit(): void;
  before(): void;
  after(): void;
  translate(batch?: number, samples?: number): CountersTranslation;
};

/**
 * Rounds an instructions-per-cycle ratio to hundredths.
 *
 * @param value - Raw instructions/cycles ratio
 */
function roundIpc(value: number,): number {
  /** Scale factor for two-decimal rounding. */
  const HUNDREDTHS = 100;
  return Math.round(value * HUNDREDTHS,) / HUNDREDTHS;
}

/**
 * Maps a raw counter translation to the reduced snapshot, rounding event counts
 * to whole events and IPC to hundredths.
 *
 * @param translation - Raw Linux counter shape from translate()
 */
function toSnapshot(translation: CountersTranslation,): CountersSnapshot {
  /** Cache-reference counter, or null when the CPU exposes none. */
  const cache = translation.cache ?? null;
  /** Cache-miss counter nested under cache, or null when absent. */
  const misses = cache?.misses ?? null;
  /** Branch-mispredict counter, or null when absent. */
  const bmispred = translation._bmispred ?? null;
  /** Rounded CPU cycles, reused for the IPC denominator guard. */
  const cycles = Math.round(translation.cycles.avg,);
  return {
    cycles,
    instructions: Math.round(translation.instructions.avg,),
    ipc: cycles > 0 ? roundIpc(translation.instructions.avg / cycles,) : 0,
    cacheRefs: cache !== null ? Math.round(cache.avg,) : null,
    cacheMisses: misses !== null ? Math.round(misses.avg,) : null,
    branchMisses: bmispred !== null ? Math.round(bmispred.avg,) : null,
  };
}

/**
 * Opens counters and snapshots the baseline for one region.
 *
 * @param counters - Loaded counters module
 *
 * @returns Whether init and before both succeeded
 */
function startCounters(counters: CountersModule,): boolean {
  try {
    counters.init();
    counters.before();
    return true;
  }
  catch {
    return false;
  }
}

/**
 * Closes the region, reads counters, and tears the module down.
 *
 * @param counters - Loaded counters module previously started
 *
 * @returns Snapshot, or null when reading fails
 */
function finishCounters(counters: CountersModule,): CountersSnapshot | null {
  try {
    counters.after();
    /** This region's snapshot from a single accumulated before/after pair. */
    const snapshot = toSnapshot(counters.translate(1, 1,),);
    counters.deinit();
    return snapshot;
  }
  catch {
    return null;
  }
}

/**
 * Loads `@mitata/counters`, returning null when the native addon cannot load.
 *
 * @example
 * const counters = await loadCounters();
 * const usable = counters !== null && probeCounters(counters,);
 */
export async function loadCounters(): Promise<CountersModule | null> {
  try {
    return await import('@mitata/counters',);
  }
  catch {
    return null;
  }
}

/**
 * Checks that the host actually grants perf access by running one throwaway
 * init/before/after/translate/deinit cycle.
 *
 * @param counters - Loaded counters module
 *
 * @returns Whether a full counter cycle completes without throwing
 */
export function probeCounters(counters: CountersModule,): boolean {
  try {
    counters.init();
    counters.before();
    counters.after();
    counters.translate(1, 1,);
    counters.deinit();
    return true;
  }
  catch {
    return false;
  }
}

/**
 * Times an async region and, when counters are available, captures a hardware
 * snapshot around it. The counter span covers thread-on-CPU work between
 * before() and after(), including event-loop activity during awaits, so values
 * are approximate for single-shot async regions.
 *
 * @param root0 - Named arguments
 * @param root0.counters - Loaded counters module, or null for timing only
 * @param root0.run - Region to execute and measure
 *
 * @example
 * const result = await measureRegion({
 *   counters,
 *   run: async function runCold() { await import(`${path}?v=cold`,); },
 * },);
 */
export async function measureRegion({ counters, run, }: {
  readonly counters: CountersModule | null;
  readonly run: () => Promise<void>;
},): Promise<RegionResult> {
  if (counters === null) {
    /** Wall-clock start for the timing-only path. */
    const timingOnlyStart = performance.now();
    await run();
    return { ms: performance.now() - timingOnlyStart, counters: null, };
  }
  /** Whether this region's counters opened successfully. */
  const started = startCounters(counters,);
  /** Wall-clock start for the measured region. */
  const start = performance.now();
  await run();
  /** Wall-clock duration of the measured region. */
  const ms = performance.now() - start;
  return { ms, counters: started ? finishCounters(counters,) : null, };
}
