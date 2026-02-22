import { swagger, } from '@elysiajs/swagger';
import {
  Elysia,
  sse,
  type SSEPayload,
} from 'elysia';
import {
  appendFile,
  exists,
  mkdir,
  readFile,
  stat,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';
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
import { IGNORE_PATH, } from './path.ts';
import { PORT, } from './port.ts';
import './ignore.ts';

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

async function ignore({ body, }: { body: string; },): Promise<Response> {
  l.debug`read ${body}`;

  if (!await exists(join(IGNORE_PATH, 'api.jsonl',),)) {
    l.debug`creating api.jsonl`;
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
  .post('/api/updateFeed/new', updateFeed,)
  .get('/api/updateFeed/lastUpdated', getLastUpdated,)
  .post('/api/ignore/new', ignore,)
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
