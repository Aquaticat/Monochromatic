import * as z from 'zod/mini';

/**
 * Default port number for the RSS server when no environment variable is set.
 *
 * @see `PORT` for the actual port used by the server
 */
const DEFAULT_PORT = 4_112;

/**
 * Port number on which the RSS server will listen for incoming requests.
 * Can be overridden by setting the RSS_PORT environment variable.
 *
 * @see `DEFAULT_PORT` for the fallback port value
 *
 * @see `z.coerce.number` for parsing logic
 */
export const PORT: number = z.coerce.number().parse(
  process.env.RSS_PORT ?? DEFAULT_PORT,
);
