/**
 * Content loading and organization for MDX blog posts.
 *
 * Globs MDX files from `src/content/{lang}/`, parses YAML frontmatter with
 * gray-matter, validates with Zod, and provides grouping utilities.
 * Filesystem paths give `lang` and `name` directly — no string splitting needed.
 */
import { readFile, } from 'node:fs/promises';
import { basename, dirname, } from 'node:path';

import matter from 'gray-matter';
import readdir from 'tiny-readdir-glob';
import { z, } from 'zod';

//region Schema

/** Zod schema for MDX post frontmatter validation. */
const postFrontmatterSchema = z.object({
  title: z.string(),
  description: z.string(),
  published: z.date(),
  updated: z.date(),
  tags: z.array(z.string(),),
},);

/** Validated frontmatter fields for a blog post. */
export type PostFrontmatter = z.infer<typeof postFrontmatterSchema>;

//endregion Schema

//region Types

/** Blog post with parsed frontmatter and extracted path metadata. */
export type Post = {
  /** Two-letter language code derived from parent directory name. */
  lang: string;
  /** Post slug derived from filename without extension. */
  name: string;
  /** Validated frontmatter data. */
  data: PostFrontmatter;
  /** Raw MDX body content (frontmatter stripped). */
  body: string;
  /** Absolute path to the source MDX file. */
  filePath: string;
};

//endregion Types

//region Loading

/**
 * Loads all MDX posts from the content directory.
 *
 * Globs `src/content` for `.mdx` files, extracts `lang` from the parent
 * directory name and `name` from the filename (minus extension).
 *
 * @param contentDir - path to content directory containing `{lang}/*.mdx`
 *
 * @returns array of parsed and validated posts
 *
 * @throws on frontmatter validation failure
 */
export async function loadContent(contentDir: string,): Promise<Post[]> {
  const result = await readdir(
    `${contentDir}/**/*.mdx`,
  );
  const filePaths = result.files;

  const posts = await Promise.all(filePaths.map(async function parsePost(filePath,) {
    const raw = await readFile(filePath, 'utf8',);
    const { data: rawData, content: body, } = matter(raw,);
    const data = postFrontmatterSchema.parse(rawData,);
    const lang = basename(dirname(filePath,),);
    const name = basename(filePath, '.mdx',);

    return { lang, name, data, body, filePath, };
  },),);

  return posts;
}

//endregion Loading

//region Grouping

/**
 * Groups posts by language code.
 *
 * @param posts - all loaded posts
 *
 * @returns record mapping language codes to their posts
 */
export function groupByLang(posts: Post[],): Record<string, Post[]> {
  return Object.groupBy(posts, function byLang(post,) {
    return post.lang;
  },) as Record<string, Post[]>;
}

/**
 * Groups posts by slug name across all languages.
 *
 * @param posts - all loaded posts
 *
 * @returns record mapping post names to all language variants
 */
export function groupByName(posts: Post[],): Record<string, Post[]> {
  return Object.groupBy(posts, function byName(post,) {
    return post.name;
  },) as Record<string, Post[]>;
}

/**
 * Extracts all unique tags across all posts.
 *
 * @param posts - all loaded posts
 *
 * @returns deduplicated array of tag strings
 */
export function allTags(posts: Post[],): string[] {
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
export function groupByTag(posts: Post[],): Record<string, Post[]> {
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
 * @returns nested record of lang -> tag -> posts
 */
export function groupByLangThenTag(
  posts: Post[],
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

//endregion Grouping
