// oxlint-disable tsdoc/require-tsdoc, no-non-null-assertion, no-restricted-syntax/no-arrow-function, typescript-eslint/no-unsafe-member-access, typescript-eslint/no-unsafe-assignment, typescript-eslint/no-unsafe-call, typescript-eslint/no-unsafe-type-assertion, typescript-eslint/explicit-function-return-type, eslint/require-await, typescript-eslint/no-unsafe-argument, typescript-eslint/no-unsafe-return -- Astro RSS endpoint with framework-dictated patterns
import { generateRssFeed, } from 'feedsmith';
import type {
  APIRoute,
  GetStaticPaths,
} from 'astro';

import {
  i18n,
  langs,
  type Post,
  postsGroupedByLang,
} from '@_/index.ts';

type StaticPath = { params: { lang: string; }; };

export async function getStaticPaths(): Promise<StaticPath[]> { return langs.map((lang: string,) => ({
    params: { lang, },
  })) }

export function GET({ site, params, },) {
  const lang = params.lang as string;
  const siteUrl = site?.toString() ?? 'https://example.com';

  const rssXml = generateRssFeed({
    title: i18n.get('siteName',)!.get(lang,)!,
    link: siteUrl,
    description: i18n.get('siteDescription',)!.get(lang,)!,
    language: lang,
    items: postsGroupedByLang[lang]!.map((langPost: Post,) => ({
      title: langPost.data.title,
      link: `${siteUrl}/${langPost.id}`,
      description: langPost.data.description,
      pubDate: langPost.data.published,
      categories: langPost.data.tags.map((tag: string,) => ({ name: tag, }),),
    })),
  },);

  return new Response(rssXml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  },);
}
