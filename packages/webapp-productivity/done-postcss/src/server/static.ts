/**
 * Static asset serving handler for bundled JS and CSS from dist/client/.
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
 * h3 handler that serves static files from the `dist/` directory.
 * Returns the file contents with size/mtime metadata for caching.
 *
 * @example
 * ```ts
 * app.get('/dist/client/**', staticHandler);
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
          /** Stat result captured via a try/catch helper; `undefined` when the file is missing or inaccessible. */
          const stats = await (async function tryStat(): Promise<Awaited<ReturnType<typeof stat>> | undefined> {
            try {
              /** Direct `stat()` result returned to the outer `stats` binding. */
              const result = await stat(
                join(
                  '.',
                  id,
                ),
              );
              return result;
            }
            catch {
              return undefined;
            }
          })();
          if ((stats === undefined) || (!stats.isFile()))
            return;
          return {
            size: Number(stats.size,),
            mtime: Number(stats.mtimeMs,),
          };
        },
      },
    );
  },
);
