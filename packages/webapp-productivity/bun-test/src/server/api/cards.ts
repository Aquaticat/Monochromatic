import { z, } from 'zod/mini';
import {
  createCard,
  deleteCard,
} from '../../lib/db/cards.ts';
import { getDeck, } from '../../lib/db/decks.ts';

/** HTTP status code for resource creation. */
const HTTP_CREATED = 201;

/** HTTP status code for bad requests. */
const HTTP_BAD_REQUEST = 400;

/** HTTP status code for not found. */
const HTTP_NOT_FOUND = 404;

/** HTTP status code for internal server errors. */
const HTTP_INTERNAL_ERROR = 500;

/** Zod schema for validating card creation payloads. */
const CreateCardSchema = z.object({
  front: z.string().check(z.minLength(1,),),
  back: z.string().check(z.minLength(1,),),
},);

/**
 * POST /api/decks/:deckId/cards -- creates a new card in a deck.
 *
 * @param req - Incoming request with JSON body containing `front` and `back`
 *
 * @param deckId - Deck UUID from the route parameter
 *
 * @returns JSON response with created card or error
 */
export async function handleCreateCard(
  req: Request,
  deckId: string,
): Promise<Response> {
  try {
    const deck = await getDeck(deckId,);
    if (deck === null)
      return Response.json({ error: 'Deck not found', }, { status: HTTP_NOT_FOUND, },);

    const body = await req.json();
    const parsed = CreateCardSchema.safeParse(body,);
    if (!parsed.success) {
      return Response.json({ error: 'Front and back text required', }, {
        status: HTTP_BAD_REQUEST,
      },);
    }

    const card = await createCard(deckId, parsed.data.front, parsed.data.back,);
    return Response.json(card, { status: HTTP_CREATED, },);
  }
  catch (e) {
    return Response.json({ error: String(e,), }, { status: HTTP_INTERNAL_ERROR, },);
  }
}

/**
 * DELETE /api/cards/:id -- permanently removes a card.
 *
 * @param id - Card UUID from the route parameter
 *
 * @returns JSON response confirming deletion or error
 */
export async function handleDeleteCard(id: string,): Promise<Response> {
  const deleted = await deleteCard(id,);
  if (!deleted)
    return Response.json({ error: 'Card not found', }, { status: HTTP_NOT_FOUND, },);
  return Response.json({ ok: true, },);
}
