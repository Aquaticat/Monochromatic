import rss from '@astrojs/rss';
import { TITLE, DESCRIPTION } from '../consts';

export async function GET(context) {
  const posts = Object.values(import.meta.glob(['./post/**/*.mdx', './*/post/**/*.mdx'], { eager: true }));
  return rss({
    title: TITLE,
    description: DESCRIPTION,
    site: context.site,
    items: posts.map((post) => ({
      link: post.url,
      title: post.frontmattertitle,
      description: post.frontmatter.description,
      pubDate: post.frontmatter.published,
    })),
  });
}
