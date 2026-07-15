/**
 * Search operation.
 *
 * Searches file paths and file contents within a directory using `rg`.
 * Always returns file-path matches first, then content matches.
 * Accepts an `AbortSignal` for cancellation when a newer search
 * supersedes a pending one.
 */

import { relative, } from 'node:path';

import type { SearchResult, } from '../../protocol.ts';
import {
  l as rootLogger,
  tagged,
} from '../log.ts';
import { streamRg, } from './stream-rg.ts';

/**
 * Tagged logger for the search subsystem.
 */
const l = tagged({
  tag: 'search',
  l: rootLogger,
},);

/**
 * Maximum number of file-path results returned.
 */
const MAX_FILE_RESULTS = 20;

/**
 * Maximum number of content-match results returned.
 */
const MAX_CONTENT_RESULTS = 30;

//region Types

/**
 * Result of a search operation.
 */
type SearchOperationResult = {
  /**
   * Combined search results (file-path matches first, then content matches).
   */
  readonly results: readonly SearchResult[];
};

/**
 * JSON shape of a `rg --json` match entry.
 * Only the fields we use are typed; the rest is ignored.
 */
type RgJsonMatch = {
  readonly type: 'match';
  readonly data: {
    readonly path: { readonly text: string; };
    readonly lines: { readonly text: string; };
    readonly line_number: number;
  };
};

//endregion Types

//region Helpers

/**
 * Returns true when `query` has at least one uppercase character.
 * Used for smart-case filtering: case-sensitive when query contains uppercase,
 * case-insensitive otherwise.
 *
 * @param query - search query string
 *
 * @returns whether the query contains an uppercase character
 */
function hasUpperCase({ query, }: { readonly query: string; },): boolean {
  return query !== query
    .toLowerCase();
}

//endregion Helpers

//region Search functions

/**
 * Searches for files whose relative path contains the query.
 * Uses smart-case: case-sensitive when query has uppercase, case-insensitive otherwise.
 *
 * @param rootDir - root directory for the search
 *
 * @param query - search query to match against relative file paths
 *
 * @param signal - optional abort signal for cancellation
 *
 * @returns file-path search results, capped at {@link MAX_FILE_RESULTS}
 */
function searchFiles({
  rootDir,
  query,
  signal,
}: {
  readonly rootDir: string;
  readonly query: string;
  readonly signal: AbortSignal | undefined;
},): Promise<SearchResult[]> {
  /**
   * Smart-case: an uppercase character in the query enables case sensitivity.
   */
  const caseSensitive = hasUpperCase({ query, },);
  /**
   * Pre-folded query so the per-line filter does not re-lowercase repeatedly.
   */
  const normalizedQuery = caseSensitive ? query : query.toLowerCase();

  return streamRg({
    args: [
      '--files',
      rootDir,
    ],
    maxResults: MAX_FILE_RESULTS,
    signal,
    processLine: function matchFilePath(line,) {
      /**
       * Relative form keeps the include-test scoped to the project tree, not the absolute path.
       */
      const relativePath = relative(
        rootDir,
        line,
      );
      /**
       * Case-folded copy aligned with {@link normalizedQuery} so `.includes` works symmetrically.
       */
      const candidate = caseSensitive ? relativePath : relativePath.toLowerCase();

      if (candidate.includes(normalizedQuery,)) {
        return {
          kind: 'file',
          path: line,
        };
      }

      return null;
    },
  },);
}

/**
 * Searches file contents for lines matching the query.
 * Uses `rg --json --smart-case --max-count 1` for one match per file.
 *
 * @param rootDir - root directory for the search
 *
 * @param query - search pattern for file contents
 *
 * @param signal - optional abort signal for cancellation
 *
 * @returns content search results, capped at {@link MAX_CONTENT_RESULTS}
 */
function searchContents({
  rootDir,
  query,
  signal,
}: {
  readonly rootDir: string;
  readonly query: string;
  readonly signal: AbortSignal | undefined;
},): Promise<SearchResult[]> {
  return streamRg({
    args: [
      '--json',
      '--smart-case',
      '--max-count',
      '1',
      '--',
      query,
      rootDir,
    ],
    maxResults: MAX_CONTENT_RESULTS,
    signal,
    processLine: function matchContent(line,) {
      try {
        /* oxlint-disable typescript-eslint/no-unsafe-type-assertion -- rg --json output is typed; we only process 'match' entries */
        /**
         * Untyped intermediate so the discriminant can be checked before narrowing.
         */
        const parsed = JSON.parse(line,) as RgJsonMatch | { readonly type: string; };
        /* oxlint-enable typescript-eslint/no-unsafe-type-assertion */
        if (parsed.type
          !== 'match')
          return null;

        /* oxlint-disable typescript-eslint/no-unsafe-type-assertion -- guarded by type check above */
        /**
         * Narrowed view used to read the rg `data` payload.
         */
        const match = parsed as RgJsonMatch;
        /* oxlint-enable typescript-eslint/no-unsafe-type-assertion */
        return {
          kind: 'content' as const,
          path: match.data
            .path
            .text,
          line: match.data
            .line_number,
          text: match.data
            .lines
            .text
            .trimEnd(),
        };
      }
      catch (error) {
        l.warn(`failed to parse rg JSON line: ${
          line.slice(
            0,
            100,
          )
        } (${String(error,)})`,);
        return null;
      }
    },
  },);
}

//endregion Search functions

//region Main export

/**
 * Searches for files and file contents matching the query.
 * Returns file-path matches first, then content matches.
 *
 * @param rootDir - root directory for path containment and search scope
 *
 * @param query - search query string
 *
 * @param signal - optional abort signal; aborts both rg processes when triggered
 *
 * @returns search results with file-path matches before content matches
 *
 * @throws when `rg` is not installed or encounters an unexpected error
 *
 * @example
 * ```ts
 * const { results } = await search({ rootDir: '/project', query: 'index' });
 * // results: [{ kind: 'file', path: '/project/src/index.ts' }, { kind: 'content', ... }]
 * ```
 */
export async function search({
  rootDir,
  query,
  signal,
}: {
  readonly rootDir: string;
  readonly query: string;
  readonly signal?: AbortSignal;
},): Promise<SearchOperationResult> {
  l.info(`searching for "${query}"`,);

  /**
   * File-path search runs concurrently with the content search to halve wall time.
   */
  const [files, contents,] = await Promise.all([
    searchFiles({
      rootDir,
      query,
      signal,
    },),
    searchContents({
      rootDir,
      query,
      signal,
    },),
  ],);

  return { results: [
    ...files,
    ...contents,
  ], };
}

//endregion Main export
