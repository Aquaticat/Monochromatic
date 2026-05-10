import { $ as memoizeAsync, } from '@monochromatic-dev/module-es/memoize-async';
import { tagged, } from '@monochromatic-dev/module-logger/tagged';
import {
  defineHandler,
  getRouterParam,
  H3,
  HTTPError,
  serve,
} from 'h3';
import { getSortedFeeds, } from './feed.ts';
import {
  ignore,
  serveIndex,
} from './handler.ts';
import { getIndexHtmlBody, } from './html.ts';
import { getIgnoreContent, } from './ignore.ts';
import { getFetchSalt, } from './interval.ts';
import { getSortedItems, } from './item.ts';
import { l as parentLogger, } from './log.ts';
import { getOpmls, } from './opmls.ts';
import { getOutlinesFromOpmls, } from './outline.ts';
import { PORT, } from './port.ts';

/** Tagged logger for the server entry module. */
const l = tagged({
  tag: 'server',
  l: parentLogger,
},);

//region Memoized pipeline: Pull-based feed processing with content-derived cache invalidation

/**
 * Memoized pipeline: OPML URLs -\> outlines -\> feeds -\> sorted items.
 * Cache invalidates when the time bucket advances (controlled by RSS_FETCH_INTERVAL_MS).
 */
const memoizedGetSortedItems = await memoizeAsync({
  fn: async function fetchPipeline(): Promise<
    ReturnType<typeof getSortedItems>
  > {
    const innerL = tagged({
      tag: fetchPipeline.name,
      l,
    },);
    innerL.debug('running feed pipeline',);
    const opmls = getOpmls();
    const outlines = await getOutlinesFromOpmls(opmls,);
    const feeds = await getSortedFeeds(outlines,);
    const items = getSortedItems(feeds,);
    innerL.debug(`pipeline complete: ${String(items.length,)} items`,);
    return items;
  },
  keyFn: function emptyKey() {
    return '';
  },
},);

/**
 * Memoized HTML renderer: sorted items -\> filtered + rendered HTML body.
 * Invalidates when either the fetch time bucket or ignore file content changes.
 */
const memoizedGetHtmlBody = await memoizeAsync({
  fn: async function renderPipeline(): Promise<string> {
    const innerL = tagged({
      tag: renderPipeline.name,
      l,
    },);
    innerL.debug('rendering HTML body',);
    const fetchSalt = getFetchSalt();
    const items = await memoizedGetSortedItems({
      args: [],
      salt: fetchSalt,
    },);
    const body = await getIndexHtmlBody({ items, },);
    innerL.debug(`rendered ${String(body.length,)} chars`,);
    return body;
  },
  keyFn: function emptyKey() {
    return '';
  },
},);

/**
 * Computes the render salt and calls the memoized HTML body renderer.
 * Salt combines the fetch time bucket with ignore file content,
 * so changes to either invalidate the render cache.
 *
 * @returns Rendered HTML body string
 */
async function getHtmlBody(): Promise<string> {
  const fetchSalt = getFetchSalt();
  const ignoreContent = await getIgnoreContent();
  return memoizedGetHtmlBody({
    args: [],
    salt: fetchSalt + ignoreContent,
  },);
}

//endregion Memoized pipeline

//region h3 application: Maps HTTP method + path to handler functions

/** h3 application instance routing HTTP requests to handlers. */
const app = new H3();

/**
 * Serves the rendered RSS feed index page.
 */
app.get(
  '/',
  defineHandler(function handleIndex() {
    return serveIndex({ getHtmlBody, },);
  },),
);

/**
 * Adds an item to the ignore list.
 */
app.post(
  '/api/ignore/new',
  defineHandler(function handleIgnore(event,) {
    return ignore(event.req,);
  },),
);

//endregion h3 application

/** Running HTTP server instance listening on the configured port. */
const server = serve(
  app,
  { port: PORT, },
);

l.info(`listening on ${server.url}`,);
