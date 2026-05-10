import { tagged, } from '@monochromatic-dev/module-logger/tagged';
import {
  type Opml,
  parseOpml,
} from 'feedsmith';
import * as v from 'valibot';
import { l as parentLogger, } from './log.ts';
import { getOPMLTexts, } from './opml-text.ts';
import type { OPMLS_SCHEMA, } from './opmls.ts';

/** Tagged logger for the outline module. */
const l = tagged({
  tag: 'outline',
  l: parentLogger,
},);

/**
 * OPML outline with a required, validated `xmlUrl` property.
 * Represents a feed subscription entry ready for fetching.
 *
 * @see `Opml` for the base outline type
 */
export type InnerOutlineWUrl = Opml.Outline<string> & { xmlUrl: string; };

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
  opmls: v.InferOutput<typeof OPMLS_SCHEMA>,
): Promise<InnerOutlineWUrl[]> {
  const innerL = tagged({
    tag: getOutlinesFromOpmls.name,
    l,
  },);
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
      const { xmlUrl, } = outline;
      if (xmlUrl === undefined || xmlUrl === '') {
        innerL.warn(`outline ${outline.text ?? 'unnamed'} has no xmlUrl`,);
        return false;
      }
      try {
        v.parse(
          v.pipe(
            v.string(),
            v.url(),
            v.check(
              function isHttpDomainUrl(s,) {
                const u = new URL(s,);
                return /^https?:$/.test(u.protocol,) && v.DOMAIN_REGEX.test(u.hostname,);
              },
              'Invalid HTTP(S) URL with valid domain',
            ),
          ),
          xmlUrl,
        );
        return true;
      }
      catch (error) {
        innerL.warn(`${xmlUrl} failed validation: ${JSON.stringify(error,)}`,);
        return false;
      }
    },
  );
  innerL.debug(`${String(result.length,)} valid inner outlines`,);
  return result;
}

/**
 * Safely parses an array of OPML XML strings, discarding unparseable entries.
 *
 * @param texts - Raw OPML XML strings
 *
 * @returns Successfully parsed OPML documents
 */
function parseSafe(texts: string[],): Opml.Document<string>[] {
  const innerL = tagged({
    tag: parseSafe.name,
    l,
  },);
  return texts.flatMap(function tryParse(text,) {
    try {
      return [parseOpml(text,),];
    }
    catch (error) {
      innerL.warn(`OPML parse failed: ${JSON.stringify(error,)}`,);
      return [];
    }
  },);
}

//endregion OPML parsing and outline extraction
