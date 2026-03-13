// 161 lines: OPML fetching, parsing, and outline filtering form a single ingestion pipeline
import { $ as mapIterableAsync, } from '@monochromatic-dev/module-es/map-iterable-async';
import { $ as notNullishOrThrow, } from '@monochromatic-dev/module-es/not-nullish-or-throw';
import { $ as tagged, } from '@monochromatic-dev/module-es/tagged';
import {
  type Opml,
  parseOpml,
} from 'feedsmith';
import { readFile, } from 'node:fs/promises';
import { dirname, resolve, } from 'node:path';
import { fileURLToPath, } from 'node:url';
import { z, } from 'zod/v4-mini';
import { l as parentLogger, } from './log.ts';
import {
  DOT_ENV_PATH,
  type OPMLS_SCHEMA,
} from './opmls.ts';

/** Tagged logger for the outline module. */
const l = tagged({ tag: 'outline', l: parentLogger, },);

/**
 * OPML outline with a required, validated `xmlUrl` property.
 * Represents a feed subscription entry ready for fetching.
 *
 * @see `Opml` for the base outline type
 */
export type InnerOutlineWUrl = Opml.Outline<string> & { xmlUrl: string; };

//region OPML text fetching -- Retrieves raw OPML content from HTTP and file URLs

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
async function getOPMLTexts(
  opmls: z.infer<typeof OPMLS_SCHEMA>,
): Promise<string[]> {
  const innerL = tagged({ tag: getOPMLTexts.name, l, },);
  const DISCARD = Symbol('discard',);
  const result = (await mapIterableAsync(
    async function fetchOpml(
      opmlLink: (z.infer<typeof OPMLS_SCHEMA>)[number],
    ): Promise<string | typeof DISCARD> {
      if (opmlLink.startsWith('http',)) {
        const response = await fetch(opmlLink,);
        if (!response.ok) {
          innerL.warn(`${opmlLink} responded ${String(response.status)}`);
          return DISCARD;
        }
        try {
          return await response.text();
        }
        catch (error) {
          innerL.warn(`text conversion failed for ${opmlLink}: ${JSON.stringify(error,)}`);
          return DISCARD;
        }
      }
      if (opmlLink.startsWith('file',)) {
        if (opmlLink.startsWith('file:///',)) {
          try {
            return await readFile(fileURLToPath(opmlLink,), 'utf8',);
          }
          catch (error) {
            innerL.warn(`failed reading ${opmlLink}: ${JSON.stringify(error,)}`);
            return DISCARD;
          }
        }
        const absPath = resolve(dirname(notNullishOrThrow(DOT_ENV_PATH,),), opmlLink
          .slice('file://'.length,),);
        try {
          return await readFile(absPath, 'utf8',);
        }
        catch (error) {
          innerL.warn(`failed reading ${opmlLink} at ${absPath}: ${JSON.stringify(error,)}`);
          return DISCARD;
        }
      }
      innerL.warn(`${opmlLink} uses unsupported protocol`);
      return DISCARD;
    },
    opmls,
  ))
    .filter(function notDiscard(text,): text is string {
      return text !== DISCARD;
    },);
  innerL.debug(`fetched ${String(result.length)} OPML texts`);
  return result;
}

//endregion OPML text fetching

//region OPML parsing and outline extraction -- Converts raw XML into validated feed outline structures

/**
 * Extracts validated inner outlines with xmlUrl from raw OPML source URLs.
 * Orchestrates the full pipeline: fetch texts, parse XML, extract outlines, validate URLs.
 *
 * @param opmls - Validated OPML source URLs
 *
 * @returns Array of outlines with validated HTTP(S) xmlUrl properties
 *
 * @example
 * ```ts
 * const outlines = await getOutlinesFromOpmls(getOpmls());
 * ```
 */
export async function getOutlinesFromOpmls(
  opmls: z.infer<typeof OPMLS_SCHEMA>,
): Promise<InnerOutlineWUrl[]> {
  const innerL = tagged({ tag: getOutlinesFromOpmls.name, l, },);
  const texts = await getOPMLTexts(opmls,);
  const parsed = parseSafe(texts,);
  const outerOutlines = parsed.flatMap(function extractBody(opml,) {
    return opml.body?.outlines ?? [];
  },);
  const innerOutlines = outerOutlines.flatMap(function extractInner(outline,) {
    return outline.outlines ?? [];
  },);
  const result = innerOutlines.filter(
    function hasValidXmlUrl(
      outline,
    ): outline is InnerOutlineWUrl {
      const {xmlUrl} = outline;
      if (xmlUrl === undefined || xmlUrl === null || xmlUrl === '') {
        innerL.warn(`outline ${outline.text ?? 'unnamed'} has no xmlUrl`);
        return false;
      }
      try {
        z.url({ protocol: /^https?$/, hostname: z.regexes.domain, },).parse(xmlUrl,);
        return true;
      }
      catch (error) {
        innerL.warn(`${xmlUrl} failed validation: ${JSON.stringify(error,)}`);
        return false;
      }
    },
  );
  innerL.debug(`${String(result.length)} valid inner outlines`);
  return result;
}

/**
 * Safely parses an array of OPML XML strings, discarding unparseable entries.
 *
 * @param texts - Raw OPML XML strings
 *
 * @returns Successfully parsed OPML documents
 */
function parseSafe(texts: string[]): Opml.Document<string>[] {
  const innerL = tagged({ tag: parseSafe.name, l, },);
  return texts.flatMap(function tryParse(text,) {
    try {
      return [parseOpml(text,),];
    }
    catch (error) {
      innerL.warn(`OPML parse failed: ${JSON.stringify(error,)}`);
      return [];
    }
  },);
}

//endregion OPML parsing and outline extraction
