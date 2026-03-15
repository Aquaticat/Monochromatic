/**
 * Static asset serving handler for bundled JS and CSS from dist/client/.
 */
import {
  defineHandler,
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
export const staticHandler = defineHandler(function handleStaticAsset(event,) {
  return serveStatic(event, {
    getContents: function readContents(id,) {
      return readFile(join('.', id,),);
    },
    getMeta: async function getMetadata(id,) {
      let stats: Awaited<ReturnType<typeof stat>> | undefined;
      try {
        stats = await stat(join('.', id,),);
      }
      catch {
        // File not found or inaccessible
      }
      if (stats === undefined || !stats.isFile())
        return;
      return { size: stats.size, mtime: stats.mtimeMs, };
    },
  },);
},);
