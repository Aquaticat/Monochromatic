/**
 * OPFS file-name and stale-entry helpers for the chunk cache.
 *
 * Split from `chunk-cache.ts` so the factory module stays under the line
 * cap. These helpers operate on a `FileSystemDirectoryHandle` and never
 * read or write cache values directly.
 */

import type { ChunkCacheKey, } from './chunk-cache.ts';

/**
 * Builds the OPFS file name for `key`. Uses `-` as separator because
 * `:` is rejected by some OPFS implementations.
 *
 * @param key - cache key triple
 *
 * @returns OPFS file name
 *
 * @example
 * ```ts
 * opfsName({ messageId: 1, revision: 2, idx: 0 }); // '1-2-0.html'
 * ```
 */
export function opfsName(key: ChunkCacheKey,): string {
  return `${String(key.messageId,)}-${String(key.revision,)}-${String(key.idx,)}.html`;
}

/**
 * Lists every file in the cache directory whose `messageId` matches
 * `key` but whose `revision` differs, and removes them. Bounded by the
 * number of cached entries for one message; with the typical
 * navigation pattern this is at most a few dozen files.
 *
 * @param input - directory handle and the new key being queried
 *
 * @example
 * ```ts
 * await evictOpfsStale({ directory, key });
 * ```
 */
export async function evictOpfsStale(
  input: {
    directory: FileSystemDirectoryHandle;
    key: ChunkCacheKey;
  },
): Promise<void> {
  /**
   * File-name prefix scoping the walk to the message id under consideration.
   */
  const messagePrefix = `${String(input.key
    .messageId,)}-`;
  /**
   * Extends `messagePrefix` with the current revision; entries starting with this are kept.
   */
  const currentRevPrefix = `${messagePrefix}${String(input.key
    .revision,)}-`;
  // FileSystemDirectoryHandle implements AsyncIterable<FileSystemHandle>
  // in Chromium and WebKit; older lib.dom.d.ts versions do not declare
  // the iterator on the type, so we narrow via a typed alias.
  if (!(Symbol.asyncIterator
    in input
    .directory))
    return;
  /* oxlint-disable typescript/no-unsafe-type-assertion -- DOM lib lacks the iterator type */
  /**
   * Narrowed alias so the `for await` loop sees a typed iterator instead of the DOM-lib gap.
   */
  const iterable = input.directory as unknown as AsyncIterable<FileSystemHandle>;
  /* oxlint-enable typescript/no-unsafe-type-assertion */
  for await (const handle of iterable) {
    if (!handle.name
      .startsWith(messagePrefix,))
      continue;
    if (handle.name
      .startsWith(currentRevPrefix,))
      continue;
    try {
      await input.directory
        .removeEntry(handle.name,);
    }
    catch {
      // Another tab may have raced us; ignore and move on.
    }
  }
}
