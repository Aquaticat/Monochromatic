import { swagger, } from '@elysiajs/swagger';
import {
  Elysia,
  sse,
  type SSEPayload,
} from 'elysia';
import {
  hash,
  indexHtmlStart,
  indexHtmlWatcher,
} from './asset.ts';
import {
  INDEX_HTML_END,
  indexHtmlBodyObservable,
  lastUpdatedObservable,
  MIN_INTERVAL,
} from './html.ts';
import { l, } from './log.ts';
import { opmlsObservable, } from './opmls.ts';
import { PORT, } from './port.ts';

l.debug`logger working`;

function updateFeed(): Response {
  l.debug`updateFeed`;

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

  // Calculate how long to wait before retrying
  const retryAfterSeconds = Math.ceil((MIN_INTERVAL - timeSinceLastUpdate) / 1000,);

  return new Response('updateFeed triggered too soon', {
    status: 429, // Too Many Requests
    headers: {
      'content-type': 'text/plain',
      'Retry-After': retryAfterSeconds.toString(), // Seconds until retry is allowed
    },
  },);
}

function serveIndex(): Response {
  l.debug`serveIndex`;

  updateFeed();

  return new Response(
    `${indexHtmlStart}${indexHtmlBodyObservable.value}${INDEX_HTML_END}`,
    {
      status: 200,
      headers: {
        'content-type': 'text/html',
      },
    },
  );
}

function getLastUpdated(): Response {
  l.debug`getLastUpdated`;
  return new Response(lastUpdatedObservable.value.toISOString(), {
    status: 200,
    headers: {
      'content-type': 'text/plain',
    },
  },);
}

async function read(request: Request,): Promise<Response> {
  l.debug`read ${JSON.stringify(await request.text(),)}`;
  return new Response('not implemented', {
    status: 200,
    headers: {
      'content-type': 'text/plain',
    },
  },);
}

const _app = new Elysia()
  .use(swagger({
    documentation: {
      info: {
        title: 'RSS Reader API',
        version: '0.0.1',
        description: 'API for reading and displaying RSS feeds',
      },
    },
    path: '/swagger',
  },),)
  .get('/', serveIndex,)
  .get('/api/updateFeed/new', updateFeed,)
  .get('/api/updateFeed/lastUpdated', getLastUpdated,)
  .get('/api/read', read,)
  .get('/api/asset/hash', function getHash() {
    return new Response(hash, {
      status: 200,
      headers: {
        'content-type': 'text/plain',
      },
    },);
  },)
  .listen(PORT, function logListening() {
    l.info`listening on port ${PORT}`;
  },);
