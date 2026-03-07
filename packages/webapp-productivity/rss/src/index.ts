import { $ as memoizeAsync, } from '@monochromatic-dev/module-es/memoize-async';
import { $ as tagged, } from '@monochromatic-dev/module-es/tagged';
import { getSortedFeeds, } from './feed.ts';
import {
  ignore,
  serveIndex,
} from './handler.ts';
import { getIgnoreContent, getIndexHtmlBody, } from './html.ts';
import { getFetchSalt, } from './interval.ts';
import { getSortedItems, } from './item.ts';
import { l as parentLogger, } from './log.ts';
import { getOpmls, } from './opmls.ts';
import { getOutlinesFromOpmls, } from './outline.ts';
import { PORT, } from './port.ts';

const l = tagged({ tag: 'server', l: parentLogger, },);

//region Memoized pipeline -- Pull-based feed processing with content-derived cache invalidation

/**
 * Memoized pipeline: OPML URLs -> outlines -> feeds -> sorted items.
 * Cache invalidates when the time bucket advances (controlled by RSS_FETCH_INTERVAL_MS).
 */
const memoizedGetSortedItems = await memoizeAsync({
  fn: async function fetchPipeline(): Promise<
    ReturnType<typeof getSortedItems>
  > {
    const innerL = tagged({ tag: fetchPipeline.name, l, },);
    innerL.debug('running feed pipeline');
    const opmls = getOpmls();
    const outlines = await getOutlinesFromOpmls(opmls,);
    const feeds = await getSortedFeeds(outlines,);
    const items = getSortedItems(feeds,);
    innerL.debug(`pipeline complete: ${String(items.length)} items`);
    return items;
  },
  keyFn: () => '',
},);

/**
 * Memoized HTML renderer: sorted items -> filtered + rendered HTML body.
 * Invalidates when either the fetch time bucket or ignore file content changes.
 */
const memoizedGetHtmlBody = await memoizeAsync({
  fn: async function renderPipeline(): Promise<string> {
    const innerL = tagged({ tag: renderPipeline.name, l, },);
    innerL.debug('rendering HTML body');
    const fetchSalt = getFetchSalt();
    const items = await memoizedGetSortedItems({ args: [], salt: fetchSalt, },);
    const body = await getIndexHtmlBody({ items, },);
    innerL.debug(`rendered ${String(body.length)} chars`);
    return body;
  },
  keyFn: () => '',
},);

/**
 * Computes the render salt and calls the memoized HTML body renderer.
 * Salt combines the fetch time bucket with ignore file content,
 * so changes to either invalidate the render cache.
 * @returns Rendered HTML body string
 */
async function getHtmlBody(): Promise<string> {
  const fetchSalt = getFetchSalt();
  const ignoreContent = await getIgnoreContent();
  return memoizedGetHtmlBody({ args: [], salt: fetchSalt + ignoreContent, },);
}

//endregion Memoized pipeline

//region Request routing -- Maps HTTP method + path to handler functions

/**
 * Routes an incoming request to the appropriate handler based on method and path.
 * @param request - Incoming HTTP request
 * @returns Response from the matched handler, or 404
 */
async function handleRequest(request: Request,): Promise<Response> {
  const url = new URL(request.url,);
  const { pathname, } = url;
  const { method, } = request;

  l.debug(`${method} ${pathname}`);

  if (method === 'GET' && pathname === '/') return await serveIndex({ getHtmlBody, },);
  if (method === 'POST' && pathname === '/api/ignore/new') return await ignore(request,);

  return new Response('Not Found', { status: 404, },);
}

//endregion Request routing

const _server = Bun.serve({
  port: PORT,
  fetch: handleRequest,
},);

l.info(`listening on port ${String(PORT)}`);
