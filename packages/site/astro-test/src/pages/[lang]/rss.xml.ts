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

export const getStaticPaths: GetStaticPaths = async (): Promise<StaticPath[]> => {
  return langs.map((lang: string,) => ({
    params: { lang, },
  }));
};

export const GET: APIRoute = ({ site, params, },) => {
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
      categories: langPost.data.tags,
    })),
  },);

  return new Response(rssXml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  },);
};
