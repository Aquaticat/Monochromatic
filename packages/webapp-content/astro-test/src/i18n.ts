/** Internationalization strings keyed by message ID then language code. */
export const i18n: Map<string, Map<string, string>> = new Map<string, Map<string, string>>(
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
      'redirectingTo',
      new Map([
        ['en', 'redirecting to',],
        ['zh', '正在跳转至',],
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
      "Post doesn't exist in specified language",
      new Map([
        ['en', "Post doesn't exist in specified language",],
        ['zh', '无该语言的页面',],
      ],),
    ],
    [
      // oxlint-disable-next-line no-template-curly-in-string -- i18n placeholder
      'Redirecting to choose a language page for ${name}',
      new Map([
        // oxlint-disable-next-line no-template-curly-in-string -- i18n placeholder
        ['en', 'Redirecting to choose a language page for ${name}',],
        [
          'zh',
          // oxlint-disable-next-line no-template-curly-in-string -- i18n placeholder
          '正在跳转至${name}的语言选择页面',
        ],
      ],),
    ],
  ],
);
