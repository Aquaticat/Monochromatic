/**
 * Runtime entry for paper2vn translations.
 *
 * Wraps {@link i18nObject} so the rest of the app reads the active
 * locale from the settings store without each call site repeating
 * that lookup. Locale changes invalidate the memoized accessor so
 * subsequent `LL()` calls return the new locale's strings.
 */
import { getSettings, } from '../state.ts';
import type {
  Locales,
  TranslationFunctions,
  Translations,
} from './i18n-types.ts';
import { loadAllLocales, } from './i18n-util.sync.ts';
import {
  i18nObject,
  loadedLocales,
} from './i18n-util.ts';

/**
 * Maps stored locale to typesafe-i18n locales code (identity here).
 *
 * @returns the active locale code
 */
function resolveLocale(): Locales {
  return getSettings()
    .locale;
}

/**
 * Translation-accessor cache keyed by locale.
 */
const accessorByLocale = new Map<Locales, TranslationFunctions>();

/**
 * Loads all bundled locales into typesafe-i18n's registry.
 *
 * Call once at boot. Idempotent.
 *
 * @example
 * ```ts
 * bootI18n();
 * console.error(LL().menu.start());
 * ```
 */
export function bootI18n(): void {
  loadAllLocales();
}

/**
 * Returns the current locale's translation functions.
 *
 * Cheap to call repeatedly; the accessor object is memoized
 * per-locale and invalidated automatically when the active locale
 * changes.
 *
 * @returns object whose methods return localized strings
 *
 * @example
 * ```ts
 * el.textContent = LL().menu.startLecture();
 * ```
 */
export function LL(): TranslationFunctions {
  /**
   * Active locale code, looked up once so cache check and accessor rebuild agree.
   */
  const locale = resolveLocale();
  /**
   * Existing accessor for this locale, if any.
   */
  const existing = accessorByLocale.get(locale,);
  if (existing !== undefined)
    return existing;
  /**
   * Freshly-built accessor cached for subsequent calls in the same locale.
   */
  const fresh = i18nObject(locale,);
  accessorByLocale.set(
    locale,
    fresh,
  );
  return fresh;
}

/**
 * Returns the BCP-47 language tag for the current locale, used by Web Speech.
 *
 * @returns BCP-47 tag (e.g. `en-US` for the `en` locale)
 *
 * @example
 * ```ts
 * utterance.lang = bcp47();
 * ```
 */
export function bcp47(): string {
  return ({
    en: 'en-US',
    zh: 'zh-CN',
    ja: 'ja-JP',
    ru: 'ru-RU',
  } satisfies Record<Locales, string>)[resolveLocale()];
}

/**
 * Translation keys whose stored value is a plain string.
 */
type StringKey = {
  [K in keyof Translations]: Translations[K] extends string ? K : never;
}[keyof Translations];

/**
 * Returns the raw, unparsed string for the active locale.
 *
 * Bypasses typesafe-i18n's template parser. The parser's
 * `REGEX_BRACKETS_SPLIT` regex catastrophically backtracks on
 * deeply-nested `{}` patterns (the JSON schema embedded in the
 * `chapterInstruction` prompts pins V8's regex engine for minutes;
 * JSC under Bun handles the same pattern in microseconds). Use this
 * accessor for prompt strings that contain literal braces and don't
 * need parameter interpolation; the parser's machinery is overkill
 * for fixed prompts.
 *
 * @param key - translation key (must be a plain string in every locale)
 *
 * @returns raw value of `loadedLocales[currentLocale][key]`
 *
 * @example
 * ```ts
 * const prompt = `${rawString('persona')}\n\n${rawString('chapterInstruction')}`;
 * ```
 */
export function rawString(key: StringKey,): string {
  /**
   * Active locale, captured before the dictionary lookup.
   */
  const locale = resolveLocale();
  /**
   * Loaded dictionary for the active locale.
   */
  const translations = loadedLocales[locale];
  /**
   * Raw translation entry, expected to be a plain string for this key.
   */
  const value = translations[key];
  if ((typeof value) !== 'string') {
    throw new Error(
      `[i18n] expected string for ${key}, got ${typeof value}`,
    );
  }
  return value;
}
