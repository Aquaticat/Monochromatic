import { signaturesOf, } from './corpus-run/attribution-line.ts';
import {
  declaredNameNote,
  type DeclaredNamePair,
} from './linked-title-declared-name.ts';

//region Page name glossary
// CLASS SEVENTY-ONE (mikaela_khara, 2026-09-19). The author's handle 铨铨
// reached the page as "Quan" in one line of dialogue while the archive
// renders the same handle as a stylised form in its link text and every
// other line, because no sheet told the bench how this page renders that
// name. Class sixty-seven restores signatures and headings at assembly, but
// a name inside a paragraph has no aligned line to read the page's rendering
// off, so the bench has to know it before it writes.
//
// THE PAGE'S OWN RENDERINGS ARE READABLE AT PREPARATION. A link the source
// and the archive both carry under one href pairs the source's text with
// the archive's rendering (`[铨](url)` beside `[𝓠𝓾𝓪𝓷](url)`), and the
// source's signature lines pair with the archive's in order when both carry
// the same count. Those pairs join the identity context beside the
// community glossary (`community-glossary.ts`), so every sheet that carries
// the declared names carries them: evidence to weigh, not a rule the floor
// enforces.

/**
 Longest link text read as a name or a title, in code points; a longer one
 is a quoted sentence.
 */
const LONGEST_NAME = 24;

/**
 First Han character.
 */
const HAN_FIRST = '\u{4E00}';

/**
 Last Han character.
 */
const HAN_LAST = '\u{9FFF}';

/**
 Heading of the sheet block.
 */
const HEADING = 'NAMES AND LINKED TEXT THE ARCHIVE RENDERS ON THIS PAGE '
  + '(render the same person or title the same way everywhere; a declared name inside a title takes its declared form):';

/**
 One name or title as the source writes it and as the archive renders it.
 */
type PageName = {
  /**
   Text as the source writes it.
   */
  readonly source: string;

  /**
   Text as the archive renders it.
   */
  readonly rendering: string;

  /**
   Where the pair was read: the link's href, or the signature line.
   */
  readonly evidence: string;
};

/**
 One inline link.
 */
type Link = {
  /**
   Link text.
   */
  readonly text: string;

  /**
   Destination.
   */
  readonly href: string;
};

/**
 Whether a text carries a Han character.

 @param text - text to scan

 @returns True on the first Han character

 @example
 ```ts
 hasHan({ text: '猫猫', },); // true
 ```
 */
function hasHan({ text, }: { readonly text: string; },): boolean {
  for (const character of text) {
    if ((character >= HAN_FIRST) && (character <= HAN_LAST))
      return true;
  }
  return false;
}

/**
 Count of code points in a text.

 @param text - text to count

 @returns Code points

 @example
 ```ts
 codePoints({ text: '猫', },); // 1
 ```
 */
function codePoints({ text, }: { readonly text: string; },): number {
  /**
   Code points seen.
   */
  let count = 0;
  for (const character of text) {
    if (character !== '')
      count += 1;
  }
  return count;
}

/**
 Inline links of a document, in order, by one linear scan.

 @param text - document text

 @returns Every `[text](href)` whose text carries no nested bracket and
 whose href carries no space; images are left out

 @example
 ```ts
 linksOf({ text: 'see [Maomao](https://example.invalid/maomao)', },);
 ```
 */
function linksOf({ text, }: { readonly text: string; },): readonly Link[] {
  /**
   Links found.
   */
  const links: Link[] = [];
  for (
    let open = text.indexOf('[',);
    open !== (-1);
    open = text.indexOf(
      '[',
      open + 1,
    )
  ) {
    /**
     Closing bracket of this link text.
     */
    const close = text.indexOf(
      ']',
      open + 1,
    );
    if (close === (-1))
      break;
    if (text.charAt(close + 1,) !== '(')
      continue;
    /**
     Closing paren of the destination.
     */
    const end = text.indexOf(
      ')',
      close + 2,
    );
    if (end === (-1))
      break;
    if (text.charAt(open - 1,) === '!')
      continue;
    /**
     Link text.
     */
    const linkText = text.slice(
      open + 1,
      close,
    );
    /**
     Destination.
     */
    const href = text.slice(
      close + 2,
      end,
    );
    if (linkText.includes('[',) || href.includes(' ',))
      continue;
    links.push({
      text: linkText,
      href,
    },);
  }
  return links;
}

/**
 Pairs read off links both documents carry under one href, where the
 source's text is Han, short enough to be a name or a title, and the
 archive's differs.

 @param sourceText - whole original document

 @param targetText - whole archive document

 @returns One pair per such link, in source order

 @example
 ```ts
 const pairs = linkedTextPairs({ sourceText, targetText, },);
 ```
 */
function linkedTextPairs(
  {
    sourceText,
    targetText,
  }: {
    readonly sourceText: string;
    readonly targetText: string;
  },
): readonly PageName[] {
  /**
   Archive's links.
   */
  const archiveLinks = linksOf({ text: targetText, },);
  /**
   Archive link text by href.
   */
  const rendered = new Map<string, string>(archiveLinks.map(function byHref(link,): readonly [
    string,
    string,
  ] {
    return [
      link.href,
      link.text,
    ];
  },),);
  /**
   Source's links.
   */
  const sourceLinks = linksOf({ text: sourceText, },);
  return sourceLinks.flatMap(function toPair(link,): readonly PageName[] {
    /**
     Archive's text under the same href, absent when the archive lacks it.
     */
    const rendering = rendered.get(link.href,);
    if ((rendering === undefined) || (rendering === link.text))
      return [];
    if (!hasHan({ text: link.text, },))
      return [];
    if (codePoints({ text: link.text, },) > LONGEST_NAME)
      return [];
    return [{
      source: link.text,
      rendering,
      evidence: `link text, ${link.href}`,
    },];
  },);
}

/**
 Pairs read off the signature lines, in order, when both documents carry
 the same count; a differing count means a section the archive never
 carried, and the order is then no alignment.

 @param sourceText - whole original document

 @param targetText - whole archive document

 @returns One pair per signature whose Han name the archive spells otherwise

 @example
 ```ts
 const pairs = signaturePairs({ sourceText, targetText, },);
 ```
 */
function signaturePairs(
  {
    sourceText,
    targetText,
  }: {
    readonly sourceText: string;
    readonly targetText: string;
  },
): readonly PageName[] {
  /**
   Source signatures in order.
   */
  const source = signaturesOf({ text: sourceText, },);
  /**
   Archive signatures in order.
   */
  const target = signaturesOf({ text: targetText, },);
  if ((source.length === 0) || (source.length !== target.length))
    return [];
  return source.flatMap(function toPair(
    signature,
    at,
  ): readonly PageName[] {
    /**
     Archive's signature at the same position.
     */
    const partner = target[at];
    if (partner === undefined)
      return [];
    /**
     Name as the archive spells it.
     */
    const rendering = partner.name;
    if (rendering === signature.name)
      return [];
    if (!hasHan({ text: signature.name, },))
      return [];
    return [{
      source: signature.name,
      rendering,
      evidence: 'signature',
    },];
  },);
}

/**
 Heading texts of a document in order, the markers off.

 @param text - whole document

 @returns Every ATX heading's text

 @example
 ```ts
 headingsOf({ text: '## 左右\n\n猫在门口犹豫。', },); // ['左右']
 ```
 */
function headingsOf({ text, }: { readonly text: string; },): readonly string[] {
  return text
    .split('\n',)
    .flatMap(function toHeading(line,): readonly string[] {
      if (!line.startsWith('#',))
        return [];
      for (let depth = 0; depth <= line.length; depth += 1) {
        if (line.charAt(depth,) === '#')
          continue;
        if (line.charAt(depth,) !== ' ')
          return [];
        /**
         Text after the markers.
         */
        const heading = line.slice(depth,);
        return [heading.trim(),];
      }
      return [];
    },);
}

/**
 Pairs read off the headings, in order, when both documents carry the same
 count; a differing count is a section one side never carried, and the order
 is then no alignment.

 THE JUDGES KEEP DECIDING HEADINGS (owner, 2026-09-21, on 左右 shipped as
 "Left and Right" over the archive's "Conflict" on two hulicaijia passes):
 the archive's wording is evidence the sheet carries, not a restore, since
 the literal reading winning is the judges' world knowledge falling short.
 Measured over the pinned corpus: 81 of 92 pages carry the same heading
 count on both sides, 225 pairs.

 @param sourceText - whole original document

 @param targetText - whole archive document

 @returns One pair per Han heading the archive renders otherwise

 @example
 ```ts
 const pairs = headingPairs({ sourceText, targetText, },);
 ```
 */
function headingPairs(
  {
    sourceText,
    targetText,
  }: {
    readonly sourceText: string;
    readonly targetText: string;
  },
): readonly PageName[] {
  /**
   Source headings in order.
   */
  const source = headingsOf({ text: sourceText, },);
  /**
   Archive headings in order.
   */
  const target = headingsOf({ text: targetText, },);
  if ((source.length === 0) || (source.length !== target.length))
    return [];
  return source.flatMap(function toPair(
    heading,
    at,
  ): readonly PageName[] {
    /**
     Archive's heading at the same position.
     */
    const rendering = target[at];
    if (rendering === undefined)
      return [];
    if ((rendering === '') || (rendering === heading))
      return [];
    if (!hasHan({ text: heading, },))
      return [];
    return [{
      source: heading,
      rendering,
      evidence: 'heading',
    },];
  },);
}

/**
 Identity-context lines naming how this page renders its people, linked
 titles and headings, read off the archive: a heading and one line per
 distinct source text, empty when the page carries none.

 @param sourceText - whole original document

 @param targetText - whole archive document

 @returns Sheet lines

 @example
 ```ts
 const lines = pageNameLines({ sourceText, targetText, },);
 ```
 */
export function pageNameLines(
  {
    sourceText,
    targetText,
    declared = [],
  }: {
    readonly sourceText: string;
    readonly targetText: string;
    readonly declared?: readonly DeclaredNamePair[];
  },
): readonly string[] {
  /**
   Source texts already named.
   */
  const named = new Set<string>();
  /**
   Pairs, links first, one per source text.
   */
  const pairs = [
    ...linkedTextPairs({
      sourceText,
      targetText,
    },),
    ...signaturePairs({
      sourceText,
      targetText,
    },),
    ...headingPairs({
      sourceText,
      targetText,
    },),
  ].filter(function firstOnly(pair,): boolean {
    if (named.has(pair.source,))
      return false;
    named.add(pair.source,);
    return true;
  },);
  if (pairs.length === 0)
    return [];
  return [
    HEADING,
    ...pairs.map(function toLine(pair,): string {
      /**
       Where this pair was read (class eighty-six reads only links).
       */
      const { evidence, } = pair;
      /**
       Whether that evidence is a link.
       */
      const isLink = evidence.startsWith('link text',);
      /**
       Note for a linked title, none for a signature or heading.
       */
      const note = isLink
        ? declaredNameNote({
          source: pair.source,
          rendering: pair.rendering,
          declared,
        },)
        : '';
      return `- ${pair.source} (${pair.evidence}): "${pair.rendering}"${note}`;
    },),
  ];
}

//endregion Page name glossary
