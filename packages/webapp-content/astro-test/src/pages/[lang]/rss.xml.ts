// oxlint-disable typescript/no-unsafe-member-access, typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-type-assertion, typescript/explicit-function-return-type, require-await, typescript/no-unsafe-argument, typescript/no-unsafe-return -- Astro RSS endpoint with framework-dictated patterns
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

/** Static path params for Astro's per-language RSS route generation. */
type StaticPath = { params: { lang: string; }; };

/**
 * Generates one static path per available language for the RSS feed.
 *
 * @returns static path entries with language params
 */
export async function getStaticPaths(): Promise<StaticPath[]> { return langs.map(function langPath(lang: string,) { return {
    params: { lang, },
  }; }) }

/**
 * Astro API route handler that generates an RSS XML feed for a given language.
 *
 * @returns Response containing RSS XML content
 */
export function GET({ site, params, },) {
  const lang = params.lang as string;
  const siteUrl = site?.toString() ?? 'https://example.com';

  const rssXml = generateRssFeed({
    title: i18n.get('siteName',)?.get(lang,) ?? '',
    link: siteUrl,
    description: i18n.get('siteDescription',)?.get(lang,) ?? '',
    language: lang,
    items: (postsGroupedByLang[lang] ?? []).map(function toRssItem(langPost: Post,) { return {
      title: langPost.data.title,
      link: `${siteUrl}/${langPost.id}`,
      description: langPost.data.description,
      pubDate: langPost.data.published,
      categories: langPost.data.tags.map(function toCategory(tag: string,) { return { name: tag, }; }),
    }; }),
  },);

  return new Response(rssXml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  },);
}
