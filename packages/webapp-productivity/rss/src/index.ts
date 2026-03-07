import {
  appendFile,
  exists,
  mkdir,
  stat,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';
import { indexHtmlStart, } from './asset.ts';
import {
  INDEX_HTML_END,
  indexHtmlBodyObservable,
  lastUpdatedObservable,
  MIN_INTERVAL,
} from './html.ts';
import { l, } from './log.ts';
import { opmlsObservable, } from './opmls.ts';
import { IGNORE_PATH, } from './path.ts';
import { PORT, } from './port.ts';
import './ignore.ts';

l.debug(`logger working`);

/**
 * Triggers a feed update if the minimum interval has elapsed.
 * Returns a 429 response with Retry-After header when called too frequently.
 * @returns Response indicating update status
 * @example
 * ```typescript
 * const response = updateFeed();
 * ```
 * @see {@link MIN_INTERVAL} for rate limit threshold
 * @see {@link lastUpdatedObservable} for last update tracking
 */
function updateFeed(): Response {
  l.debug(`updateFeed`);

  const timeSinceLastUpdate = (new Date()).getTime()
    - lastUpdatedObservable.value.getTime();

  if (timeSinceLastUpdate >= MIN_INTERVAL) {
    // oxlint-disable-next-line no-self-assign -- trigger update
    opmlsObservable.value = opmlsObservable.value;
    return new Response('updateFeed triggered', {
      status: 200,
      headers: {
        'content-type': 'text/plain',
      },
    },);
  }

  const retryAfterSeconds = Math.ceil((MIN_INTERVAL - timeSinceLastUpdate) / 1000,);

  return new Response('updateFeed triggered too soon', {
    status: 429,
    headers: {
      'content-type': 'text/plain',
      'Retry-After': retryAfterSeconds.toString(),
    },
  },);
}

/**
 * Serves the full rendered HTML page with inlined assets and feed body.
 * Triggers a feed update as a side effect.
 * @returns Response containing the complete HTML document
 * @see {@link indexHtmlStart} for the head/asset fragment
 * @see {@link indexHtmlBodyObservable} for the rendered feed list
 * @see {@link INDEX_HTML_END} for the closing HTML tags
 */
function serveIndex(): Response {
  l.debug(`serveIndex`);

  updateFeed();

  return new Response(
    `${indexHtmlStart}${indexHtmlBodyObservable.value}${INDEX_HTML_END}`,
    {
      status: 200,
      headers: { 'content-type': 'text/html', },
    },
  );
}

/**
 * Returns the ISO-8601 timestamp of the last successful feed update.
 * @returns Response with the last update timestamp as plain text
 * @see {@link lastUpdatedObservable} for the tracked timestamp
 */
function getLastUpdated(): Response {
  l.debug(`getLastUpdated`);
  return new Response(lastUpdatedObservable.value.toISOString(), {
    status: 200,
    headers: {
      'content-type': 'text/plain',
    },
  },);
}

/**
 * Records an ignored feed item to the JSONL ignore file.
 * Creates the ignore directory and file if they do not exist.
 * @param request - Incoming request with JSON body describing the ignored item
 * @returns Response with file stats after appending
 * @see {@link IGNORE_PATH} for the ignore file directory
 */
async function ignore(request: Request,): Promise<Response> {
  const body = await request.text();
  l.debug(`ignore ${body}`);

  if (!await exists(join(IGNORE_PATH, 'api.jsonl',),)) {
    l.debug(`creating api.jsonl`);
    await mkdir(IGNORE_PATH, { recursive: true, },);
    await writeFile(join(IGNORE_PATH, 'api.jsonl',), '', 'utf8',);
  }
  await appendFile(join(IGNORE_PATH, 'api.jsonl',), `\n${body}`,);

  const stats = await stat(join(IGNORE_PATH, 'api.jsonl',),);

  return new Response(JSON.stringify(stats,), {
    status: 200,
    headers: {
      'content-type': 'application/json',
    },
  },);
}

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

  if (method === 'GET' && pathname === '/') return serveIndex();
  if (method === 'POST' && pathname === '/api/updateFeed/new') return updateFeed();
  if (method === 'GET' && pathname === '/api/updateFeed/lastUpdated') return getLastUpdated();
  if (method === 'POST' && pathname === '/api/ignore/new') return await ignore(request,);

  return new Response('Not Found', { status: 404, },);
}

const _server = Bun.serve({
  port: PORT,
  fetch: handleRequest,
},);

l.info(`listening on port ${PORT}`);
