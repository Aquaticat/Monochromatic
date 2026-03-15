/**
 * Elapsed-time log prefix injection.
 *
 * Overrides `console.log` and `console.error` to prepend a "+Xs" elapsed-time
 * prefix so interleaved output from parallel model runs is easy to timeline.
 * Import this module for its side effects before any logging occurs.
 */

/** Milliseconds per second for elapsed-time display */
const MS_PER_SECOND = 1_000;

/** Width of the elapsed-time column so values align up to 999.9s */
const ELAPSED_PAD_WIDTH = 6;

/** Process start time for computing elapsed seconds in log prefixes */
const PROCESS_START_MS = Date.now();

/**
 * Formats elapsed milliseconds as a right-aligned "+NNs" prefix for log lines.
 *
 * @returns elapsed time string like "+  4.2s"
 */
function elapsedPrefix(): string {
  const elapsed = ((Date.now() - PROCESS_START_MS) / MS_PER_SECOND).toFixed(1,);
  // Pad to 6 chars so columns align up to 999.9s
  return `[+${elapsed.padStart(ELAPSED_PAD_WIDTH,)}s]`;
}

/** Original console.log preserved before timestamp injection override. */
// oxlint-disable-next-line no-console -- intentional override to inject timestamps
const originalLog = console.log;
/** Original console.error preserved before timestamp injection override. */
// oxlint-disable-next-line no-console -- intentional override to inject timestamps
const originalError = console.error;
// oxlint-disable-next-line no-console -- intentional override
console.log = function logWithTimestamp(...args: unknown[]): void {
  originalLog(elapsedPrefix(), ...args,);
};
// oxlint-disable-next-line no-console -- intentional override
console.error = function errorWithTimestamp(...args: unknown[]): void {
  originalError(elapsedPrefix(), ...args,);
};

export {};
