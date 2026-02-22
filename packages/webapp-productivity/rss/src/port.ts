import { z, } from 'zod/v4-mini';

/**
 * Default port number for the RSS server when no environment variable is set.
 * @see {@link PORT} for the actual port used by the server
 */
const DEFAULT_PORT = 4112;

/**
 * Port number on which the RSS server will listen for incoming requests.
 * Can be overridden by setting the RSS_PORT environment variable.
 * @see {@link DEFAULT_PORT} for the fallback port value
 * @see {@link z.coerce.number} for parsing logic
 */
export const PORT: number = z.coerce.number().parse(
  process.env.RSS_PORT ?? DEFAULT_PORT,
);
