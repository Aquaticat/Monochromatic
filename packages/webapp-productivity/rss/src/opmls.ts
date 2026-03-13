import { $ as tagged, } from '@monochromatic-dev/module-es/tagged';
import { findUp, } from 'find-up';
import { z, } from 'zod/v4-mini';
import { l as parentLogger, } from './log.ts';

/** Tagged logger for the opmls module. */
const l = tagged({ tag: 'opmls', l: parentLogger, },);

/**
 * Path to the .env file if found in the project directory hierarchy.
 * Enables relative `file://` URL support in OPML paths when present.
 */
export const DOT_ENV_PATH: string | undefined = await findUp('.env',);

/**
 * Zod schema validating OPML source URLs.
 * Accepts `https?://` URLs with valid domain names and `file://` URLs
 * (absolute paths always; relative paths only when {@link DOT_ENV_PATH} is set).
 */
export const OPMLS_SCHEMA: z.ZodMiniArray<
  z.ZodMiniUnion<readonly [z.ZodMiniURL, z.ZodMiniURL,]>
> = z
  .array(z.union([
    z.url({ protocol: /^https?$/, hostname: z.regexes.domain, },),
    z
      .url({ protocol: /file/, pattern: DOT_ENV_PATH !== undefined ? /./ : /^file:\/{3}/, },),
  ],),);

/**
 * Reads and validates OPML source URLs from the `OPMLS` environment variable.
 *
 * @returns Validated array of OPML source URLs
 *
 * @throws `z.ZodError` if any URL fails schema validation
 *
 * @example
 * ```ts
 * const opmls = getOpmls();
 * ```
 */
export function getOpmls(): z.infer<typeof OPMLS_SCHEMA> {
  const innerL = tagged({ tag: getOpmls.name, l, },);
  const result = OPMLS_SCHEMA
    .parse(process.env.OPMLS?.split(',',) ?? [],);
  innerL.debug(`${String(result.length)} OPML URLs`);
  return result;
}
