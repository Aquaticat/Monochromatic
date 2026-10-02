import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';

import { signaturesOf, } from './corpus-run/attribution-line.ts';
import {
  declaredNameNote,
  type DeclaredNamePair,
} from './linked-title-declared-name.ts';
import { visibleText, } from './page-visible-text.ts';
import {
  htmlHeadings,
  markdownHeadings,
  type PlacedText,
} from './page-headings.ts';
import { carriesHan, } from './han-only-text.ts';
import { codePointCount, } from './code-points.ts';

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
   Where the pair was read: the link's href, the signature line, or the heading it stands in.
   */
  readonly evidence: string;
};

/**
 One inline link.
 */
export type Link = {
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
 Inline links of a document, in order, by one linear scan.

 @param text - document text

 @returns Every `[text](href)` whose text carries no nested bracket and
 whose href carries no space; images are left out. Where a text does carry
 a `[`, the scan resumes at that inner bracket, as CommonMark matches a `]`
 to its nearest opener: `[Maomao[](u)` yields the empty-text link `[](u)`

 @example
 ```ts
 linksOf({ text: 'see [Maomao](https://example.invalid/maomao)', },);
 ```
 */
export function linksOf({ text, }: { readonly text: string; },): readonly Link[] {
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
    if (!carriesHan({ text: link.text, },))
      return [];
    if (codePointCount({ text: link.text, },) > LONGEST_NAME)
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
     Archive's signature at the same position, always present:
     `signaturePairs` returns early unless source and target have the same
     length.
     */
    const partner = nonNullishOrThrow(target[at],);
    /**
     Name as the archive spells it.
     */
    const rendering = partner.name;
    if (rendering === signature.name)
      return [];
    if (!carriesHan({ text: signature.name, },))
      return [];
    return [{
      source: signature.name,
      rendering,
      evidence: 'signature',
    },];
  },);
}

/**
 Pairs read off one kind of heading, in order, when both documents carry the
 same count of it; a differing count is a section one side never carried, and
 the order is then no alignment.

 @param source - the original's headings of that kind, in page order

 @param target - the archive's headings of that kind, in page order

 @returns Each Han heading the archive renders otherwise, with where the original's stands

 @example
 ```ts
 const pairs = pairsInOrder({ source: markdownHeadings({ text: sourceText, },), target: markdownHeadings({ text: targetText, },), },);
 ```
 */
function pairsInOrder(
  {
    source,
    target,
  }: {
    readonly source: readonly PlacedText[];
    readonly target: readonly PlacedText[];
  },
): readonly {
  readonly at: number;
  readonly name: PageName;
}[] {
  if ((source.length === 0) || (source.length !== target.length))
    return [];
  return source.flatMap(function toPair(
    heading,
    index,
  ): readonly {
    readonly at: number;
    readonly name: PageName;
  }[] {
    /**
     Archive's heading at the same position, always present: `pairsInOrder`
     returns early unless source and target have the same length.
     */
    const rendering = nonNullishOrThrow(target[index],)
      .text;
    if ((rendering === '') || (rendering === heading.text))
      return [];
    if (!carriesHan({ text: heading.text, },))
      return [];
    return [{
      at: heading.at,
      name: {
        source: heading.text,
        rendering,
        evidence: 'heading',
      },
    },];
  },);
}

/**
 Pairs read off the headings: Markdown headings among themselves and HTML
 headings among themselves, each by order under the same-count rule, listed
 by where the original's heading stands.

 TWO STREAMS, NOT ONE (ledger X20). The glossary read Markdown headings only,
 so an archive's rendering of an HTML heading never reached the sheets: at the
 pin, 3 of 92 originals carry HTML headings with Han, and on aiyysk (2) and
 mikaela_khara (1) the archive carries the same count. Counting both kinds in
 one order would let an HTML heading only one side carries unpair every
 Markdown heading on the page.

 THE JUDGES KEEP DECIDING HEADINGS (owner, 2026-09-21, on 左右 shipped as
 "Left and Right" over the archive's "Conflict" on two hulicaijia passes):
 the archive's wording is evidence the sheet carries, not a restore, since
 the literal reading winning is the judges' world knowledge falling short.
 Measured over the pinned corpus: 81 of 92 pages carry the same Markdown
 heading count on both sides, 225 pairs.

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
  return [
    ...pairsInOrder({
      source: markdownHeadings({ text: sourceText, },),
      target: markdownHeadings({ text: targetText, },),
    },),
    ...pairsInOrder({
      source: htmlHeadings({ text: sourceText, },),
      target: htmlHeadings({ text: targetText, },),
    },),
  ]
    .toSorted(function byPlace(
      left,
      right,
    ): number {
      return left.at - right.at;
    },)
    .map(function nameOf(placed,): PageName {
      return placed.name;
    },);
}

/**
 Pairs the page shows, links first, one per source text.

 @param sourceText - whole original document

 @param targetText - whole archive document

 @returns Each source text the archive renders, with its rendering and evidence

 @example
 ```ts
 const pairs = pageNamePairs({ sourceText, targetText, },);
 ```
 */
function pageNamePairs(
  {
    sourceText,
    targetText,
  }: {
    readonly sourceText: string;
    readonly targetText: string;
  },
): readonly PageName[] {
  /**
   Source texts already named.
   */
  const named = new Set<string>();
  /**
   What each page shows, which is all the names it renders (ledger E10: the
   front matter, comments and code fences paired names and shifted headings).
   */
  const shown = {
    sourceText: visibleText({ text: sourceText, },),
    targetText: visibleText({ text: targetText, },),
  };
  return [
    ...linkedTextPairs(shown,),
    ...signaturePairs(shown,),
    ...headingPairs(shown,),
  ].filter(function firstOnly(pair,): boolean {
    if (named.has(pair.source,))
      return false;
    named.add(pair.source,);
    return true;
  },);
}

/**
 Source texts whose rendering the archive already gives on this page, so a
 stage settling repeated titles (ledger H16, `page-title-spans.ts`) leaves
 them to this block.

 @param sourceText - whole original document

 @param targetText - whole archive document

 @returns Each paired source text

 @example
 ```ts
 const paired = pairedPageNames({ sourceText, targetText, },);
 ```
 */
export function pairedPageNames(
  {
    sourceText,
    targetText,
  }: {
    readonly sourceText: string;
    readonly targetText: string;
  },
): ReadonlySet<string> {
  return new Set(pageNamePairs({
    sourceText,
    targetText,
  },)
    .map(function sourceOf(pair,): string {
      return pair.source;
    },),);
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
   Pairs, links first, one per source text.
   */
  const pairs = pageNamePairs({
    sourceText,
    targetText,
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
