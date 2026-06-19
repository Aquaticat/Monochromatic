/**
 * Static asset serving for the bundled JS and CSS under `dist/`.
 *
 * URLs are content-hashed at build time (tsdown handles JS; CSS is the
 * single `dist/css/styles.css` produced by build-tool-css). Long
 * `max-age=31536000, immutable` is safe because filenames change when
 * content changes.
 */

import {
  defineHandler,
  type EventHandlerWithFetch,
  serveStatic,
} from 'h3';
import type { Stats, } from 'node:fs';
import {
  readFile,
  stat,
} from 'node:fs/promises';
import { join, } from 'node:path';

/**
 * Sentinel returned by `tryStat` when the file does not exist or is
 * inaccessible. A unique `Symbol` rather than `undefined`: a successful
 * stat is always a `Stats` object, so callers branch with `=== STAT_ABSENT`.
 */
const STAT_ABSENT: unique symbol = Symbol('messages-demo:stat-absent',);

/**
 * Returns `stat` for `./<id>`, or `STAT_ABSENT` when the file does not exist
 * or is otherwise inaccessible. Swallows `stat`'s rejections so the caller
 * can branch on the return value rather than try/catch around the await.
 *
 * @param id - URL-relative asset path; joined onto `'.'` before stat
 *
 * @returns stat result, or `STAT_ABSENT` on any failure
 *
 * @example
 * ```ts
 * const stats = await tryStat('dist/css/styles.css');
 * if (stats !== STAT_ABSENT) console.log(stats.size);
 * ```
 */
async function tryStat(
  id: string,
): Promise<Stats | typeof STAT_ABSENT> {
  try {
    return await stat(
      join(
        '.',
        id,
      ),
    );
  }
  catch {
    return STAT_ABSENT;
  }
}

/**
 * h3 handler that serves files from `./dist/` by URL-relative path.
 *
 * @example
 * ```ts
 * app.get('/dist/**', staticHandler);
 * ```
 */
export const staticHandler: EventHandlerWithFetch = defineHandler(
  function handleStaticAsset(event,) {
    return serveStatic(
      event,
      {
        // The inline form relies on contextual typing to bridge Node's
        // `Buffer<ArrayBufferLike>` from `readFile` to h3's
        // `Promise<BodyInit | ...>`; extracting to a module-scope
        // function loses that bridge and forces a structural mismatch
        // between Node and DOM typings.
        // oxlint-disable-next-line eslint-plugin-unicorn/consistent-function-scoping -- contextual typing only works inline
        getContents: function readContents(id,) {
          return readFile(
            join(
              '.',
              id,
            ),
          );
        },
        getMeta: async function getMetadata(id,) {
          /**
           * Resolved stat result or `STAT_ABSENT` when the file does not exist or is inaccessible.
           */
          const stats = await tryStat(id,);
          return ((stats !== STAT_ABSENT) && stats
            .isFile())
            ? {
              size: Number(stats.size,),
              mtime: stats.mtime,
            }
            : undefined;
        },
      },
    );
  },
);
