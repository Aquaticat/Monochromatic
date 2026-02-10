import { listDecks } from "../../lib/db/decks";

// Renders deck list page with embedded JSON data.
// Client JS reads #page-data and builds DOM -- no client-side fetch on load.
export function decksPage(): Response {
  const decks = listDecks();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Flashcard Quiz</title>
</head>
<body>
  <script type="application/json" id="page-data">${JSON.stringify({ decks })}</script>
  <script type="module" src="/dist/client/decks.js"></script>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
