/**
 * Intentionally triggers SIGABRT by calling `process.abort()`, which
 * immediately terminates the process with an abort signal and (on most
 * systems) produces a core dump. Unlike a thrown error, this bypasses all
 * JavaScript error handlers and exits unconditionally.
 */
export {};

process.abort();
