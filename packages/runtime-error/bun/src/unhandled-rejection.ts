/**
 * Intentionally triggers an unhandled promise rejection by creating a rejected
 * promise with no `.catch()` handler or enclosing `try`/`catch`. Bun detects
 * the unhandled rejection on the next event-loop tick and exits with code 1.
 * `Bun.sleep` keeps the event loop alive long enough for the detection to fire.
 */
void Promise.reject(new Error("Intentional unhandled rejection"));

// Keep the event loop alive so Bun can detect the unhandled rejection before exiting
await Bun.sleep(100);

export {};
