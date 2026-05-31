import type {
  Formatters,
  Locales,
} from './i18n-types.ts';

/**
 * Initializes locale-specific formatters.
 *
 * @param _locale - target locale code (unused until custom formatters are added)
 *
 * @returns empty formatters object
 *
 * @example
 * ```ts
 * const formatters = initFormatters('en');
 * ```
 */
export function initFormatters(_locale: Locales,): Formatters {
  /**
   * Per-locale formatter bag, currently empty until custom formatters land.
   */
  const formatters: Formatters = {};

  return formatters;
}
