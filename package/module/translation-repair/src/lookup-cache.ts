import { createHash, } from 'node:crypto';
import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { homedir, } from 'node:os';
import { join, } from 'node:path';

import { tagged, } from '@monochromatic-dev/module-logger/ts';

//region Lookup cache
// Durable cache of web lookups, across runs and entries.
//
// WHY DURABLE. The owner, 2026-09-02: "Looking up official translations and
// the like can and should be cached." A title is bought once; a resumed run
// reads the same lines and so keeps its preparation identity, which hashes the
// identity context the lines join. The per-launch runs directory is exactly
// the place that would re-buy every title per launch, so the cache lives under
// the user's cache home instead, overridable for tests.

/**
 * Logger root for the cache.
 */
const l = tagged({ tag: 'translation-repair', },);

/**
 * Environment variable overriding where lookups are cached.
 */
export const LOOKUP_CACHE_DIR_VAR = 'TRANSLATION_REPAIR_LOOKUP_CACHE_DIR';

/**
 * One result the lookup keeps.
 *
 * @example
 * ```ts
 * const hit: LookupHit = { title: 'To Live (novel) - Wikipedia', url: 'https://en.wikipedia.org/wiki/To_Live_(novel)', highlight: 'To Live is a novel by Yu Hua...', };
 * ```
 */
export type LookupHit = {
  readonly title: string;
  readonly url: string;
  readonly highlight: string;
};

/**
 * What the cache stores for one query.
 *
 * @example
 * ```ts
 * const record: LookupRecord = { query: '《活着》 official English title', fetchedAt: '2026-09-02T10:00:00.000Z', hits: [], };
 * ```
 */
export type LookupRecord = {
  readonly query: string;
  readonly fetchedAt: string;
  readonly hits: readonly LookupHit[];
};

/**
 * What a cache read answers: the record, or that there is none.
 *
 * @example
 * ```ts
 * const answer: CachedLookup = { kind: 'miss', };
 * ```
 */
export type CachedLookup =
  | {
    readonly kind: 'hit';
    readonly record: LookupRecord;
  }
  | { readonly kind: 'miss'; };

/**
 * Cache directory, from the override or the user's cache home.
 *
 * @param env - environment to read
 *
 * @returns Directory lookups are cached in
 *
 * @example
 * ```ts
 * lookupCacheDir({ env: process.env, },);
 * ```
 */
export function lookupCacheDir(
  { env, }: { readonly env: Readonly<NodeJS.ProcessEnv>; },
): string {
  /**
   * Explicit override when set and non-empty.
   */
  const override = env[LOOKUP_CACHE_DIR_VAR] ?? '';
  if (override !== '')
    return override;
  /**
   * XDG cache home when set, the conventional default otherwise.
   */
  const cacheHome = env.XDG_CACHE_HOME ?? '';
  /**
   * Base the cache sits under.
   */
  const base = (cacheHome === '')
    ? join(
      homedir(),
      '.cache',
    )
    : cacheHome;
  return join(
    base,
    'translation-repair',
    'lookup',
  );
}

/**
 * Cache file for one query.
 *
 * @param dir - cache directory
 *
 * @param query - query the record answers
 *
 * @returns Path named by the query's digest
 *
 * @example
 * ```ts
 * lookupCachePath({ dir, query: '《活着》 official English title', },);
 * ```
 */
export function lookupCachePath(
  {
    dir,
    query,
  }: {
    readonly dir: string;
    readonly query: string;
  },
): string {
  /**
   * Digest naming the file, so any query is a safe file name.
   */
  const digest = createHash('sha256',)
    .update(
      query,
      'utf8',
    )
    .digest('hex',);
  return join(
    dir,
    `${digest}.json`,
  );
}

/**
 * Whether a parsed value is one hit.
 *
 * @param value - element of a record's hits
 *
 * @returns Whether it carries the three strings
 *
 * @example
 * ```ts
 * isLookupHit({ title: 'a', url: 'https://x', highlight: '', },);
 * // => true
 * ```
 */
export function isLookupHit(value: unknown,): value is LookupHit {
  if (((typeof value) !== 'object') || (value === null))
    return false;
  /**
   * Candidate fields.
   */
  const hit = value as {
    readonly title?: unknown;
    readonly url?: unknown;
    readonly highlight?: unknown;
  };
  return ((typeof hit.title) === 'string')
    && ((typeof hit.url) === 'string')
    && ((typeof hit.highlight) === 'string');
}

/**
 * Whether a parsed value is a cache record.
 *
 * @param value - parsed JSON
 *
 * @returns Whether it carries a query, a time and hits of the right shape
 *
 * @example
 * ```ts
 * if (isLookupRecord(JSON.parse(text,),)) { }
 * ```
 */
export function isLookupRecord(value: unknown,): value is LookupRecord {
  if (((typeof value) !== 'object') || (value === null))
    return false;
  /**
   * Candidate fields.
   */
  const record = value as {
    readonly query?: unknown;
    readonly fetchedAt?: unknown;
    readonly hits?: unknown;
  };
  if (!Array.isArray(record.hits,))
    return false;
  /**
   * Hits as unknowns, each checked.
   */
  const hits: readonly unknown[] = record.hits;
  return ((typeof record.query) === 'string')
    && ((typeof record.fetchedAt) === 'string')
    && hits.every(isLookupHit,);
}

/**
 * File text, or nothing when the file cannot be read.
 *
 * @param path - file to read
 *
 * @returns Text, or an empty string for a file that is not there
 *
 * @example
 * ```ts
 * const text = await textOrNothing({ path, },);
 * ```
 */
async function textOrNothing(
  { path, }: { readonly path: string; },
): Promise<string> {
  /**
   * Logger pre-tagged with this function's name.
   */
  const rl = tagged({
    tag: textOrNothing.name,
    l,
  },);
  try {
    return await readFile(
      path,
      'utf8',
    );
  } catch (error) {
    rl.debug(`no cached lookup at ${path}: ${String(error,)}`,);
    return '';
  }
}

/**
 * Reads the cached record for a query.
 *
 * @param dir - cache directory
 *
 * @param query - query to look for
 *
 * @returns The record, or a miss when the file is absent or is not a record
 *
 * @example
 * ```ts
 * const cached = await readCachedLookup({ dir, query, },);
 * ```
 */
export async function readCachedLookup(
  {
    dir,
    query,
  }: {
    readonly dir: string;
    readonly query: string;
  },
): Promise<CachedLookup> {
  /**
   * Logger pre-tagged with this function's name.
   */
  const rl = tagged({
    tag: readCachedLookup.name,
    l,
  },);
  /**
   * File the record would be in.
   */
  const path = lookupCachePath({
    dir,
    query,
  },);
  /**
   * File text, empty when absent.
   */
  const text = await textOrNothing({ path, },);
  if (text === '')
    return { kind: 'miss', };
  /**
   * Parsed record, refused when the file is not one.
   */
  const parsed: unknown = JSON.parse(text,);
  if (!isLookupRecord(parsed,)) {
    rl.warn(`cached lookup at ${path} is not a record; ignoring it`,);
    return { kind: 'miss', };
  }
  return {
    kind: 'hit',
    record: parsed,
  };
}

/**
 * Writes a record for its query.
 *
 * @param dir - cache directory, created when missing
 *
 * @param record - record to keep
 *
 * @example
 * ```ts
 * await writeCachedLookup({ dir, record, },);
 * ```
 */
export async function writeCachedLookup(
  {
    dir,
    record,
  }: {
    readonly dir: string;
    readonly record: LookupRecord;
  },
): Promise<void> {
  await mkdir(
    dir,
    { recursive: true, },
  );
  /**
   * Pretty JSON, so a reader can open the file.
   */
  const text = JSON.stringify(
    record,
    null,
    2,
  );
  await writeFile(
    lookupCachePath({
      dir,
      query: record.query,
    },),
    `${text}\n`,
    'utf8',
  );
}

//endregion Lookup cache
