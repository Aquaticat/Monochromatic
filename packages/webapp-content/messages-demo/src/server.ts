/**
 * Application entry point.
 *
 * Boot sequence:
 *
 * 1. Side-effect import of `./lib/db.ts` opens the SQLite database and
 *    runs migrations (also seeds the three identities the dropdown shows).
 * 2. CSS is compiled from `src/client/styles.css` -> `dist/css/styles.css`
 *    so a fresh checkout works without a separate `mise run build:css`.
 * 3. h3 app is constructed and the route table is wired.
 * 4. `serve` binds to the resolved port.
 *
 * Client JS bundles are built separately via `mise run build:js:client`
 * (tsdown). The server logs a hint if the bundles are missing.
 */

import { build as buildCSS, } from '@monochromatic-dev/build-tool-css/ts';
import {
  initPromise,
  logger,
} from '@monochromatic-dev/module-logger/logger';
import { tagged, } from '@monochromatic-dev/module-logger/tagged';
import {
  defineHandler,
  H3,
  HTTPError,
  redirect,
  serve,
} from 'h3';
import { existsSync, } from 'node:fs';

// oxlint-disable-next-line import/no-unassigned-import -- side-effect: opens SQLite and runs migrations
import './lib/db.ts';

import { getArgumentValue, } from './lib/args.ts';
import {
  HTTP_BAD_REQUEST,
  HTTP_FOUND,
} from './lib/http.ts';
import {
  cancelDraftHandler,
  createDraftHandler,
  finalizeDraftHandler,
  putChunkHandler,
} from './server/api/drafts.ts';
import { importHandler, } from './server/api/import.ts';
import {
  deleteMessageHandler,
  editMessageHandler,
} from './server/api/messages.ts';
import {
  renderChunkMd,
  renderChunkRaw,
} from './server/pages/chunk-data.ts';
import { renderEditPage, } from './server/pages/edit.ts';
import { renderFeed, } from './server/pages/feed.ts';
import { renderMessageChunk, } from './server/pages/message.ts';
import { staticHandler, } from './server/static.ts';

await initPromise;

/** Tagged logger for the server boot. */
const l = tagged({
  tag: 'server',
  l: logger,
},);

/** Default HTTP port when neither `--port=` nor `PORT` env var is provided. */
const DEFAULT_PORT = 3_000;

/** Radix used for explicit decimal integer parsing. */
const DECIMAL_RADIX = 10;

/**
 * Resolves the listen port from CLI argument, environment, or default.
 *
 * @returns parsed port
 */
function resolvePort(): number {
  /** CLI override; preferred over the env var so the developer's `--port=` wins in foreground runs. */
  const argumentPort = getArgumentValue('port',);
  /** Fallback environment value; used when the CLI did not supply one. */
  const environmentPort = process.env.PORT;
  /** Resolved precedence: CLI \> env; undefined falls through to the default. */
  const rawPort = argumentPort ?? environmentPort;
  if (rawPort === undefined)
    return DEFAULT_PORT;
  /** Parsed value; NaN signals a malformed input, in which case the default wins. */
  const parsedPort = Number.parseInt(
    rawPort,
    DECIMAL_RADIX,
  );
  return Number.isNaN(parsedPort,) ? DEFAULT_PORT : parsedPort;
}

/**
 * Compiles `src/client/styles.css` to `dist/css/styles.css`. Skipped
 * silently if the source does not exist yet (very first boot before
 * `client/styles.css` has been written).
 */
async function compileCss(): Promise<void> {
  if (!existsSync('./src/client/styles.css',)) {
    l.info('skipping CSS build: src/client/styles.css missing',);
    return;
  }
  await buildCSS({
    input: './src/client/styles.css',
    output: './dist/css/styles.css',
  },);
}

await compileCss();

if (!existsSync('./dist/client/index.js',)) {
  l.warn(
    'dist/client/index.js missing: run `mise run build:js:client` to enable the composer',
  );
}

/** h3 application instance routing HTTP requests to handlers. */
const app = new H3();

//region Read pages

app.get(
  '/',
  defineHandler(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- `event` is h3's H3Event, an external SDK object with mutating methods (response writes, header sets, body reads); marking it readonly would misdescribe the API contract
    async function handleFeed(event,) {
      /** Conditional-GET header forwarded to the renderer for ETag short-circuiting. */
      const ifNoneMatch = event.req.headers.get('if-none-match',);
      return await renderFeed({
        cursorToken: null,
        ifNoneMatch,
      },);
    },
  ),
);

app.get(
  '/p/:cursor',
  defineHandler(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- `event` is h3's H3Event, an external SDK object with mutating methods (response writes, header sets, body reads); marking it readonly would misdescribe the API contract
    async function handleFeedPage(event,) {
      /** Required `:cursor` path param; bails to 400 when missing. */
      const cursor = requireParam({
        params: event.context.params,
        name: 'cursor',
      },);
      /** Conditional-GET header forwarded to the renderer for ETag short-circuiting. */
      const ifNoneMatch = event.req.headers.get('if-none-match',);
      return await renderFeed({
        cursorToken: cursor,
        ifNoneMatch,
      },);
    },
  ),
);

app.get(
  '/m/:id',
  defineHandler(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- `event` is h3's H3Event, an external SDK object with mutating methods (response writes, header sets, body reads); marking it readonly would misdescribe the API contract
    function handleMessageRoot(event,) {
      /** Parsed `:id` param; redirect target uses this in the chunk-0 URL. */
      const id = parseId({
        params: event.context.params,
        name: 'id',
      },);
      return redirect(
        `/m/${String(id,)}/c/0`,
        HTTP_FOUND,
      );
    },
  ),
);

app.get(
  '/m/:id/c/:idx',
  defineHandler(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- `event` is h3's H3Event, an external SDK object with mutating methods (response writes, header sets, body reads); marking it readonly would misdescribe the API contract
    async function handleMessageChunk(event,) {
      /** Parsed `:id` param; consumed by `renderMessageChunk` as the message id. */
      const id = parseId({
        params: event.context.params,
        name: 'id',
      },);
      /** Parsed `:idx` param; chunk index inside the message. */
      const idx = parseId({
        params: event.context.params,
        name: 'idx',
        min: 0,
      },);
      /** Conditional-GET header forwarded to the renderer for ETag short-circuiting. */
      const ifNoneMatch = event.req.headers.get('if-none-match',);
      return await renderMessageChunk({
        messageId: id,
        chunkIndex: idx,
        ifNoneMatch,
      },);
    },
  ),
);

app.get(
  '/m/:id/c/:idx/raw',
  defineHandler(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- `event` is h3's H3Event, an external SDK object with mutating methods (response writes, header sets, body reads); marking it readonly would misdescribe the API contract
    async function handleChunkRaw(event,) {
      /** Parsed `:id` param; consumed by `renderChunkRaw` as the message id. */
      const id = parseId({
        params: event.context.params,
        name: 'id',
      },);
      /** Parsed `:idx` param; chunk index inside the message. */
      const idx = parseId({
        params: event.context.params,
        name: 'idx',
        min: 0,
      },);
      /** Conditional-GET header forwarded to the renderer for ETag short-circuiting. */
      const ifNoneMatch = event.req.headers.get('if-none-match',);
      return await renderChunkRaw({
        messageId: id,
        chunkIndex: idx,
        ifNoneMatch,
      },);
    },
  ),
);

app.get(
  '/m/:id/c/:idx/md',
  defineHandler(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- `event` is h3's H3Event, an external SDK object with mutating methods (response writes, header sets, body reads); marking it readonly would misdescribe the API contract
    async function handleChunkMd(event,) {
      /** Parsed `:id` param; consumed by `renderChunkMd` as the message id. */
      const id = parseId({
        params: event.context.params,
        name: 'id',
      },);
      /** Parsed `:idx` param; chunk index inside the message. */
      const idx = parseId({
        params: event.context.params,
        name: 'idx',
        min: 0,
      },);
      /** Conditional-GET header forwarded to the renderer for ETag short-circuiting. */
      const ifNoneMatch = event.req.headers.get('if-none-match',);
      return await renderChunkMd({
        messageId: id,
        chunkIndex: idx,
        ifNoneMatch,
      },);
    },
  ),
);

app.get(
  '/m/:id/edit',
  defineHandler(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- `event` is h3's H3Event, an external SDK object with mutating methods (response writes, header sets, body reads); marking it readonly would misdescribe the API contract
    async function handleEdit(event,) {
      /** Parsed `:id` param; consumed by `renderEditPage`. */
      const id = parseId({
        params: event.context.params,
        name: 'id',
      },);
      return await renderEditPage(id,);
    },
  ),
);

//endregion

//region Write API

app.post(
  '/api/drafts',
  createDraftHandler,
);
app.put(
  '/api/drafts/:id/chunks/:seq',
  putChunkHandler,
);
app.post(
  '/api/drafts/:id/finalize',
  finalizeDraftHandler,
);
app.delete(
  '/api/drafts/:id',
  cancelDraftHandler,
);
app.post(
  '/api/messages/:id/edit',
  editMessageHandler,
);
app.post(
  '/api/messages/:id/delete',
  deleteMessageHandler,
);
app.post(
  '/api/import',
  importHandler,
);

/**
 * The HTML composer form points its `action` at this endpoint as a
 * fallback for the (unsupported) no-JS path. We always 400, because JS
 * is required.
 */
app.post(
  '/api/composer-noscript',
  defineHandler(
    function handleNoScriptPost() {
      throw new HTTPError({
        status: HTTP_BAD_REQUEST,
        message: 'JavaScript is required to send messages. Enable JS and try again.',
      },);
    },
  ),
);

//endregion

//region Static assets

app.get(
  '/dist/**',
  staticHandler,
);

//endregion

/** Resolved listen port, taken from `--port=` argv or `3000`. */
const port = resolvePort();
serve(
  app,
  {
    port,
    hostname: '0.0.0.0',
  },
);
l.info(`listening on http://localhost:${String(port,)}`,);

//region Local helpers

/**
 * Extracts a path parameter, throwing a 400 when missing.
 *
 * @param input - h3 route parameter record and the parameter name
 *
 * @returns parameter value
 *
 * @example
 * ```ts
 * const cursor = requireParam({ params: event.context.params, name: 'cursor' });
 * ```
 */
function requireParam(
  input: {
    readonly params: Readonly<Record<string, string>> | undefined;
    readonly name: string;
  },
): string {
  /** Indexed once so the empty-string check and the return both reference the same value. */
  const value = input.params?.[input.name];
  if ((value === undefined) || (value === '')) {
    throw new HTTPError({
      status: HTTP_BAD_REQUEST,
      message: `missing route param: ${input.name}`,
    },);
  }
  return value;
}

/**
 * Parses a route parameter as a non-negative integer. Used for both
 * message ids and chunk indices.
 *
 * @param input - h3 route parameter record, the parameter name, and the
 *                minimum acceptable value (1 for ids, 0 for indices)
 *
 * @returns parsed integer
 *
 * @example
 * ```ts
 * const id = parseId({ params: event.context.params, name: 'id', min: 1 });
 * ```
 */
function parseId(
  input: {
    readonly params: Readonly<Record<string, string>> | undefined;
    readonly name: string;
    readonly min?: number;
  },
): number {
  /** Defaults to `1`; ids start at 1, chunk indices pass `min: 0`. */
  const min = input.min ?? 1;
  /** Raw param string forwarded into `Number.parseInt`. */
  const raw = requireParam({
    params: input.params,
    name: input.name,
  },);
  /** Parsed integer; non-finite or below-minimum triggers a 400 below. */
  const parsed = Number.parseInt(
    raw,
    DECIMAL_RADIX,
  );
  if ((!Number.isFinite(parsed,)) || (parsed < min)) {
    throw new HTTPError({
      status: HTTP_BAD_REQUEST,
      message: `invalid ${input.name}: ${raw}`,
    },);
  }
  return parsed;
}

//endregion
