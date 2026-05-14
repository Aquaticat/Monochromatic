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
import {
  readFile,
  stat,
} from 'node:fs/promises';
import { join, } from 'node:path';

/**
 * Returns `stat` for `./<id>`, or `undefined` when the file does not exist
 * or is otherwise inaccessible. Swallows `stat`'s rejections so the caller
 * can branch on the return value rather than try/catch around the await.
 *
 * @param id - URL-relative asset path; joined onto `'.'` before stat
 *
 * @returns stat result, or `undefined` on any failure
 *
 * @example
 * ```ts
 * const stats = await tryStat('dist/css/styles.css');
 * if (stats !== undefined) console.log(stats.size);
 * ```
 */
async function tryStat(id: string,): Promise<Awaited<ReturnType<typeof stat>> | undefined> {
  try {
    return await stat(
      join(
        '.',
        id,
      ),
    );
  }
  catch {
    return undefined;
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
        getContents: function readContents(id,) {
          return readFile(
            join(
              '.',
              id,
            ),
          );
        },
        getMeta: async function getMetadata(id,) {
          /** Resolved stat result or `undefined` when the file does not exist or is inaccessible. */
          const stats = await tryStat(id,);
          if ((stats === undefined) || (!stats.isFile()))
            return;
          return {
            size: Number(stats.size,),
            mtime: stats.mtime,
          };
        },
      },
    );
  },
);
