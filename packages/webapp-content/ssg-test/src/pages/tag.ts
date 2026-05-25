/**
 * Per-tag post listing page.
 *
 * Displays all posts in a given language that carry a specific tag,
 * rendered as a post grid identical to the language landing page.
 */
import { hHtml as h, } from '@monochromatic-dev/module-hyperscript/ts';

import type { Locales, } from '../i18n/i18n-types.ts';
import { i18nObject, } from '../i18n/i18n-util.ts';

import { html as postListHtml, } from '../components/post-list.ts';
import type { Post, } from '../lib/content.ts';
import { pageLayout, } from '../templates/layout.ts';

/**
 * Generates a page listing all posts with a specific tag in one language.
 *
 * @param tag - tag string to filter by
 *
 * @param lang - language code
 *
 * @param posts - posts already filtered to this language and tag
 *
 * @param canonicalUrl - full canonical URL for this page
 *
 * @returns complete HTML document for the tag page
 *
 * @example
 * ```ts
 * const html = tagPage({
 *   tag: 'typescript',
 *   lang: 'en',
 *   posts: tsPosts,
 *   canonicalUrl: 'https://aquati.cat/en/tag/typescript',
 * });
 * ```
 */
export function tagPage(
  {
    tag,
    lang,
    posts,
    canonicalUrl,
  }: {
    readonly tag: string;
    readonly lang: Locales;
    readonly posts: readonly Post[];
    readonly canonicalUrl: string;
  },
): string {
  /** Locale-bound translator reused for head meta strings on the tag page. */
  const t = i18nObject(lang,);
  /** Hash-prefixed tag label rendered as the page heading. */
  const title = `#${tag}`;

  /** Main element tree composed before the page layout wraps it with `<head>` and friends. */
  const content = h({
    tag: 'main',
    children: [
      h({
        tag: 'h1',
        text: title,
      },),
      h({
        tag: 'section',
        html: postListHtml(posts,),
      },),
    ],
  },);

  return pageLayout({
    title,
    lang,
    content,
    description: `${t.siteDescription()}: ${tag}`,
    canonicalUrl,
  },);
}
