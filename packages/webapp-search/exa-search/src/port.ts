import * as v from 'valibot';

/**
 * Default port number for the exa-search server when no environment variable is set.
 *
 * @see `PORT` for the actual port used by the server
 */
const DEFAULT_PORT = 4_115;

/**
 * Port number on which the exa-search server will listen for incoming requests.
 * Can be overridden by setting the EXA_SEARCH_PORT environment variable.
 *
 * @see `DEFAULT_PORT` for the fallback port value
 */
export const PORT: number = v.parse(
  v.pipe(
    v.unknown(),
    v.transform(Number,),
    v.number(),
  ),
  process.env
    .EXA_SEARCH_PORT
    ?? DEFAULT_PORT,
);
