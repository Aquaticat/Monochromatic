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
 */
export function initFormatters(_locale: Locales,): Formatters {
  const formatters: Formatters = {};

  return formatters;
}
