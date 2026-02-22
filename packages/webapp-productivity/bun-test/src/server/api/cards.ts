import { z } from "zod/mini";
import { createCard, deleteCard } from "../../lib/db/cards";
import { getDeck } from "../../lib/db/decks";

const CreateCardSchema = z.object({
  front: z.string().check(z.minLength(1)),
  back: z.string().check(z.minLength(1)),
});

export async function handleCreateCard(
  req: Request,
  deckId: string
): Promise<Response> {
  try {
    const deck = getDeck(deckId);
    if (!deck) {
      return new Response(
        JSON.stringify({ error: "Deck not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const parsed = CreateCardSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Front and back text required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const card = createCard(deckId, parsed.data.front, parsed.data.back);
    return new Response(JSON.stringify(card), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export function handleDeleteCard(id: string): Response {
  const deleted = deleteCard(id);
  if (!deleted) {
    return new Response(
      JSON.stringify({ error: "Card not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
}
