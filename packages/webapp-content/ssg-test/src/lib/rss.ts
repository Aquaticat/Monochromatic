/**
 * RSS feed generation per language.
 *
 * Uses feedsmith to produce RSS 2.0 XML for each language's post collection.
 */
import { generateRssFeed, } from 'feedsmith';

import type { Post, } from './content.ts';
import { t, } from './i18n.ts';

/**
 * Generates an RSS 2.0 XML feed for a specific language.
 *
 * @param lang - two-letter language code
 *
 * @param posts - posts filtered to the target language
 *
 * @param siteUrl - base URL of the site (e.g. `https://aquati.cat`)
 *
 * @returns RSS XML string
 *
 * @example
 * ```ts
 * const xml = generateLanguageRss({ lang: 'en', posts: enPosts, siteUrl: 'https://aquati.cat' });
 * ```
 */
export function generateLanguageRss(
  { lang, posts, siteUrl, }: {
    lang: string;
    posts: readonly Post[];
    siteUrl: string;
  },
): string {
  return generateRssFeed({
    title: t('siteName', lang,),
    link: siteUrl,
    description: t('siteDescription', lang,),
    language: lang,
    items: posts.map(function toRssItem(post,) {
      return {
        title: post.data.title,
        link: `${siteUrl}/${lang}/${post.name}`,
        description: post.data.description,
        pubDate: post.data.published,
        categories: post.data.tags.map(function toCategory(tag,) {
          return { name: tag, };
        },),
      };
    },),
  },);
}
