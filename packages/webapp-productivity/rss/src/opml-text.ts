import { $ as mapIterableAsync, } from '@monochromatic-dev/module-es/map-iterable-async';
import {
  nonNullishOrThrow,
} from '@monochromatic-dev/module-or-throw';
import { tagged, } from '@monochromatic-dev/module-logger/tagged';
import { readFile, } from 'node:fs/promises';
import {
  dirname,
  resolve,
} from 'node:path';
import { fileURLToPath, } from 'node:url';
import type * as v from 'valibot';
import { l as parentLogger, } from './log.ts';
import {
  DOT_ENV_PATH,
  type OPMLS_SCHEMA,
} from './opmls.ts';

/** Tagged logger for the opml-text module. */
const l = tagged({
  tag: 'opml-text',
  l: parentLogger,
},);

//region OPML text fetching: Retrieves raw OPML content from HTTP and file URLs

/**
 * Fetches OPML file contents from all configured source URLs.
 * Handles HTTP(S) and file:// protocols, discarding unreachable sources with warnings.
 *
 * @param opmls - Validated OPML source URLs
 *
 * @returns Array of raw OPML XML strings
 *
 * @example
 * ```ts
 * const texts = await getOPMLTexts(getOpmls());
 * ```
 */
export async function getOPMLTexts(
  opmls: v.InferOutput<typeof OPMLS_SCHEMA>,
): Promise<string[]> {
  const innerL = tagged({
    tag: getOPMLTexts.name,
    l,
  },);
  const DISCARD = Symbol('discard',);
  const result = (await mapIterableAsync(
    async function fetchOpml(
      opmlLink: (v.InferOutput<typeof OPMLS_SCHEMA>)[number],
    ): Promise<string | typeof DISCARD> {
      if (opmlLink.startsWith('http',)) {
        const response = await fetch(opmlLink,);
        if (!response.ok) {
          innerL.warn(`${opmlLink} responded ${String(response.status,)}`,);
          return DISCARD;
        }
        try {
          return await response.text();
        }
        catch (error) {
          innerL.warn(
            `text conversion failed for ${opmlLink}: ${JSON.stringify(error,)}`,
          );
          return DISCARD;
        }
      }
      if (opmlLink.startsWith('file',)) {
        if (opmlLink.startsWith('file:///',)) {
          try {
            return await readFile(
              fileURLToPath(opmlLink,),
              'utf8',
            );
          }
          catch (error) {
            innerL.warn(`failed reading ${opmlLink}: ${JSON.stringify(error,)}`,);
            return DISCARD;
          }
        }
        const absPath = resolve(
          dirname(nonNullishOrThrow(DOT_ENV_PATH,),),
          opmlLink
            .slice('file://'.length,),
        );
        try {
          return await readFile(
            absPath,
            'utf8',
          );
        }
        catch (error) {
          innerL.warn(
            `failed reading ${opmlLink} at ${absPath}: ${JSON.stringify(error,)}`,
          );
          return DISCARD;
        }
      }
      innerL.warn(`${opmlLink} uses unsupported protocol`,);
      return DISCARD;
    },
    opmls,
  ))
    .filter(function notDiscard(text,): text is string {
      return text !== DISCARD;
    },);
  innerL.debug(`fetched ${String(result.length,)} OPML texts`,);
  return result;
}

//endregion OPML text fetching
