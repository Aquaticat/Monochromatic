/**
 * Post grouping and filtering utilities.
 *
 * Provides functions to organize posts by language, slug name, and tag.
 * Used by the build pipeline to generate per-language and per-tag pages.
 */
// File justification: 104 lines -- grouping functions share the same type
// and patterns; splitting by-lang/by-name from by-tag would break cohesion.
import type { Locales, } from '../i18n/i18n-types.ts';

import type { Post, } from './content.ts';

//region By language and name

/**
 * Groups posts by language code.
 *
 * @param posts - all loaded posts
 *
 * @returns record mapping language codes to their posts
 *
 * @example
 * ```ts
 * const byLang = groupByLang(posts);
 * // { en: [...], fr: [...] }
 * ```
 */
export function groupByLang(posts: readonly Post[],): Partial<Record<Locales, Post[]>> {
  return Object.fromEntries(
    Map.groupBy(
      posts,
      function byLang(post,) {
        return post.lang;
      },
    ),
  );
}

/**
 * Groups posts by slug name across all languages.
 *
 * @param posts - all loaded posts
 *
 * @returns record mapping post names to all language variants
 *
 * @example
 * ```ts
 * const byName = groupByName(posts);
 * // { 'hello-world': [enPost, frPost] }
 * ```
 */
export function groupByName(posts: readonly Post[],): Record<string, Post[]> {
  return Object.fromEntries(
    Map.groupBy(
      posts,
      function byName(post,) {
        return post.name;
      },
    ),
  );
}

//endregion By language and name

//region By tag

/**
 * Extracts all unique tags across all posts.
 *
 * @param posts - all loaded posts
 *
 * @returns deduplicated array of tag strings
 *
 * @example
 * ```ts
 * const tags = allTags(posts);
 * // ['typescript', 'css', 'web']
 * ```
 */
export function allTags(posts: readonly Post[],): string[] {
  return [...new Set(posts.flatMap(function getTags(post,) {
    return post.data.tags;
  },),),];
}

/**
 * Groups posts by tag, where each tag maps to its matching posts.
 *
 * @param posts - all loaded posts
 *
 * @returns record mapping tags to posts containing that tag
 *
 * @example
 * ```ts
 * const byTag = groupByTag(posts);
 * // { typescript: [...], css: [...] }
 * ```
 */
export function groupByTag(posts: readonly Post[],): Record<string, Post[]> {
  const tags = allTags(posts,);
  return Object.fromEntries(
    tags.map(function tagEntry(tag,) {
      return [
        tag,
        posts.filter(function hasTag(post,) {
          return post.data.tags.includes(tag,);
        },),
      ];
    },),
  );
}

/**
 * Groups posts first by language, then by tag within each language.
 *
 * Uses per-language tag sets so each language only contains tags
 * that actually have posts in that language, avoiding empty arrays
 * for tags that only exist in other languages.
 *
 * @param posts - all loaded posts
 *
 * @returns nested record of lang \> tag \> posts
 *
 * @example
 * ```ts
 * const grouped = groupByLangThenTag(posts);
 * // { en: { typescript: [...], css: [...] }, zh: { ... } }
 * ```
 */
export function groupByLangThenTag(
  posts: readonly Post[],
): Partial<Record<Locales, Record<string, Post[]>>> {
  const byLang = groupByLang(posts,);

  return Object.fromEntries(
    Object.entries(byLang,).map(function langEntry([lang, langPosts,],) {
      return [
        lang,
        groupByTag(langPosts,),
      ];
    },),
  );
}

//endregion By tag
