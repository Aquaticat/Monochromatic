//region Reference cache
// Where a fetched page is kept, once per url, for every later run. The
// owner's rule of 2026-09-16 with the decision to fetch cited references:
// "Such Exa fetched results need to be cached too to avoid hitting reference
// links too much." A subdirectory of the work-title lookup cache, keyed by
// the url's digest, never expiring (the owner, same day: "Cache Exa results
// semi-permanently on disk since the reference links rarely change their
// content"); a record is refreshed only by deleting its file.

import { createHash, } from 'node:crypto';
import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { isJsonRecord, } from './json-guard.ts';
import { lookupCacheDir, } from './lookup-cache.ts';

/**
 Logger root for the cache.
 */
const l = tagged({ tag: 'translation-repair', },);

/**
 Subdirectory of the lookup cache the references live in.
 */
export const REFERENCE_CACHE_SUBDIR = 'reference';

/**
 What the cache stores for one url: what the fetch yielded and when.

 @example
 ```ts
 const record: ReferenceRecord = { url: 'https://a.example/post', fetchedAt: '2026-09-16T16:00:00.000Z', status: 'success', title: 'Post', text: '...', };
 ```
 */
export type ReferenceRecord = {
  /**
   Page as the original links it.
   */
  readonly url: string;
  /**
   When it was bought.
   */
  readonly fetchedAt: string;
  /**
   Whether the endpoint could read the page.
   */
  readonly status: 'success' | 'error';
  /**
   Page title, empty when none.
   */
  readonly title: string;
  /**
   Page text, empty on failure.
   */
  readonly text: string;
  /**
   Endpoint's error tag, present only on failure.
   */
  readonly failure?: string;
};

/**
 What a cache read answers: the record, or that there is none.

 @example
 ```ts
 const answer: CachedReference = { kind: 'miss', };
 ```
 */
export type CachedReference =
  | {
    readonly kind: 'hit';
    readonly record: ReferenceRecord;
  }
  | { readonly kind: 'miss'; };

/**
 Cache directory: the lookup cache's reference subdirectory, so the lookup
 override and the XDG rule both carry over.

 @param env - environment to read

 @returns Directory references are cached in

 @example
 ```ts
 referenceCacheDir({ env: process.env, },);
 ```
 */
export function referenceCacheDir(
  { env, }: { readonly env: Readonly<NodeJS.ProcessEnv>; },
): string {
  return join(
    lookupCacheDir({ env, },),
    REFERENCE_CACHE_SUBDIR,
  );
}

/**
 Cache file for one url.

 @param dir - cache directory

 @param url - page the record answers for

 @returns Path named by the url's digest

 @example
 ```ts
 referenceCachePath({ dir, url: 'https://a.example/post', },);
 ```
 */
export function referenceCachePath(
  {
    dir,
    url,
  }: {
    readonly dir: string;
    readonly url: string;
  },
): string {
  /**
   Digest naming the file, so any url is a safe file name.
   */
  const digest = createHash('sha256',)
    .update(
      url,
      'utf8',
    )
    .digest('hex',);
  return join(
    dir,
    `${digest}.json`,
  );
}

/**
 Whether a parsed value is a cache record.

 @param value - parsed JSON

 @returns Whether it carries a url, a time, a status, a title and text of
 the right shapes

 @example
 ```ts
 if (isReferenceRecord(JSON.parse(text,),)) { }
 ```
 */
export function isReferenceRecord(value: unknown,): value is ReferenceRecord {
  if (!isJsonRecord(value,))
    return false;
  /**
   Whether the optional failure is text when present.
   */
  const failureShaped = (value.failure === undefined) || ((typeof value.failure) === 'string');
  return ((typeof value.url) === 'string')
    && ((typeof value.fetchedAt) === 'string')
    && ((value.status === 'success') || (value.status === 'error'))
    && ((typeof value.title) === 'string')
    && ((typeof value.text) === 'string')
    && failureShaped;
}

/**
 File text, or nothing when the file cannot be read.

 @param path - file to read

 @returns Text, or an empty string for a file that is not there

 @example
 ```ts
 const text = await textOrNothing({ path, },);
 ```
 */
async function textOrNothing(
  { path, }: { readonly path: string; },
): Promise<string> {
  /**
   Logger pre-tagged with this function's name.
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
    rl.debug(`no cached reference at ${path}: ${String(error,)}`,);
    return '';
  }
}

/**
 Reads the cached record for a url.

 @param dir - cache directory

 @param url - page to look for

 @returns The record, or a miss when the file is absent or is not a record

 @example
 ```ts
 const cached = await readCachedReference({ dir, url, },);
 ```
 */
export async function readCachedReference(
  {
    dir,
    url,
  }: {
    readonly dir: string;
    readonly url: string;
  },
): Promise<CachedReference> {
  /**
   Logger pre-tagged with this function's name.
   */
  const rl = tagged({
    tag: readCachedReference.name,
    l,
  },);
  /**
   File the record would be in.
   */
  const path = referenceCachePath({
    dir,
    url,
  },);
  /**
   File text, empty when absent.
   */
  const text = await textOrNothing({ path, },);
  if (text === '')
    return { kind: 'miss', };
  /**
   Parsed record, refused when the file is not one.
   */
  const parsed: unknown = JSON.parse(text,);
  if (!isReferenceRecord(parsed,)) {
    rl.warn(`cached reference at ${path} is not a record; ignoring it`,);
    return { kind: 'miss', };
  }
  return {
    kind: 'hit',
    record: parsed,
  };
}

/**
 Writes a record for its url.

 @param dir - cache directory, created when missing

 @param record - record to keep

 @example
 ```ts
 await writeCachedReference({ dir, record, },);
 ```
 */
export async function writeCachedReference(
  {
    dir,
    record,
  }: {
    readonly dir: string;
    readonly record: ReferenceRecord;
  },
): Promise<void> {
  await mkdir(
    dir,
    { recursive: true, },
  );
  /**
   Pretty JSON, so a reader can open the file.
   */
  const text = JSON.stringify(
    record,
    null,
    2,
  );
  await writeFile(
    referenceCachePath({
      dir,
      url: record.url,
    },),
    `${text}\n`,
    'utf8',
  );
}

//endregion Reference cache
