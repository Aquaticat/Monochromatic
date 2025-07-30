import rss from '@astrojs/rss';
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

// eslint-disable-next-line require-await -- Astro requires async for getStaticPaths
export const getStaticPaths: GetStaticPaths = async () => {
  return langs.map((lang: string,) => ({
    params: { lang, },
  }));
};

export const GET: APIRoute = ({ site, params, },) => {
  const lang = params.lang as string;
  return rss({
    // `<title>` field in output xml
    title: i18n.get('siteName',)!.get(lang,)!,
    // `<description>` field in output xml
    description: i18n.get('siteDescription',)!.get(lang,)!,
    // Pull in your project "site" from the endpoint context
    // https://docs.astro.build/en/reference/api-reference/#site
    site: site,
    // Array of `<item>`s in output xml
    // See "Generating items" section for examples using content collections and glob imports
    items: postsGroupedByLang[lang]!.map((langPost: Post,) => ({
      title: langPost.data.title,
      pubDate: langPost.data.published,
      description: langPost.data.description,
      link: `/${langPost.id}`,
      categories: langPost.data.tags,
    })),
    // (optional) inject custom xml
    customData: `<language>${params.lang}</language>`,
  },);
};
