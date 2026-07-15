/**
 * HTTP route registration for editord.
 *
 * Configures static file serving, raw media serving, and the root HTML page.
 * Separated from the main entry point to keep the boot file focused.
 */

import {
  defineHandler,
  getQuery,
  type H3,
  serveStatic,
} from 'h3';
import {
  readFile,
  stat,
} from 'node:fs/promises';
import { join, } from 'node:path';

import { assertWithinRoot, } from './operations/assert-within-root.ts';
import { getContentType, } from './operations/file-kind.ts';

/**
 * Registers all HTTP routes on the h3 application instance.
 *
 * @param app - h3 application to attach routes to
 *
 * @param packageRoot - base path for resolving dist and source assets
 *
 * @param authToken - authentication token for raw file access
 *
 * @param rootDir - root directory for path containment checks
 *
 * @example
 * ```ts
 * registerRoutes({ app, packageRoot: '/opt/editord', authToken: 'tok_abc123', rootDir: '/home/user/project', });
 * ```
 */
export function registerRoutes({
  app,
  packageRoot,
  authToken,
  rootDir,
}: {
  readonly app: H3;
  readonly packageRoot: string;
  readonly authToken: string;
  readonly rootDir: string;
},): void {
  //region HTML entry point

  app.get(
    '/',
    defineHandler(async function handleIndex() {
      /**
       * Index HTML loaded once per request; small enough that caching isn't worth the staleness risk.
       */
      const html = await readFile(
        join(
          packageRoot,
          'src/client/index.html',
        ),
        'utf8',
      );
      return new Response(
        html,
        { headers: { 'Content-Type': 'text/html; charset=utf-8', }, },
      );
    },),
  );

  //endregion HTML entry point

  //region Static asset serving: built client bundles from dist/client/

  app.get(
    '/dist/client/**',
    defineHandler(function handleStaticAsset(event,) {
      return serveStatic(
        event,
        {
          getContents: function readContents(id,) {
            return readFile(join(
              packageRoot,
              id,
            ),);
          },
          getMeta: async function getMetadata(id,) {
            /**
             * Absolute path resolved against package root before reading filesystem metadata.
             */
            const fullPath = join(
              packageRoot,
              id,
            );
            try {
              /**
               * Filesystem stat used to derive size and mtime for h3's caching headers.
               */
              const stats = await stat(fullPath,);
              if (!stats.isFile())
                return undefined;
              return {
                size: stats.size,
                mtime: stats.mtimeMs,
              };
            }
            catch (error) {
              /**
               * Only swallow ENOENT (file not found); rethrow unexpected errors.
               */
              const isNotFound = (error instanceof Error)
                && ('code' in error)
                // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- guarded by instanceof Error and 'code' in error above
                && ((error as NodeJS.ErrnoException).code
                  === 'ENOENT');
              if (isNotFound)
                return undefined;
              throw error;
            }
          },
        },
      );
    },),
  );

  //endregion Static asset serving

  //region Raw file serving: media files via HTTP for native browser rendering

  app.get(
    '/_raw',
    defineHandler(async function handleRawFile(event,) {
      /**
       * Parsed query string carrying `token` (auth) and `path` (target file).
       */
      const query = getQuery(event,);
      if (query.token
        !== authToken) {
        return new Response(
          'Unauthorized',
          { status: 401, },
        );
      }
      /**
       * Requested file path; null when the client did not supply a string `path` query parameter.
       */
      const filePath = (typeof query.path) === 'string' ? query.path : null;
      if (filePath === null) {
        return new Response(
          'Missing path',
          { status: 400, },
        );
      }
      /**
       * Resolved absolute path; throws if `filePath` escapes the configured root directory.
       */
      const absolutePath = assertWithinRoot({
        rootDir,
        path: filePath,
      },);
      /**
       * Full file bytes; raw endpoint serves binary media so the body must be a Buffer.
       */
      const buffer = await readFile(absolutePath,);
      /**
       * Content-Type inferred from the file extension; controls how the browser renders the response.
       */
      const contentType = getContentType({ path: absolutePath, },);
      return new Response(
        buffer,
        { headers: { 'Content-Type': contentType, }, },
      );
    },),
  );

  //endregion Raw file serving
}
