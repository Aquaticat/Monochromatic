import { tagged, } from '@monochromatic-dev/module-logger/tagged';
import { findUp, } from 'find-up';
import * as v from 'valibot';
import { l as parentLogger, } from './log.ts';

/** Tagged logger for the opmls module. */
const l = tagged({
  tag: 'opmls',
  l: parentLogger,
},);

/**
 * Path to the .env file if found in the project directory hierarchy.
 * Enables relative `file://` URL support in OPML paths when present.
 */
export const DOT_ENV_PATH: string | undefined = await findUp('.env',);

/**
 * Valibot schema validating OPML source URLs.
 * Accepts `https?://` URLs with valid domain names and `file://` URLs
 * (absolute paths always; relative paths only when {@link DOT_ENV_PATH} is set).
 */
export const OPMLS_SCHEMA: v.GenericSchema<string[], string[]> = v.array(
  v.union([
    v.pipe(
      v.string(),
      v.url(),
      v.check(
        function isHttpDomainUrl(s,) {
          /** Parsed URL so the protocol and hostname can be checked independently. */
          const u = new URL(s,);
          return ((u.protocol
            === 'http:') || (u.protocol
            === 'https:'))
            && v
            .DOMAIN_REGEX
            .test(u.hostname,);
        },
        'Invalid HTTP(S) URL with valid domain',
      ),
    ),
    v.pipe(
      v.string(),
      v.url(),
      v.check(
        function isFileUrl(s,) {
          /** Parsed URL so the protocol check happens on a structured value, not a string match. */
          const u = new URL(s,);
          if (!u.protocol
            .includes('file',))
            return false;
          if (DOT_ENV_PATH !== undefined)
            return s.length
              > 0;
          return s.startsWith('file:///',);
        },
        'Invalid file URL',
      ),
    ),
  ],),
);

/**
 * Reads and validates OPML source URLs from the `OPMLS` environment variable.
 *
 * @returns Validated array of OPML source URLs
 *
 * @throws `v.ValiError` if any URL fails schema validation
 *
 * @example
 * ```ts
 * const opmls = getOpmls();
 * ```
 */
export function getOpmls(): v.InferOutput<typeof OPMLS_SCHEMA> {
  /** Inner logger tagged with this function name for traceable log lines. */
  const innerL = tagged({
    tag: getOpmls.name,
    l,
  },);
  /** Validated URL list returned to callers so invalid entries fail loud at startup. */
  const result = v.parse(
    OPMLS_SCHEMA,
    process.env
      .OPMLS
      ?.split(',',)
      ?? [],
  );
  innerL.debug(`${String(result.length,)} OPML URLs`,);
  return result;
}
