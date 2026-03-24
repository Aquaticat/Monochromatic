/**
 * Post grouping and filtering utilities.
 *
 * Provides functions to organize posts by language, slug name, and tag.
 * Used by the build pipeline to generate per-language and per-tag pages.
 */
// File justification: 104 lines -- grouping functions share the same type
// and patterns; splitting by-lang/by-name from by-tag would break cohesion.
import type { Post, } from './content.ts';

//region By language and name

/**
 * Groups posts by language code.
 *
 * @param posts - all loaded posts
 *
 * @returns record mapping language codes to their posts
 */
export function groupByLang(posts: readonly Post[],): Record<string, Post[]> {
  return Object.fromEntries(
    Map.groupBy(posts, function byLang(post,) {
      return post.lang;
    },),
  );
}

/**
 * Groups posts by slug name across all languages.
 *
 * @param posts - all loaded posts
 *
 * @returns record mapping post names to all language variants
 */
export function groupByName(posts: readonly Post[],): Record<string, Post[]> {
  return Object.fromEntries(
    Map.groupBy(posts, function byName(post,) {
      return post.name;
    },),
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
 */
export function groupByTag(posts: readonly Post[],): Record<string, Post[]> {
  const tags = allTags(posts,);
  return Object.fromEntries(
    tags.map(function tagEntry(tag,) {
      return [tag, posts.filter(function hasTag(post,) {
        return post.data.tags.includes(tag,);
      },),];
    },),
  );
}

/**
 * Groups posts first by language, then by tag within each language.
 *
 * @param posts - all loaded posts
 *
 * @returns nested record of lang \> tag \> posts
 */
export function groupByLangThenTag(
  posts: readonly Post[],
): Record<string, Record<string, Post[]>> {
  const byLang = groupByLang(posts,);
  const tags = allTags(posts,);

  return Object.fromEntries(
    Object.entries(byLang,).map(function langEntry([lang, langPosts,],) {
      return [
        lang,
        Object.fromEntries(
          tags.map(function tagEntry(tag,) {
            return [
              tag,
              langPosts.filter(function hasTag(post,) {
                return post.data.tags.includes(tag,);
              },),
            ];
          },),
        ),
      ];
    },),
  );
}

//endregion By tag
