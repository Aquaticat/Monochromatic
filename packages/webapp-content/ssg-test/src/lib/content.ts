/**
 * Content loading and organization for MDX blog posts.
 *
 * Globs MDX files from `src/content/{lang}/`, parses YAML frontmatter with
 * gray-matter, validates with Zod, and provides grouping utilities.
 * Filesystem paths give `lang` and `name` directly -- no string splitting needed.
 */
import { readFile, } from 'node:fs/promises';
import { basename, dirname, } from 'node:path';

import matter from 'gray-matter';
import readdir from 'tiny-readdir-glob';
import { z, } from 'zod';

import { sha256, } from './cache-hash.ts';

//region Schema

/**
 * Zod schema for MDX post frontmatter validation.
 *
 * Uses `z.coerce.date()` so the same schema handles both native `Date`
 * objects (from gray-matter YAML parsing) and ISO date strings (from
 * JSON-serialized cache entries).
 */
export const postFrontmatterSchema = z.object({
  title: z.string(),
  description: z.string(),
  published: z.coerce.date(),
  updated: z.coerce.date(),
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
  /** SHA-256 hex digest of the raw file contents, computed during loading. */
  contentHash: string;
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
    const contentHash = sha256(raw,);
    const { data: rawData, content: body, } = matter(raw,);
    const data = postFrontmatterSchema.parse(rawData,);
    const lang = basename(dirname(filePath,),);
    const name = basename(filePath, '.mdx',);

    return { lang, name, data, body, filePath, contentHash, };
  },),);

  return posts;
}

//endregion Loading
