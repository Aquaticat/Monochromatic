/**
 * `createI18n` builds the explicit-locale render surface and registry
 * helpers from a set of locale specs.
 *
 * The factory infers the locale union from a `const` list, and infers
 * the consumer's label/subject/verb/noun unions from the spec record
 * via {@link LabelOf}/{@link SubjectOf}/{@link VerbOf}/{@link NounOf}.
 *
 * @module
 */

import type {
  Fragment,
  NounPhrase,
  Sentence,
  VerbPhrase,
} from './ast.ts';
import type {
  LabelOf,
  LocaleSpec,
  NounOf,
  SubjectOf,
  VerbOf,
} from './locale-spec.ts';

/** Loose `LocaleSpec` upper bound used as the constraint for `Spec` inference; bivariant methods make this a valid supertype of any concrete spec. */
type AnyLocaleSpec = LocaleSpec<string, string, string, string>;

/**
 * Configuration accepted by {@link createI18n}.
 *
 * Carries the const locale list, default locale, and per-locale specs.
 * Specs are inferred as their concrete `LocaleSpec<TestLabel, ...>` type,
 * not the loose `AnyLocaleSpec` constraint, because the helper extracts
 * each vocabulary union from `Specs[Locales[number]]` via {@link LabelOf}
 * and friends.
 */
export type CreateI18nConfig<
  Locales extends readonly string[],
  Specs extends Readonly<Record<Locales[number], AnyLocaleSpec>>,
> = {
  /** Const list of supported locale codes; the literal union flows through every method. */
  readonly locales: Locales;
  /** Locale used as the fallback for runtime locale validation helpers. */
  readonly defaultLocale: Locales[number];
  /** Per-locale specs keyed by locale code; every locale in `locales` must have a spec. */
  readonly specs: Specs;
};

/**
 * Public surface returned by {@link createI18n}.
 *
 * Every render method takes the locale as its first argument; there is
 * no `bindLocale` or `t(locale)` accessor. The library does not remember
 * the current locale.
 */
export type I18n<
  Locale extends string,
  Label extends string,
  Subject extends string,
  Verb extends string,
  Noun extends string,
> = {
  /** Const list of supported locales, returned for downstream `.map`/`.includes`. */
  readonly locales: readonly Locale[];
  /** Locale used by `assertLocale` when an invalid value is rejected. */
  readonly defaultLocale: Locale;
  /** Type guard: narrows an arbitrary string to a supported locale. */
  readonly isLocale: (value: string,) => value is Locale;
  /** Asserts a string is a supported locale, returning it narrowed or throwing. */
  readonly assertLocale: (value: string,) => Locale;
  /** Resolves a static label key in the given locale. */
  readonly label: (
    locale: Locale,
    key: Label,
  ) => string;
  /** Resolves a bare noun key in the given locale, without article or count. */
  readonly noun: (
    locale: Locale,
    noun: Noun,
  ) => string;
  /** Renders a noun phrase AST in the given locale. */
  readonly np: (
    locale: Locale,
    phrase: NounPhrase<Subject, Noun>,
  ) => string;
  /** Renders a verb phrase AST in the given locale. */
  readonly vp: (
    locale: Locale,
    phrase: VerbPhrase<Subject, Verb, Noun>,
  ) => string;
  /** Renders a sentence AST in the given locale. */
  readonly sentence: (
    locale: Locale,
    sentence: Sentence<Subject, Verb, Noun>,
  ) => string;
  /** Renders a fragment AST in the given locale. */
  readonly fragment: (
    locale: Locale,
    fragment: Fragment<Label, Subject, Verb, Noun>,
  ) => string;
};

/**
 * Builds a typed I18n instance from a const locale list and a per-locale
 * spec record.
 *
 * The vocabulary unions (`Label`, `Subject`, `Verb`, `Noun`) are inferred
 * from the spec record, so adding a noun key to one locale without adding
 * it to the others is rejected at compile time.
 *
 * @param config - locale list, default locale, and per-locale specs
 *
 * @returns I18n instance with explicit-locale render methods and registry helpers
 *
 * @throws Error from `assertLocale` when the supplied value is not in `locales`
 *
 * @example
 * ```ts
 * export const locales = ['ca', 'en', 'zh'] as const;
 *
 * export const i18n = createI18n({
 *   locales,
 *   defaultLocale: 'en',
 *   specs: { ca, en, zh },
 * });
 *
 * i18n.label('en', 'siteName');
 * i18n.np('zh', { kind: 'noun.counted', count: 1, noun: 'cat' });
 * ```
 */
export function createI18n<
  const Locales extends readonly string[],
  Specs extends Readonly<Record<Locales[number], AnyLocaleSpec>>,
>(
  config: CreateI18nConfig<Locales, Specs>,
): I18n<
  Locales[number],
  LabelOf<Specs[Locales[number]]>,
  SubjectOf<Specs[Locales[number]]>,
  VerbOf<Specs[Locales[number]]>,
  NounOf<Specs[Locales[number]]>
> {
  /** Locale union narrowed once and reused across every helper closure. */
  type Locale = Locales[number];

  /** Locale lookup set for `isLocale`; `Set.has` outperforms `Array.includes` for repeated checks. */
  const localeSet = new Set<string>(config.locales,);

  /**
   * Returns the spec for a locale, throwing when missing.
   *
   * @param locale - locale code to resolve
   *
   * @returns spec registered for that locale
   *
   * @throws Error when the spec record has no entry for the locale (should not occur in normal use)
   */
  function specFor(locale: Locale,): Specs[Locale] {
    /** Direct lookup; the type system guarantees presence but the runtime check guards against `Object.create(null)`-shaped misuse. */
    const spec = config.specs[locale];
    if (spec === undefined)
      throw new Error(`No locale spec registered for ${String(locale,)}`,);
    return spec;
  }

  /**
   * Runtime locale type guard.
   *
   * @param value - arbitrary input string
   *
   * @returns true when `value` is a registered locale
   */
  function isLocale(value: string,): value is Locale {
    return localeSet.has(value,);
  }

  /**
   * Asserts the supplied value is a registered locale, returning the narrowed type or throwing.
   *
   * @param value - input string to validate
   *
   * @returns same value, narrowed to `Locale`
   *
   * @throws Error when `value` is not a registered locale
   */
  function assertLocale(value: string,): Locale {
    if (!isLocale(value,)) {
      throw new Error(
        `Expected one of ${config.locales.join(', ',)}, got ${String(value,)}`,
      );
    }
    return value;
  }

  return {
    locales: config.locales,
    defaultLocale: config.defaultLocale,
    isLocale,
    assertLocale,
    label: function label(
      locale,
      key,
    ) {
      return specFor(locale,).renderLabel(key,);
    },
    noun: function noun(
      locale,
      key,
    ) {
      return specFor(locale,).renderNoun(key,);
    },
    np: function np(
      locale,
      phrase,
    ) {
      return specFor(locale,).renderNounPhrase(phrase,);
    },
    vp: function vp(
      locale,
      phrase,
    ) {
      return specFor(locale,).renderVerbPhrase(phrase,);
    },
    sentence: function sentence(
      locale,
      ast,
    ) {
      return specFor(locale,).renderSentence(ast,);
    },
    fragment: function fragment(
      locale,
      ast,
    ) {
      return specFor(locale,).renderFragment(ast,);
    },
  };
}
