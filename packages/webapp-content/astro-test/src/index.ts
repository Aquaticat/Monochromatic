// oxlint-disable typescript-eslint/no-unsafe-member-access, typescript-eslint/no-unsafe-call, typescript-eslint/no-unsafe-assignment, typescript-eslint/no-unsafe-argument, typescript-eslint/no-unsafe-type-assertion, typescript-eslint/no-unsafe-return, typescript-eslint/strict-boolean-expressions, typescript-eslint/no-explicit-any -- Astro content system types are inherently untyped
import {
  getCollection,
  type InferEntrySchema,
  type RenderedContent,
} from 'astro:content';

/** Single blog post with extracted language and name from the content ID. */
export type Post = {
  /** Two-letter language code extracted from the post ID path. */
  lang: string;
  /** Post slug extracted from the post ID path. */
  name: string;
  /** Full content collection ID (e.g. `en/my-post`). */
  id: string;
  /** Raw markdown body of the post. */
  body?: string;
  /** Content collection this post belongs to. */
  collection: 'blog';
  /** Frontmatter schema data inferred from the blog collection. */
  data: InferEntrySchema<'blog'>;
  /** Rendered HTML content of the post. */
  rendered?: RenderedContent;
  /** Filesystem path to the source file. */
  filePath?: string;
};

/** All blog posts with extracted `lang` and `name` fields from the collection ID. */
export const posts = (await getCollection('blog',)).map(function extractPost(post: any,) { return {
  ...post,
  lang: post.id.split('/',)[0] ?? '',
  name: post.id.split('/',)[1] ?? '',
}; }) as [Post, ...Post[],];

/** Posts grouped by language code (e.g. `{ en: [...], zh: [...] }`). */
export const postsGroupedByLang = Object.groupBy(posts, function byLang(post) { return post.lang; },) as Record<
  string,
  [Post, ...Post[],]
>;

/** All available language codes across blog posts. */
export const langs = Object.keys(postsGroupedByLang,) as [string, ...string[],];

/** Posts grouped by slug name across all languages. */
export const postsGroupedByName = Object.groupBy(posts, function byName(post) { return post.name; },) as Record<
  string,
  [Post, ...Post[],]
>;

/** All unique post slug names across all languages. */
export const names = Object.keys(postsGroupedByName,) as [
  string,
  ...string[],
];

/** All unique tags used across all blog posts. */
export const tags = [
  ...new Set(posts.flatMap(function getTags(post) { return post.data.tags; }),),
] as [string, ...string[],];

/** Posts grouped by tag, each tag mapping to its matching posts. */
export const postsGroupedByTag = Object.fromEntries(
  tags.map(function tagEntry(tag) { return [tag, posts.filter(function hasTag(post) { return post.data.tags.includes(tag,); }),]; }),
) as Record<string, [Post, ...Post[],]>;

/** Posts grouped first by language, then by tag within each language. */
export const postsGroupedByLangThenTag: Record<string, Record<string, Post[]>> = Object.fromEntries(
  langs.map(
    function langEntry(lang) { return [
      lang,
      Object.fromEntries(
        Object.entries(postsGroupedByTag,).map(function filterByLang([tag, tagPosts,],) { return [
          tag,
          tagPosts.filter(function matchLang(tagPost) { return tagPost.lang === lang; }),
        ]; }),
      ),
    ]; },
  ),
);

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
