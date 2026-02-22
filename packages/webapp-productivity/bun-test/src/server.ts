import { build as buildCSS } from "@monochromatic-dev/build-tool-css/ts";
import "./lib/db";
import { decksPage } from "./server/pages/decks";
import { quizPage } from "./server/pages/quiz";
import { handleCreateDeck, handleDeleteDeck } from "./server/api/decks";
import { handleCreateCard, handleDeleteCard } from "./server/api/cards";
import { handleAnswer } from "./server/api/answers";

// Entry point: build-css (resolve imports, expand mixins) -> Bun.build() -> Bun.serve().
// In dev (bun --watch), server restarts on any file change -> full rebuild is automatic.

// Step 1: Process CSS -- resolves @import, expands @mixin/@apply into plain CSS.
await buildCSS({
  input: "./src/client/styles.css",
  output: "./dist/client/styles.css",
});
console.log("CSS build complete: dist/client/styles.css");

// Step 2: Bundle client TS -- imports the processed CSS as text string.
const buildResult = await Bun.build({
  entrypoints: [
    "./src/client/decks.ts",
    "./src/client/quiz.ts",
  ],
  outdir: "./dist/client",
  target: "browser",
  minify: process.env.NODE_ENV === "production",
});

if (!buildResult.success) {
  console.error("Client build failed:", buildResult.logs);
  process.exit(1);
}

console.log(
  `Built ${buildResult.outputs.length} client bundles:`,
  buildResult.outputs.map((o) => o.path)
);

// Step 3: Serve. Bun's built-in router handles :param parsing and per-method dispatch.
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
