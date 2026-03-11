/**
 * Intentionally triggers an unhandled promise rejection by creating a rejected
 * promise with no `.catch()` handler or enclosing `try`/`catch`. The runtime detects
 * the unhandled rejection on the next event-loop tick and exits with code 1.
 * `setTimeout` keeps the event loop alive long enough for the detection to fire.
 */
void Promise.reject(new Error("Intentional unhandled rejection"));

// Keep the event loop alive so the runtime can detect the unhandled rejection before exiting
await new Promise(function keepAlive(resolve) { setTimeout(resolve, 100); });

export {};
