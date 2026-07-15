/**
 * Intentionally triggers an uncaught synchronous `Error` at the top level.
 * Bun prints the error with a stack trace and exits with code 1.
 */
export {};

throw new Error('Intentional uncaught throw',);
