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
 */
export function registerRoutes({ app, packageRoot, authToken, rootDir, }: {
  app: H3;
  packageRoot: string;
  authToken: string;
  rootDir: string;
},): void {
  //region HTML entry point

  app.get('/', defineHandler(async function handleIndex() {
    const html = await readFile(join(packageRoot, 'src/client/index.html',), 'utf8',);
    return new Response(
      html,
      { headers: { 'Content-Type': 'text/html; charset=utf-8', }, },
    );
  },),);

  //endregion HTML entry point

  //region Static asset serving — built client bundles from dist/client/

  app.get('/dist/client/**', defineHandler(function handleStaticAsset(event,) {
    return serveStatic(event, {
      getContents: function readContents(id,) {
        return readFile(join(packageRoot, id,),);
      },
      getMeta: async function getMetadata(id,) {
        const fullPath = join(packageRoot, id,);
        let stats: Awaited<ReturnType<typeof stat>> | undefined = undefined;
        try {
          stats = await stat(fullPath,);
        }
        catch (error) {
          /** Only swallow ENOENT (file not found); rethrow unexpected errors. */
          const isNotFound = error instanceof Error
            && 'code' in error
            // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- guarded by instanceof Error and 'code' in error above
            && (error as NodeJS.ErrnoException).code === 'ENOENT';
          if (!isNotFound)
            throw error;

          return;
        }
        if (!stats.isFile())
          return;
        return { size: stats.size, mtime: stats.mtimeMs, };
      },
    },);
  },),);

  //endregion Static asset serving

  //region Raw file serving — media files via HTTP for native browser rendering

  app.get('/_raw', defineHandler(async function handleRawFile(event,) {
    const query = getQuery(event,);
    if (query.token !== authToken)
      return new Response('Unauthorized', { status: 401, },);
    const filePath = typeof query.path === 'string' ? query.path : null;
    if (filePath === null)
      return new Response('Missing path', { status: 400, },);
    const absolutePath = assertWithinRoot({ rootDir, path: filePath, },);
    const buffer = await readFile(absolutePath,);
    const contentType = getContentType({ path: absolutePath, },);
    return new Response(buffer, { headers: { 'Content-Type': contentType, }, },);
  },),);

  //endregion Raw file serving
}
