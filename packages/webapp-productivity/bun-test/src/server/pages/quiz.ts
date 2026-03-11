import { getDeck } from "../../lib/db/decks";
import { listCards } from "../../lib/db/cards";

// Renders quiz page for a specific deck with all cards embedded as JSON.
export async function quizPage(deckId: string): Promise<Response> {
  const deck = await getDeck(deckId);
  if (!deck) {
    return new Response("Deck not found", { status: 404 });
  }

  const cards = await listCards(deckId);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Quiz: ${deck.name}</title>
</head>
<body>
  <script type="application/json" id="page-data">${JSON.stringify({ deck, cards })}</script>
  <script type="module" src="/dist/client/quiz.js"></script>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
