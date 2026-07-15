/**
 * Native names (autonyms) for each supported locale.
 *
 * Unlike the localized label tables, these strings
 * are intentionally constant across renders: the value for `ca`
 * is always "Català" regardless of which locale is currently being
 * rendered, so a reader on the English landing page sees the Catalan
 * option labelled in Catalan; a standard convention for language
 * switchers on multilingual sites.
 *
 * @example
 * ```ts
 * import { LANG_NAMES, } from '../i18n/lang-names.ts';
 * LANG_NAMES.ca; // 'Català'
 * ```
 */
import type { Locale, } from './index.ts';

/**
 * Autonym for each supported locale; never translated.
 */
export const LANG_NAMES: Record<Locale, string> = {
  ca: 'Català',
  en: 'English',
  zh: '中文',
};
