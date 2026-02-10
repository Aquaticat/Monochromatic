import { z } from "zod/mini";
import { createDeck, deleteDeck } from "../../lib/db/decks";

const CreateDeckSchema = z.object({
  name: z.string().check(z.minLength(1)),
});

export async function handleCreateDeck(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const parsed = CreateDeckSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Name is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    const deck = createDeck(parsed.data.name);
    return new Response(JSON.stringify(deck), {
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

export function handleDeleteDeck(id: string): Response {
  const deleted = deleteDeck(id);
  if (!deleted) {
    return new Response(
      JSON.stringify({ error: "Deck not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
}
