import {
  createObservable,
  mapIterableAsync,
  notNullishOrThrow,
} from '@monochromatic-dev/module-es';
import {
  type Opml,
  parseOpml,
} from 'feedsmith';
import { readFile, } from 'node:fs/promises';
import type { Outline, } from 'node_modules/feedsmith/dist/opml/parse/types';
import {
  dirname,
  resolve,
} from 'path';
import { fileURLToPath, } from 'node:url';
import { z, } from 'zod/v4-mini';
import { onInnerOutlinesWUrlChange, } from './feed.ts';
import {
  DOT_ENV_PATH,
  OPMLS_SCHEMA,
} from './opmls.ts';
import { lOutline as l, } from './log.ts';

/**
 * Fetches the text content of all configured OPML files.
 * Handles both HTTP(S) URLs and file URLs with appropriate error handling.
 * @returns Promise resolving to an array of OPML file contents
 * @throws {@link Error} If any OPML file cannot be fetched or read
 * @example
 * ```typescript
 * const opmlTexts = await getOPMLTexts();
 * ```
 * @see {@link OPMLS} for the source URLs
 * @see {@link fetch} for HTTP requests
 * @see {@link readFile} for file reading
 */
async function getOPMLTexts(opmls: z.infer<typeof OPMLS_SCHEMA>,): Promise<string[]> {
  l.debug`getOPMLTexts`;
  const DISCARD = Symbol('discard',);
  const result = (await mapIterableAsync(
    async function isResponding(
      opmlLink: (z.infer<typeof OPMLS_SCHEMA>)[number],
    ): Promise<string | typeof DISCARD> {
      if (opmlLink.startsWith('http',)) {
        const response = await fetch(opmlLink,);
        if (!response.ok) {
          l.warn`${opmlLink} not ok`;
          return DISCARD;
        }
        try {
          return await response.text();
        }
        catch (event) {
          l.warn`${event} converting ${response} to text for ${opmlLink}`;
          return DISCARD;
        }
      }
      if (opmlLink.startsWith('file',)) {
        if (opmlLink.startsWith('file:///',)) {
          try {
            return await readFile(fileURLToPath(opmlLink,), 'utf8',);
          }
          catch (event) {
            l.warn`${event} failed reading ${opmlLink}`;
            return DISCARD;
          }
        }
        const absPath = resolve(dirname(notNullishOrThrow(DOT_ENV_PATH,),), opmlLink
          .slice('file://'.length,),);
        try {
          return await readFile(absPath, 'utf8',);
        }
        catch (event) {
          l.warn`${event} failed reading ${opmlLink} ${absPath}`;
        }
      }
      l.warn`${opmlLink} unsupported protocol`;
      return DISCARD;
    },
    opmls,
  ))
    .filter(function notDiscard(opmlText,) {
      return opmlText !== DISCARD;
    },);
  l.debug`getOPMLTexts ${result[0]} * ${result.length}`;
  return result;
}

/**
 * Parses raw OPML text content into structured OPML objects.
 * Uses the feedsmith library for parsing with error handling.
 * @param OPMLTexts - Array of OPML file contents as strings
 * @returns Array of parsed OPML objects
 * @example
 * ```typescript
 * const opmlTexts = await getOPMLTexts();
 * const parsedOPMLs = getParsedOPMLs(opmlTexts);
 * ```
 * @see {@link parseOpml} for the parsing implementation
 * @see {@link getOPMLTexts} for the source of OPML texts
 */
function getParsedOPMLs(OPMLTexts: string[],): Opml[] {
  l.debug`getParsedOPMLs`;
  const DISCARD = Symbol('discard',);
  const returns = OPMLTexts
    .map(function parse(OPMLText,) {
      try {
        return parseOpml(OPMLText,);
      }
      catch (error) {
        l.warn`${error} parse ${OPMLText}`;
        return DISCARD;
      }
    },)
    .filter(function notDiscard(parsedOPML,) {
      return parsedOPML !== DISCARD;
    },);
  l.debug`getParsedOPMLs ${returns[0]} * ${returns.length}`;
  return returns;
}

/**
 * Extracts the outer outlines from parsed OPML objects.
 * These represent the top-level categories or groups in the OPML structure.
 * @param parsedOPMLs - Array of parsed OPML objects
 * @returns Array of outer outline objects
 * @example
 * ```typescript
 * const parsedOPMLs = getParsedOPMLs(opmlTexts);
 * const outerOutlines = getOuterOutlines(parsedOPMLs);
 * ```
 * @see {@link getParsedOPMLs} for the source of parsed OPMLs
 */
function getOuterOutlines(parsedOPMLs: Opml[],): Outline[] {
  l.debug`getOuterOutlines`;
  const DISCARD = Symbol('discard',);
  const returns: Outline[] = parsedOPMLs
    .map(function _getOuterOutline(parsedOpml,): typeof DISCARD | Outline[] {
      const body = parsedOpml.body;
      if (!body) {
        l.warn`${parsedOpml} no body`;
        return DISCARD;
      }
      const outlines = body.outlines;
      if (!outlines) {
        l.warn`${body} no outline`;
        return DISCARD;
      }
      if (outlines.length === 0) {
        l.warn`${outlines} from ${body} empty`;
        return DISCARD;
      }
      return outlines;
    },)
    .filter(function notDiscard(value,) {
      return value !== DISCARD;
    },)
    .flat();
  l.debug`getOuterOutlines ${returns[0]} * ${returns.length}`;
  return returns;
}

/**
 * Extracts the inner outlines from outer outline objects.
 * These represent the individual RSS feeds within each category.
 * @param outerOutlines - Array of outer outline objects
 * @returns Array of inner outline objects (RSS feeds)
 * @example
 * ```typescript
 * const outerOutlines = getOuterOutlines(parsedOPMLs);
 * const innerOutlines = getInnerOutlines(outerOutlines);
 * ```
 * @see {@link getOuterOutlines} for the source of outer outlines
 */
function getInnerOutlines(outerOutlines: Outline[],): Outline[] {
  l.debug`getInnerOutlines`;
  const DISCARD = Symbol('discard',);
  const returns = outerOutlines
    .map(function _getInnerOutline(outline,) {
      const outlines = outline.outlines;
      if (!outlines) {
        l.warn`${outline} no outlines`;
        return DISCARD;
      }
      if (outlines.length === 0) {
        l.warn`${outlines} no outline from ${outline}`;
        return DISCARD;
      }
      return outlines;
    },)
    .filter(function notDiscard(value,) {
      return value !== DISCARD;
    },)
    .flat();

  l.debug`getInnerOutlines ${returns[0]} * ${returns.length}`;
  return returns;
}

/**
 * Type definition for inner outline objects that have a valid XML URL.
 * Extends the base Outline type with a required xmlUrl property.
 * @see {@link Outline} for the base type
 */
export type InnerOutlineWUrl = Outline & { xmlUrl: string; };

/**
 * Filters inner outlines to only those with valid XML URLs.
 * Validates URLs using Zod schema and ensures they are HTTP(S) URLs.
 * @param innerOutlines - Array of inner outline objects
 * @returns Array of inner outlines with valid XML URLs
 * @example
 * ```typescript
 * const innerOutlines = getInnerOutlines(outerOutlines);
 * const validOutlines = getInnerOutlinesWUrl(innerOutlines);
 * ```
 * @see {@link getInnerOutlines} for the source of inner outlines
 * @see {@link z.url} for URL validation
 */
function getInnerOutlinesWUrl(innerOutlines: Outline[],): InnerOutlineWUrl[] {
  l.debug`getInnerOutlinesWUrl`;
  const innerOutlinesWUrl: Outline & { xmlUrl: string; }[] = innerOutlines.filter(
    function discardNoXmlUrl(
      innerOutline: Outline,
    ): innerOutline is Outline & { xmlUrl: string; } {
      const xmlUrl = innerOutline.xmlUrl;
      if (!xmlUrl) {
        l.warn`${innerOutline} no xmlUrl`;
        return false;
      }
      try {
        z
          .url({
            protocol: /^https?$/,
            hostname: z.regexes.domain,
          },)
          .parse(xmlUrl,);
      }
      catch (error) {
        l.warn`${error} ${innerOutline} ${xmlUrl} unsupported`;
        return false;
      }
      return true;
    },
  );
  l.debug`getInnerOutlinesWUrl ${innerOutlinesWUrl[0]} * ${innerOutlinesWUrl.length}`;

  return innerOutlinesWUrl;
}

/**
 * Current collection of inner outlines with valid XML URLs.
 * Updated automatically when OPML files change.
 * @see {@link updateInnerOutlinesWUrl} for the update mechanism
 */
const innerOutlinesWUrl: InnerOutlineWUrl[] = [];

const innerOutlinesWUrlObservable = createObservable(innerOutlinesWUrl,
  onInnerOutlinesWUrlChange,);

export async function onOpmlsChange(opmls: z.infer<typeof OPMLS_SCHEMA>,): Promise<void> {
  l.debug`onOpmlsChange`;

  innerOutlinesWUrlObservable.value = await getNewInnerOutlinesWUrl(opmls,);

  l.debug`onOpmlsChange innerOutlinesWUrlObservable ${
    innerOutlinesWUrlObservable.value.at(-1,)
  } * ${innerOutlinesWUrlObservable.value.length}`;
}

async function getNewInnerOutlinesWUrl(
  opmls: z.infer<typeof OPMLS_SCHEMA>,
): Promise<InnerOutlineWUrl[]> {
  l.debug`getNewInnerOutlinesWUrl`;
  const result = getInnerOutlinesWUrl(
    getInnerOutlines(getOuterOutlines(getParsedOPMLs(await getOPMLTexts(opmls,),),),),
  );
  l.debug`getNewInnerOutlinesWUrl ${result.at(-1,)} * ${result.length}`;
  return result;
}
