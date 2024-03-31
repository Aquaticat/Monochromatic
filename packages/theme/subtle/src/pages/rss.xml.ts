import rss from '@astrojs/rss';
import consts from '../../consts';
import c from '@monochromatic.dev/module-console';

export async function GET(context) {
  const posts = Object.values(import.meta.glob(['./post/**/*.mdx', './*/post/**/*.mdx'], { eager: true }));
  return rss({
    title: consts.title,
    description: consts.description,
    site: context.site,
    items: posts.map((post) => ({
      link: post.url,
      title: post.frontmattertitle,
      description: post.frontmatter.description,
      pubDate: post.frontmatter.published,
    })),
  });
}
