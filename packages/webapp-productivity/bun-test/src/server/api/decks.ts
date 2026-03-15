import { z, } from 'zod/mini';
import {
  createDeck,
  deleteDeck,
} from '../../lib/db/decks.ts';

/** HTTP status code for resource creation. */
const HTTP_CREATED = 201;

/** HTTP status code for bad requests. */
const HTTP_BAD_REQUEST = 400;

/** HTTP status code for not found. */
const HTTP_NOT_FOUND = 404;

/** HTTP status code for internal server errors. */
const HTTP_INTERNAL_ERROR = 500;

/** Zod schema for validating deck creation payloads. */
const CreateDeckSchema = z.object({
  name: z.string().check(z.minLength(1,),),
},);

/**
 * POST /api/decks -- creates a new deck.
 *
 * @param req - Incoming request with JSON body containing `name`
 *
 * @returns JSON response with created deck or error
 */
export async function handleCreateDeck(req: Request,): Promise<Response> {
  try {
    const body = await req.json();
    const parsed = CreateDeckSchema.safeParse(body,);
    if (!parsed.success) {
      return Response.json({ error: 'Name is required', }, {
        status: HTTP_BAD_REQUEST,
      },);
    }
    const deck = await createDeck(parsed.data.name,);
    return Response.json(deck, { status: HTTP_CREATED, },);
  }
  catch (e) {
    return Response.json({ error: String(e,), }, { status: HTTP_INTERNAL_ERROR, },);
  }
}

/**
 * DELETE /api/decks/:id -- permanently removes a deck.
 *
 * @param id - Deck UUID from the route parameter
 *
 * @returns JSON response confirming deletion or error
 */
export async function handleDeleteDeck(id: string,): Promise<Response> {
  const deleted = await deleteDeck(id,);
  if (!deleted)
    return Response.json({ error: 'Deck not found', }, { status: HTTP_NOT_FOUND, },);
  return Response.json({ ok: true, },);
}
