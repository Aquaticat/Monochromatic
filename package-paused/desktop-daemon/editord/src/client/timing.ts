/**
 * Centralized timing constants for the editord client.
 *
 * Single source of truth for debounce delays, timeouts, and
 * other timing-sensitive values used across modules.
 */

/**
 * Debounce delay for auto-saving editor content (milliseconds).
 */
export const AUTO_SAVE_DEBOUNCE_MS = 1_000;

/**
 * Debounce delay for syncing content changes to LSP servers (milliseconds).
 */
export const CONTENT_SYNC_DEBOUNCE_MS = 500;

/**
 * Debounce delay for hover tooltip requests (milliseconds).
 */
export const HOVER_DEBOUNCE_MS = 350;

/**
 * Debounce delay for inlay hint refresh after content changes (milliseconds).
 */
export const INLAY_HINT_DEBOUNCE_MS = 750;
