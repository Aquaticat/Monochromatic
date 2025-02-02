import rss from '@astrojs/rss';

import {
  i18n,
  langs,
  postsGroupedByLang,
} from '@_/index.ts';

export async function getStaticPaths() {
  return langs.map((lang) => ({
    params: { lang },
  }));
}

export function GET({ site, params }) {
  return rss({
    // `<title>` field in output xml
    title: i18n.get('siteName')!.get(params.lang)!,
    // `<description>` field in output xml
    description: i18n.get('siteDescription')!.get(params.lang)!,
    // Pull in your project "site" from the endpoint context
    // https://docs.astro.build/en/reference/api-reference/#site
    site: site,
    // Array of `<item>`s in output xml
    // See "Generating items" section for examples using content collections and glob imports
    items: postsGroupedByLang[params.lang]!.map((langPost) => ({
      title: langPost.data.title,
      pubDate: langPost.data.published,
      description: langPost.data.description,
      link: `/${langPost.id}`,
      categories: langPost.data.tags,
    })),
    // (optional) inject custom xml
    customData: `<language>${params.lang}</language>`,
  });
}
