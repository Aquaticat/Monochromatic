import { z } from "zod/mini";
import { getCard, recordAnswer } from "../../lib/db/cards.ts";

/** HTTP status code for bad requests. */
const HTTP_BAD_REQUEST = 400;

/** HTTP status code for not found. */
const HTTP_NOT_FOUND = 404;

/** HTTP status code for internal server errors. */
const HTTP_INTERNAL_ERROR = 500;

/** Zod schema for validating answer payloads. */
const AnswerSchema = z.object({
  cardId: z.string().check(z.minLength(1)),
  correct: z.boolean(),
});

/**
 * POST /api/quiz/:deckId/answer -- records a quiz answer for a card.
 *
 * @param req - Incoming request with JSON body containing `cardId` and `correct`
 *
 * @param _deckId - Deck UUID from the route parameter (unused, kept for route consistency)
 *
 * @returns JSON response confirming the answer or error
 */
export async function handleAnswer(
  req: Request,
  _deckId: string
): Promise<Response> {
  try {
    const body = await req.json();
    const parsed = AnswerSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "cardId and correct (boolean) required" }, { status: HTTP_BAD_REQUEST });
    }

    const card = await getCard(parsed.data.cardId);
    if (card === null) {
      return Response.json({ error: "Card not found" }, { status: HTTP_NOT_FOUND });
    }

    await recordAnswer(parsed.data.cardId, parsed.data.correct);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: HTTP_INTERNAL_ERROR });
  }
}
