import { z } from "zod/mini";
import { recordAnswer, getCard } from "../../lib/db/cards";

const AnswerSchema = z.object({
  cardId: z.string().check(z.minLength(1)),
  correct: z.boolean(),
});

export async function handleAnswer(
  req: Request,
  _deckId: string
): Promise<Response> {
  try {
    const body = await req.json();
    const parsed = AnswerSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "cardId and correct (boolean) required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const card = getCard(parsed.data.cardId);
    if (!card) {
      return new Response(
        JSON.stringify({ error: "Card not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    recordAnswer(parsed.data.cardId, parsed.data.correct);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
