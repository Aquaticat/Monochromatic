/**
 * Shared constants for editord client and server.
 */

/** Bytes in one kilobyte. */
export const BYTES_PER_KB = 1_024;

/**
 * Maximum file size in bytes before large-file degradation kicks in.
 * Files exceeding this threshold trigger a client-side warning toast,
 * skip LSP activation (no diagnostics, hover, completions, etc.),
 * and truncate syntax highlighting.
 *
 * @example
 * A 150 KB minified bundle triggers all large-file guards;
 * a 50 KB source file is handled normally.
 */
export const FILE_SIZE_WARNING_THRESHOLD = 100 * BYTES_PER_KB;
