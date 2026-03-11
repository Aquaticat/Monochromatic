/**
 * Application entry point for the flashcard quiz app.
 *
 * Boot sequence:
 * 1. Side-effect import opens the SQLite database
 * 2. CSS is compiled from `src/client/styles.css` -> `dist/css/styles.css`
 * 3. Start h3 HTTP server
 *
 * Client JS bundles are built separately via `mise run build:js:client` (tsdown).
 */
import { readFile, stat, } from 'node:fs/promises';
import { join, } from 'node:path';
import { H3, HTTPError, defineHandler, getRouterParam, serve, serveStatic, } from 'h3';
import { build as buildCSS } from "@monochromatic-dev/build-tool-css/ts";
import "./lib/db.ts";
import { decksPage } from "./server/pages/decks.ts";
import { quizPage } from "./server/pages/quiz.ts";
import { handleCreateDeck, handleDeleteDeck } from "./server/api/decks.ts";
import { handleCreateCard, handleDeleteCard } from "./server/api/cards.ts";
import { handleAnswer } from "./server/api/answers.ts";

/**
 * Extracts a required route parameter, throwing 400 if missing.
 * @param event - h3 event
 * @param name - Parameter name from the route pattern
 * @returns Parameter value
 * @throws {HTTPError} 400 when parameter is missing
 */
function requireParam(event: Parameters<typeof getRouterParam>[0], name: string): string {
  const value = getRouterParam(event, name,);
  if (value === undefined) {
    throw new HTTPError({ status: 400, message: `missing route parameter: ${name}`, },);
  }
  return value;
}

// Step 1: Process CSS -- resolves @import, expands @mixin/@apply into plain CSS.
await buildCSS({
  input: "./src/client/styles.css",
  output: "./dist/css/styles.css",
});
console.log("CSS build complete: dist/css/styles.css");

// Step 2: Build h3 application.

const app = new H3();

//region Page routes -- return full HTML documents

app.get('/', defineHandler(() => decksPage()));

app.get('/quiz/:deckId', defineHandler((event) => {
  const deckId = requireParam(event, 'deckId',);
  return quizPage(deckId,);
}));

//endregion Page routes

//region API routes -- return JSON

app.post('/api/decks', defineHandler((event) => handleCreateDeck(event.req,)));

app.delete('/api/decks/:id', defineHandler((event) => {
  const id = requireParam(event, 'id',);
  return handleDeleteDeck(id,);
}));

app.post('/api/decks/:deckId/cards', defineHandler((event) => {
  const deckId = requireParam(event, 'deckId',);
  return handleCreateCard(event.req, deckId,);
}));

app.delete('/api/cards/:id', defineHandler((event) => {
  const id = requireParam(event, 'id',);
  return handleDeleteCard(id,);
}));

app.post('/api/quiz/:deckId/answer', defineHandler((event) => {
  const deckId = requireParam(event, 'deckId',);
  return handleAnswer(event.req, deckId,);
}));

//endregion API routes

//region Static asset serving -- bundled JS and CSS from dist/client/

app.get('/dist/client/**', defineHandler((event) => {
  return serveStatic(event, {
    getContents: (id) => readFile(join('.', id,),),
    getMeta: async (id) => {
      const stats = await stat(join('.', id,),).catch(() => undefined,);
      if (stats === undefined || !stats.isFile()) {
        return undefined;
      }
      return { size: stats.size, mtime: stats.mtimeMs, };
    },
  },);
}));

//endregion Static asset serving

// Step 3: Start server.
const server = serve(app, { port: Number(process.env.PORT) || 3000, },);

console.log(`Listening on ${server.url}`);
