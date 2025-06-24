import { 
  getCollection,
  type InferEntrySchema,
  type RenderedContent,
} from 'astro:content';

export type Post = {
  lang: string;
  name: string;
  id: string;
  body?: string;
  collection: 'blog';
  data: InferEntrySchema<'blog'>;
  rendered?: RenderedContent;
  filePath?: string;
};

export const posts = (await getCollection('blog')).map((post: any) => ({
  ...post,
  lang: post.id.split('/')[0]!,
  name: post.id.split('/')[1]!,
})) as [Post, ...Post[]];

export const postsGroupedByLang = Object.groupBy(posts, (post) => post.lang) as Record<
  string,
  [Post, ...Post[]]
>;

export const langs = Object.keys(postsGroupedByLang) as [string, ...string[]];

export const postsGroupedByName = Object.groupBy(posts, (post) => post.name) as Record<
  string,
  [Post, ...Post[]]
>;

export const names = Object.keys(postsGroupedByName) as [
  string,
  ...string[],
];

export const tags = [
  ...new Set(posts.flatMap((post) => post.data.tags)),
] as [string, ...string[]];

export const postsGroupedByTag = Object.fromEntries(
  tags.map((tag) => [tag, posts.filter((post) => post.data.tags.includes(tag))]),
) as Record<string, [Post, ...Post[]]>;

export const postsGroupedByLangThenTag = Object.fromEntries(
  langs.map(
    (
      lang,
    ) => [
      lang,
      Object.fromEntries(
        Object.entries(postsGroupedByTag).map(([tag, tagPosts]) => [
          tag,
          tagPosts.filter((tagPost) => tagPost.lang === lang),
        ]),
      ),
    ],
  ),
);

export const i18n = new Map<string, Map<string, string>>(
  [
    [
      'siteName',
      new Map([
        ['en', 'Aquaticat'],
        ['zh', 'Aquaticat'],
      ]),
    ],
    [
      'siteDescription',
      new Map([
        ['en', 'Changing the world, one design at a time'],
        ['zh', '用设计改变世界'],
      ]),
    ],
    [
      'chooseALang',
      new Map([
        ['en', 'choose a language'],
        ['zh', '语言选择'],
      ]),
    ],
    [
      'searchPlaceholder',
      new Map([
        ['en', 'Search keyword, topic, text'],
        ['zh', '搜索关键词，话题，或文段'],
      ]),
    ],
    [
      'redirectingTo',
      new Map([
        ['en', 'redirecting to'],
        ['zh', '正在跳转至'],
      ]),
    ],
    [
      'page',
      new Map([
        ['en', 'page'],
        ['zh', '页面'],
      ]),
    ],
    [
      "Post doesn't exist in specified language",
      new Map([
        ['en', "Post doesn't exist in specified language"],
        ['zh', '无该语言的页面'],
      ]),
    ],
    [
      // eslint-disable-next-line no-template-curly-in-string -- i18n placeholder
      'Redirecting to choose a language page for ${name}',
      new Map([
        // eslint-disable-next-line no-template-curly-in-string -- i18n placeholder
        ['en', 'Redirecting to choose a language page for ${name}'], [
        'zh',
        // eslint-disable-next-line no-template-curly-in-string -- i18n placeholder
        '正在跳转至${name}的语言选择页面',
      ]]),
    ],
  ],
);
