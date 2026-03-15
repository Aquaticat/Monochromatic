/**
 * Application entry point for the flashcard quiz app.
 *
 * Boot sequence:
 * 1. Side-effect import opens the SQLite database
 * 2. CSS is compiled from `src/client/styles.css` -\> `dist/css/styles.css`
 * 3. Start h3 HTTP server
 *
 * Client JS bundles are built separately via `mise run build:js:client` (tsdown).
 */
import { build as buildCSS, } from '@monochromatic-dev/build-tool-css/ts';
import {
  defineHandler,
  getRouterParam,
  H3,
  HTTPError,
  serve,
  serveStatic,
} from 'h3';
import {
  readFile,
  stat,
} from 'node:fs/promises';
import { join, } from 'node:path';
// oxlint-disable-next-line import/no-unassigned-import -- side-effect: opens SQLite database
import './lib/db.ts';
import { handleAnswer, } from './server/api/answers.ts';
import {
  handleCreateCard,
  handleDeleteCard,
} from './server/api/cards.ts';
import {
  handleCreateDeck,
  handleDeleteDeck,
} from './server/api/decks.ts';
import { decksPage, } from './server/pages/decks.ts';
import { quizPage, } from './server/pages/quiz.ts';

/** HTTP status code for bad requests. */
const HTTP_BAD_REQUEST = 400;

/** Default HTTP listen port. */
const DEFAULT_PORT = 3_000;

/**
 * Extracts a required route parameter, throwing 400 if missing.
 *
 * @param event - h3 event
 *
 * @param name - Parameter name from the route pattern
 *
 * @returns Parameter value
 *
 * @throws HTTPError 400 when parameter is missing
 */
function requireParam(event: Parameters<typeof getRouterParam>[0],
  name: string,): string
{
  const value = getRouterParam(event, name,);
  if (value === undefined) {
    throw new HTTPError({ status: HTTP_BAD_REQUEST,
      message: `missing route parameter: ${name}`, },);
  }
  return value;
}

// Step 1: Process CSS -- resolves \@import, expands \@mixin/\@apply into plain CSS.
await buildCSS({
  input: './src/client/styles.css',
  output: './dist/css/styles.css',
},);
console.log('CSS build complete: dist/css/styles.css',);

// Step 2: Build h3 application.

/** h3 application instance routing HTTP requests to handlers. */
const app = new H3();

//region Page routes -- return full HTML documents

app.get('/', defineHandler(function handleDecks() {
  return decksPage();
},),);

app.get('/quiz/:deckId', defineHandler(function handleQuiz(event,) {
  const deckId = requireParam(event, 'deckId',);
  return quizPage(deckId,);
},),);

//endregion Page routes

//region API routes -- return JSON

app.post('/api/decks', defineHandler(function handleCreateDeckRoute(event,) {
  return handleCreateDeck(event.req,);
},),);

app.delete('/api/decks/:id', defineHandler(function handleDeleteDeckRoute(event,) {
  const id = requireParam(event, 'id',);
  return handleDeleteDeck(id,);
},),);

app.post('/api/decks/:deckId/cards',
  defineHandler(function handleCreateCardRoute(event,) {
    const deckId = requireParam(event, 'deckId',);
    return handleCreateCard(event.req, deckId,);
  },),);

app.delete('/api/cards/:id', defineHandler(function handleDeleteCardRoute(event,) {
  const id = requireParam(event, 'id',);
  return handleDeleteCard(id,);
},),);

app.post('/api/quiz/:deckId/answer', defineHandler(function handleAnswerRoute(event,) {
  const deckId = requireParam(event, 'deckId',);
  return handleAnswer(event.req, deckId,);
},),);

//endregion API routes

//region Static asset serving -- bundled JS and CSS from dist/client/

app.get('/dist/client/**', defineHandler(function handleStaticAsset(event,) {
  return serveStatic(event, {
    getContents: function readContents(id,) {
      return readFile(join('.', id,),);
    },
    getMeta: async function getMetadata(id,) {
      let stats: Awaited<ReturnType<typeof stat>> | undefined;
      try {
        stats = await stat(join('.', id,),);
      }
      catch {
        return;
      }
      if (!stats.isFile())
        return;
      return { size: stats.size, mtime: stats.mtimeMs, };
    },
  },);
},),);

//endregion Static asset serving

// Step 3: Start server.
/** Running HTTP server instance listening on the configured port. */
const server = serve(app, { port: Number(process.env.PORT,) || DEFAULT_PORT, },);

console.log(`Listening on ${server.url}`,);
