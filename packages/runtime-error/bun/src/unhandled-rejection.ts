/**
 * Intentionally triggers an unhandled promise rejection by creating a rejected
 * promise with no handler. The runtime detects the unhandled rejection on the
 * next event-loop tick and exits with code 1.
 * `Bun.sleep` keeps the event loop alive long enough for the detection to fire.
 */
export {};

/** Milliseconds to keep the event loop alive for unhandled rejection detection. */
const KEEP_ALIVE_MS = 100;

void Promise.reject(new Error('Intentional unhandled rejection',),);

// Keep the event loop alive so the runtime can detect the unhandled rejection before exiting
await Bun.sleep(KEEP_ALIVE_MS,);
