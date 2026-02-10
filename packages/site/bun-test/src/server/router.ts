import { decksPage } from "./pages/decks";
import { quizPage } from "./pages/quiz";
import { handleCreateDeck, handleDeleteDeck } from "./api/decks";
import { handleCreateCard, handleDeleteCard } from "./api/cards";
import { handleAnswer } from "./api/answers";

export async function router(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // Static assets (built client JS + CSS)
  if (path.startsWith("/dist/client/")) {
    const file = Bun.file(`.${path}`);
    if (await file.exists()) {
      const contentType = path.endsWith(".js")
        ? "application/javascript"
        : path.endsWith(".css")
          ? "text/css"
          : "application/octet-stream";
      return new Response(file, {
        headers: { "Content-Type": contentType },
      });
    }
    return new Response("Not found", { status: 404 });
  }

  // API routes
  if (path.startsWith("/api/")) {
    // POST /api/decks
    if (path === "/api/decks" && method === "POST") return handleCreateDeck(req);

    // DELETE /api/decks/:id
    const deckDelete = path.match(/^\/api\/decks\/([^/]+)$/);
    if (deckDelete && method === "DELETE") return handleDeleteDeck(deckDelete[1]);

    // POST /api/decks/:id/cards
    const cardCreate = path.match(/^\/api\/decks\/([^/]+)\/cards$/);
    if (cardCreate && method === "POST") return handleCreateCard(req, cardCreate[1]);

    // DELETE /api/cards/:id
    const cardDelete = path.match(/^\/api\/cards\/([^/]+)$/);
    if (cardDelete && method === "DELETE") return handleDeleteCard(cardDelete[1]);

    // POST /api/quiz/:deckId/answer
    const answer = path.match(/^\/api\/quiz\/([^/]+)\/answer$/);
    if (answer && method === "POST") return handleAnswer(req, answer[1]);

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Page routes
  if (path === "/") return decksPage();

  const quizMatch = path.match(/^\/quiz\/([^/]+)$/);
  if (quizMatch) return quizPage(quizMatch[1]);

  return new Response("Not found", { status: 404 });
}
