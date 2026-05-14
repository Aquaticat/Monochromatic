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
  /** Placeholder map awaiting future locale-specific formatter wiring. */
  const formatters: Formatters = {};

  return formatters;
}
