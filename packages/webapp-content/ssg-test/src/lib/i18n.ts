/**
 * Internationalization strings keyed by message ID then language code.
 *
 * Each entry maps a semantic message key to a `Map` of language-specific translations.
 * Used by templates to render locale-appropriate text without runtime i18n libraries.
 */
export const i18n: Map<string, Map<string, string>> = new Map<string,
  Map<string, string>>(
  [
    [
      'siteName',
      new Map([
        ['en', 'Aquaticat',],
        ['zh', 'Aquaticat',],
      ],),
    ],
    [
      'siteDescription',
      new Map([
        ['en', 'Changing the world, one design at a time',],
        ['zh', '用设计改变世界',],
      ],),
    ],
    [
      'chooseALang',
      new Map([
        ['en', 'choose a language',],
        ['zh', '语言选择',],
      ],),
    ],
    [
      'searchPlaceholder',
      new Map([
        ['en', 'Search keyword, topic, text',],
        ['zh', '搜索关键词，话题，或文段',],
      ],),
    ],
    [
      'noResults',
      new Map([
        ['en', 'No results',],
        ['zh', '无结果',],
      ],),
    ],
    [
      'page',
      new Map([
        ['en', 'page',],
        ['zh', '页面',],
      ],),
    ],
    [
      'postNotInLang',
      new Map([
        ['en', "Post doesn't exist in specified language",],
        ['zh', '无该语言的页面',],
      ],),
    ],
    [
      'redirectingToLangChooser',
      new Map([
        ['en', 'Choose a language for',],
        ['zh', '的语言选择',],
      ],),
    ],
  ],
);

/**
 * Retrieves a translated string by message ID and language code.
 *
 * @param id - message ID key in the i18n map
 *
 * @param lang - two-letter language code
 *
 * @returns translated string
 *
 * @throws when message ID or language code is not found
 *
 * @example
 * ```ts
 * t('siteName', 'en') // 'Aquaticat'
 * ```
 */
export function t(id: string, lang: string,): string {
  const langMap = i18n.get(id,);
  if (langMap === undefined)
    throw new Error(`i18n: unknown message ID "${id}"`,);

  const value = langMap.get(lang,);
  if (value === undefined)
    throw new Error(`i18n: no "${lang}" translation for "${id}"`,);

  return value;
}
