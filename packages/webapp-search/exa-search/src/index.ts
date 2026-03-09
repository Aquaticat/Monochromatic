import { $ as tagged, } from '@monochromatic-dev/module-es/tagged';
import { indexHtml, } from './asset.ts';
import { l as parentLogger, } from './log.ts';
import { PORT, } from './port.ts';

const l = tagged({ tag: 'server', l: parentLogger, },);

/**
 * Routes an incoming request to the appropriate handler based on method and path.
 * Serves the single-page exa-search application on GET /.
 * @param request - Incoming HTTP request
 * @returns Response containing the HTML page, or 404
 */
async function handleRequest(request: Request,): Promise<Response> {
  const url = new URL(request.url,);
  const { pathname, } = url;
  const { method, } = request;

  l.debug(`${method} ${pathname}`);

  if (method === 'GET' && pathname === '/') {
    return new Response(
      indexHtml,
      { status: 200, headers: { 'content-type': 'text/html', }, },
    );
  }

  return new Response('Not Found', { status: 404, },);
}

const _server = Bun.serve({
  port: PORT,
  fetch: handleRequest,
},);

l.info(`listening on port ${String(PORT)}`);
