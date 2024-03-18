// Place any global data in this file.
// You can import this data from anywhere in your site by using the `import` keyword.

export const TITLE = 'Subtle';
export const DESCRIPTION = 'Personal Blog Theme for Astro';

export const COLOR = '#966783';

export const AUTHOR = 'Aquaticat';

export const SOCIALS = Object.freeze(
  new Map([
    ['RSS Feed', 'https://aquati.cat/rss'],
    ['Email', 'mailto:an@aquati.cat?subject=Email author of Monochromatic/Subtle'],
    ['GitHub', 'https://github.com/Aquaticat'],
    ['Telegram', 'https://t.me/Aquaticat'],
  ]),
);

export const LINKS = Object.freeze(
  new Map([
    ['Catoverflow', 'https://c-j.dev'],
    ['dummy1', 'https://example.com'],
    ['big dummy2', 'https://example.com'],
    ['big big dummy1', 'https://example.com'],
    ['big big dummy2', 'https://example.com'],
    ['dummy3', 'https://example.com'],
    ['dummy4', 'https://example.com'],
    ['dummy5', 'https://example.com'],
    ['dummy6', 'https://example.com'],
  ]),
);

const langMappings = Object.freeze([
  { codes: ['en', 'en-US', 'en-CA', 'en-UK', 'en-GB'], path: '' },
  { codes: ['zh', 'zh-CN', 'zh-TW'], path: 'zh' },
]);

export const I18N = Object.freeze(
  new Map(langMappings.flatMap((langMapping) => langMapping.codes.map((key) => [key, langMapping.path]))),
);

export const LANG_PATHS = Object.freeze(langMappings.map((langMapping) => langMapping.path));

export const STRINGS = Object.freeze(
  new Map([
    [
      '404',
      new Map([
        ['en', `You've landed on an unknown page.`],
        ['zh', '未知领域'],
      ]),
    ],
    [
      'tempUnavailable',
      new Map([
        ['en', 'Sorry, this page is not available in your language yet. Please check back later.'],
        ['zh', '抱歉，此页暂时无所选语言的版本，请稍后再看。'],
      ]),
    ],
    [
      'unsupported',
      new Map([
        ['en', 'Sorry, this site is not available in your language.'],
        ['zh', '抱歉，此网站不支持所选语言。'],
      ]),
    ],
    [
      'searchPlaceholder',
      new Map([
        ['en', 'Search tags, topics, or snippets'],
        ['zh', '搜索关键词，话题，或文段'],
      ]),
    ],
  ]),
);

export const DEFAULT_LANG = langMappings.find((langMapping) => langMapping.path === '')!.codes[0]!;

export const LANGS = Object.freeze(LANG_PATHS.toSpliced(LANG_PATHS.indexOf(''), 1, DEFAULT_LANG));
