/**
 * HTML page generation for the SSG build.
 *
 * Generates all HTML pages from posts and rendered content,
 * writing each to the dist directory.
 */
import { $ as tagged, } from '@monochromatic-dev/module-es/tagged';

import {
  groupByLang,
  groupByName,
} from '../lib/content-group.ts';
import type { Post, } from '../lib/content.ts';
import type { Logger, } from '../lib/types.ts';
import { indexPage, } from '../pages/index.ts';
import { langPage, } from '../pages/lang.ts';
import { namePage, } from '../pages/name.ts';
import { postPage, } from '../pages/post.ts';
import { writePage, } from './write-page.ts';

/**
 * Generates all HTML pages from posts and rendered content.
 *
 * @param posts - all loaded posts
 *
 * @param renderedContent - map of `lang/name` to rendered HTML
 *
 * @param l - parent logger for tagged output
 */
export async function generatePages(
  { posts, renderedContent, l: parentLogger, }: {
    posts: readonly Post[];
    renderedContent: ReadonlyMap<string, string>;
    l: Logger;
  },
): Promise<void> {
  const l = tagged({ tag: generatePages.name, l: parentLogger, },);
  const byLang = groupByLang(posts,);
  const byName = groupByName(posts,);
  const langs = Object.keys(byLang,);
  const names = Object.keys(byName,);

  const writes = [
    writePage({ relativePath: 'index.html', content: indexPage(langs,), },),
    ...langs.flatMap(function langWrites(lang,) {
      const langPosts = byLang[lang] ?? [];
      return [
        writePage({
          relativePath: `${lang}/index.html`,
          content: langPage({ lang, posts: langPosts, },),
        },),
        ...names.map(function postWrite(name,) {
          const post = langPosts.find(function matchName(lp,) {
            return lp.name === name;
          },);
          const html = renderedContent.get(`${lang}/${name}`,);
          return writePage({
            relativePath: `${lang}/${name}.html`,
            content: postPage({ post, lang, name, renderedHtml: html, },),
          },);
        },),
      ];
    },),
    ...names.map(function nameWrite(name,) {
      const namePosts = byName[name] ?? [];
      return writePage({
        relativePath: `${name}.html`,
        content: namePage({ name, posts: namePosts, },),
      },);
    },),
  ];

  await Promise.all(writes,);
  l.info(`generated ${writes.length} pages`,);
}
