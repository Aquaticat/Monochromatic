/**
 * Development server for the static site.
 *
 * Runs the build pipeline on startup, then serves the `dist/` directory
 * via h3. Use with `mise watch` or `bun --watch` for auto-rebuild on
 * source changes.
 *
 * Runtime-neutral: h3 delegates to srvx which supports Node, Bun, and Deno.
 */
import {
  defineHandler,
  H3,
  serve,
  serveStatic,
} from 'h3';
import {
  readFile,
  stat,
} from 'node:fs/promises';
import { join, } from 'node:path';

/** Output directory to serve. */
const DIST = 'dist';

/** Default development server port. */
const DEV_PORT = 4321;

//region Static file serving

/** h3 application instance for serving static files from dist/. */
const app = new H3();

app.get('/**', defineHandler(function handleStatic(event,) {
  return serveStatic(event, {
    getContents: function readContents(id,) {
      return readFile(join(DIST, id,),);
    },
    getMeta: async function getMetadata(id,) {
      /** Resolved filesystem path for the requested asset. */
      const resolvedPath = join(DIST, id,);

      let stats: Awaited<ReturnType<typeof stat>> | undefined = undefined;
      try {
        stats = await stat(resolvedPath,);
      }
      catch {
        return;
      }

      if (stats.isDirectory()) {
        try {
          const indexStats = await stat(join(resolvedPath, 'index.html',),);
          if (indexStats.isFile()) {
            return { size: indexStats.size, mtime: indexStats.mtimeMs, };
          }
        }
        catch {
          return;
        }
        return;
      }

      if (!stats.isFile())
        return;

      return { size: stats.size, mtime: stats.mtimeMs, };
    },
    indexNames: ['index.html',],
  },);
},),);

//endregion Static file serving

/** Running dev server instance. */
const _server = serve(app, { port: DEV_PORT, },);

console.log(`[dev] serving ${DIST}/ at ${_server.url}`,);
