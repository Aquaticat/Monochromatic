/**
 * Application entry point for the flashcard quiz app.
 *
 * Boot sequence:
 * 1. Side-effect import opens the SQLite database
 * 2. CSS is compiled from `src/client/styles.css` → `dist/css/styles.css`
 * 3. Start Bun HTTP server
 *
 * Client JS bundles are built separately via `mise run build:js:client` (tsdown).
 */
import { build as buildCSS } from "@monochromatic-dev/build-tool-css/ts";
import "./lib/db.ts";
import { decksPage } from "./server/pages/decks.ts";
import { quizPage } from "./server/pages/quiz.ts";
import { handleCreateDeck, handleDeleteDeck } from "./server/api/decks.ts";
import { handleCreateCard, handleDeleteCard } from "./server/api/cards.ts";
import { handleAnswer } from "./server/api/answers.ts";

// Step 1: Process CSS -- resolves @import, expands @mixin/@apply into plain CSS.
await buildCSS({
  input: "./src/client/styles.css",
  output: "./dist/css/styles.css",
});
console.log("CSS build complete: dist/css/styles.css");

// Step 2: Serve. Bun's built-in router handles :param parsing and per-method dispatch.
const server = Bun.serve({
  port: Number(process.env.PORT) || 3000,
  routes: {
    "/": () => decksPage(),
    "/quiz/:deckId": (req) => quizPage(req.params.deckId),
    "/api/decks": { POST: (req) => handleCreateDeck(req) },
    "/api/decks/:id": { DELETE: (req) => handleDeleteDeck(req.params.id) },
    "/api/decks/:deckId/cards": { POST: (req) => handleCreateCard(req, req.params.deckId) },
    "/api/cards/:id": { DELETE: (req) => handleDeleteCard(req.params.id) },
    "/api/quiz/:deckId/answer": { POST: (req) => handleAnswer(req, req.params.deckId) },
  },
  // Fallback: static assets from build output, or 404.
  async fetch(req) {
    const path = new URL(req.url).pathname;
    if (path.startsWith("/dist/client/")) {
      const file = Bun.file(`.${path}`);
      if (await file.exists()) {
        return new Response(file);
      }
    }
    return new Response("Not found", { status: 404 });
  },
});

console.log(`Listening on http://localhost:${server.port}`);
