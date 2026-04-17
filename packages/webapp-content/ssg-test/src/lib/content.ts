/**
 * Content loading and organization for MDX blog posts.
 *
 * Globs MDX files from `src/content/{lang}/`, parses YAML frontmatter with
 * an inline parser backed by the `yaml` package, validates with Zod, and
 * provides grouping utilities.
 * Filesystem paths give `lang` and `name` directly -- no string splitting needed.
 *
 * Uses a custom frontmatter parser instead of `gray-matter` because `gray-matter`
 * pulls in a large dependency tree and uses `eval` internally (via `js-yaml`'s
 * unsafe loading), which is both a security concern and unnecessary for trusted
 * YAML-only frontmatter.
 */
import { readFile } from "node:fs/promises";
import { basename, dirname } from "node:path";

import readdir from "tiny-readdir-glob";
import { parse as parseYaml } from "yaml";
import * as z from "zod/mini";

import type { Locales } from "../i18n/i18n-types.ts";
import { isLocale } from "../i18n/i18n-util.ts";

import { sha256 } from "./cache-hash.ts";

//region Frontmatter

/** Opening delimiter for YAML frontmatter blocks. */
const FRONTMATTER_OPEN = "---";

/** Unicode Byte Order Mark code point, stripped from file content before parsing. */
const BOM = 0xfe_ff;

/**
 * Parses YAML frontmatter delimited by `---` from a raw string.
 *
 * Splits at the first two `---` lines to extract the YAML block and body.
 * Returns empty data when no valid frontmatter is found.
 *
 * @param raw - full file content including frontmatter
 *
 * @returns parsed YAML data and remaining body content
 *
 * @example
 * ```ts
 * const { data, content } = parseFrontmatter('---\ntitle: Hello\n---\nbody');
 * // data = { title: 'Hello' }, content = 'body'
 * ```
 */
function parseFrontmatter(raw: string): {
  data: Record<string, unknown>;
  content: string;
} {
  /* Strip optional leading BOM. */
  const str = raw.codePointAt(0) === BOM ? raw.slice(1) : raw;

  if (!str.startsWith(FRONTMATTER_OPEN)) {
    return {
      data: {},
      content: str,
    };
  }

  /* Skip past the opening `---` and its trailing newline. */
  const afterOpen = str.indexOf("\n", FRONTMATTER_OPEN.length);
  if (afterOpen === -1) {
    return {
      data: {},
      content: str,
    };
  }

  /**
   * Scan for the closing `---` that sits at the start of a line.
   * Start searching from the character right after the first newline.
   */
  const searchFrom = afterOpen + 1;
  let closeStart = searchFrom;

  for (;;) {
    const idx = str.indexOf(FRONTMATTER_OPEN, closeStart);
    if (idx === -1) {
      return {
        data: {},
        content: str,
      };
    }

    /* The delimiter must be at column 0 or immediately after a newline. */
    if (idx === 0 || str[idx - 1] === "\n") {
      const afterDelim = idx + FRONTMATTER_OPEN.length;

      /* Next char must be a newline or EOF for a valid closing fence. */
      if (
        afterDelim === str.length ||
        str[afterDelim] === "\n" ||
        str[afterDelim] === "\r"
      ) {
        const yamlBlock = str.slice(searchFrom, idx);
        let bodyStart = afterDelim;
        if (str[bodyStart] === "\r") bodyStart += 1;
        if (str[bodyStart] === "\n") bodyStart += 1;

        return {
          // oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion) -- parseYaml returns `any`; runtime validation follows via zod schema
          data: (parseYaml(yamlBlock) ?? {}) as Record<string, unknown>,
          content: str.slice(bodyStart),
        };
      }
    }

    closeStart = idx + 1;
  }
}

//endregion Frontmatter

//region Schema

/**
 * Zod schema for the author-written portion of MDX post frontmatter.
 *
 * Covers only the fields the human writes in the YAML header.
 * Publication and update dates are derived from git history at build
 * time rather than stored in frontmatter; see `./git-dates.ts`.
 */
export const postFileFrontmatterSchema: z.ZodMiniObject = z.object({
  title: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
});

/**
 * Zod schema for the fully-resolved post frontmatter used downstream
 * (rendering, RSS, sort keys).
 *
 * Combines the author-written file schema with `published`/`updated`
 * dates resolved by `./git-dates.ts`. Uses `z.coerce.date()` so the
 * same schema validates both native `Date` objects (from freshly
 * derived dates) and ISO strings (from JSON-deserialized cache entries).
 */
export const postFrontmatterSchema: z.ZodMiniObject = z.object({
  title: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  published: z.coerce.date(),
  updated: z.coerce.date(),
});

//endregion Schema

//region Types

/** Fully-resolved frontmatter as carried by `Post.data`. */
export type PostFrontmatter = {
  title: string;
  description: string;
  tags: string[];
  published: Date;
  updated: Date;
};

/**
 * Post loaded from disk with author-written frontmatter validated,
 * but `published`/`updated` not yet resolved.
 *
 * Returned by `loadContent`. Downstream consumers receive fully-resolved
 * `Post` objects built by `attachDates` after git dates are derived.
 */
export type LoadedPost = {
  /** Two-letter language code derived from parent directory name, validated against known locales. */
  lang: Locales;
  /** Post slug derived from filename without extension. */
  name: string;
  /** Validated author-written frontmatter (title, description, tags). */
  fileData: {
    title: string;
    description: string;
    tags: string[];
  };
  /** Raw MDX body content (frontmatter stripped). */
  body: string;
  /** Absolute path to the source MDX file. */
  filePath: string;
  /** SHA-256 hex digest of the raw file contents, computed during loading. */
  contentHash: string;
};

/** Blog post with fully-resolved frontmatter (author-written + git-derived dates). */
export type Post = {
  /** Two-letter language code derived from parent directory name, validated against known locales. */
  lang: Locales;
  /** Post slug derived from filename without extension. */
  name: string;
  /** Fully-resolved frontmatter data. */
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
 * Does not resolve `published`/`updated` -- those are derived from git
 * separately by `./git-dates.ts` and attached via `attachDates`.
 *
 * @param contentDir - path to content directory containing `{lang}/*.mdx`
 *
 * @returns array of loaded posts awaiting date resolution
 *
 * @throws on frontmatter validation failure
 *
 * @example
 * ```ts
 * const loaded = await loadContent('src/content');
 * ```
 */
export async function loadContent(contentDir: string): Promise<LoadedPost[]> {
  const result = await readdir(`${contentDir}/**/*.mdx`);
  const filePaths = result.files;

  return Promise.all(
    filePaths.map(async function parsePost(filePath) {
      const raw = await readFile(filePath, "utf8");
      const contentHash = sha256(raw);
      const { data: rawData, content: body } = parseFrontmatter(raw);
      // oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion) -- `postFileFrontmatterSchema` is annotated as the loose `z.ZodMiniObject`; the runtime-validated shape matches LoadedPost['fileData']
      const fileData = z.parse(
        postFileFrontmatterSchema,
        rawData,
      ) as LoadedPost['fileData'];
      const rawLang = basename(dirname(filePath));
      if (!isLocale(rawLang)) {
        throw new Error(
          `Unknown locale "${rawLang}" for ${filePath}. Expected one of the configured locales.`,
        );
      }
      const lang: Locales = rawLang;
      const name = basename(filePath, ".mdx");

      return {
        lang,
        name,
        fileData,
        body,
        filePath,
        contentHash,
      };
    }),
  );
}

/** Derived dates for one post, keyed by absolute file path in `attachDates`. */
export type ResolvedDates = {
  published: Date;
  updated: Date;
};

/**
 * Combines loaded posts with resolved git dates and returns sorted `Post[]`.
 *
 * The caller (typically `build.ts`) is responsible for producing the
 * `datesByFilePath` map -- either from cache (when HEAD is unchanged)
 * or by calling `getPostDates` for files missing from the cache.
 *
 * Posts are returned sorted by `updated` descending, matching the previous
 * behavior of the combined loader.
 *
 * @param loadedPosts - posts produced by `loadContent`
 *
 * @param datesByFilePath - map from absolute file path to resolved dates
 *
 * @returns fully-resolved posts, sorted by `updated` descending
 *
 * @throws when a loaded post has no entry in `datesByFilePath`
 *
 * @example
 * ```ts
 * const posts = attachDates({ loadedPosts, datesByFilePath });
 * ```
 */
export function attachDates(
  {
    loadedPosts,
    datesByFilePath,
  }: {
    loadedPosts: readonly LoadedPost[];
    datesByFilePath: ReadonlyMap<string, ResolvedDates>;
  },
): Post[] {
  const posts: Post[] = loadedPosts.map(function toPost(lp) {
    const dates = datesByFilePath.get(lp.filePath);
    if (dates === undefined) {
      throw new Error(
        `Missing resolved dates for ${lp.filePath}. Caller must populate datesByFilePath for every loaded post.`,
      );
    }
    return {
      lang: lp.lang,
      name: lp.name,
      data: {
        title: lp.fileData.title,
        description: lp.fileData.description,
        tags: lp.fileData.tags,
        published: dates.published,
        updated: dates.updated,
      },
      body: lp.body,
      filePath: lp.filePath,
      contentHash: lp.contentHash,
    };
  });

  return posts.toSorted(function byUpdatedDesc(a, b) {
    return b.data.updated.getTime() - a.data.updated.getTime();
  });
}

//endregion Loading
