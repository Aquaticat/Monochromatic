# webapp-productivity-bun-test

Flashcard quiz web application built with h3 and SQLite.

## Architecture

- **Server**: h3 HTTP framework serving HTML pages and JSON API routes
- **Database**: SQLite via `@tursodatabase/database` for decks, cards, and quiz state
- **Client**: TypeScript components bundled with tsdown, CSS processed by `build-tool-css`
- **Validation**: Zod for request schema validation

## Routes

- `GET /` -- deck listing page
- `GET /quiz/:deckId` -- quiz page for a specific deck
- `POST /api/decks` -- create a deck
- `DELETE /api/decks/:id` -- delete a deck
- `POST /api/decks/:deckId/cards` -- add a card to a deck
- `DELETE /api/cards/:id` -- delete a card
- `POST /api/quiz/:deckId/answer` -- submit a quiz answer

## Running

```sh
mise run //packages/webapp-productivity/bun-test:start
```
