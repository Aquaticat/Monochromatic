/**
 * localStorage keys used by paper2vn.
 *
 * Centralized so future migrations can target a single file. Keys are
 * prefixed with `p2vn:` to avoid collisions with other apps that may
 * be served from the same origin.
 */

/**
 * Settings store key (font size, voice volume, language, ...)
 */
export const STORAGE_KEY_SETTINGS = 'p2vn:settings';

/**
 * Provider configuration key (provider id, model, key).
 */
export const STORAGE_KEY_PROVIDER = 'p2vn:provider';

/**
 * Save slots index: list of `{ id, label, paperTitle, updatedAt }`.
 */
export const STORAGE_KEY_SAVES = 'p2vn:saves';

/**
 * Per-save data; full key is `${STORAGE_KEY_SAVE_PREFIX}${id}`.
 */
export const STORAGE_KEY_SAVE_PREFIX = 'p2vn:save:';
