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
          let stats: Awaited<ReturnType<typeof stat>> | undefined = undefined;
          try {
            stats = await stat(
              join(
                '.',
                id,
              ),
            );
          }
          catch {
            // File not found or inaccessible.
          }
          if (stats === undefined || !stats.isFile())
            return;
          return {
            size: stats.size,
            mtime: stats.mtimeMs,
          };
        },
      },
    );
  },
);
