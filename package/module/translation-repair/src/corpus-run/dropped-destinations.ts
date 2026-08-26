import type {
  Root,
  RootContent,
} from 'mdast';
import { splitFrontMatter, } from '../front-matter.ts';
import { maskHtmlComments, } from '../mask-html-comments.ts';
import { maskInvisibleLines, } from '../mask-invisible-lines.ts';
import { parseBodyTolerant, } from '../parse-document.ts';
import type { DeepReadonlyData, } from '../readonly-data.ts';

//region Dropped destinations
// WHAT THE SOURCE LINKS TO THAT THE PAGE NO LONGER DOES.
//
// The naturalness lane protects link destinations as ordered atoms, so a
// rewrite cannot drop one. Nothing protected them across the other two ways a
// slice ships: the repair lane keeping an archive sentence that never carried
// the link, and the contest preferring the incumbent. The 2026-08-26 reading
// (`doc/audit/translation-repair-output-reading-20260826.md`) found a page
// that had lost a source hyperlink exactly that way, with nothing having
// noticed. This is the document-level check that notices.
//
// TWO READERS, UNIONED. Markdown destinations come off the tree the pipeline
// itself parses (front matter split, invisible lines and HTML comments masked,
// strict MDX with the plain-markdown downgrade), which also covers reference
// definitions; bare runs come off a linear scan for the two web schemes, which
// also covers front matter and HTML attributes. A destination is a string; two
// spellings of one address that differ only by a trailing slash are treated as
// the same address, because that difference changes nothing a reader can
// follow.
//
// THE SITE'S OWN GRAMMAR IS NOT THIS ONE. The corpus repo compiles a page with
// MDX 3 and remark-math after rewriting HTML comments into JSX comments
// (`scripts/build.ts`, `scripts/mdx.ts` there); `#267` tracks reconciling the
// two. For destinations the difference does not matter: a link is a link under
// both, and the bare-run scan catches what either tree would not.
//
// A DROPPED DESTINATION IS REPORTED, NOT REFUSED. The page is what both
// deciders approved, and a refusal here would hold a whole entry for one link
// the pipeline cannot restore at this point; the count goes on stdout beside
// the tally line and the addresses go to the run log, where the reading picks
// them up.

/**
 * Parsed page, read-only.
 */
type ReadonlyMdastRoot = DeepReadonlyData<Root>;

/**
 * Any node of a parsed page, read-only.
 */
type ReadonlyMdastContent = DeepReadonlyData<RootContent>;

/**
 * Schemes a bare run may start with.
 */
const SCHEMES = [
  'https://',
  'http://',
] as const;

/**
 * Characters that end a bare run: whitespace, Markdown and HTML delimiters, and
 * the full-width punctuation Chinese prose sets a link off with.
 */
const RUN_STOPPERS: ReadonlySet<string> = new Set([
  ' ',
  '\t',
  '\n',
  '\r',
  ')',
  ']',
  '>',
  '<',
  '"',
  '\'',
  '`',
  '）',
  '（',
  '】',
  '【',
  '，',
  '。',
  '、',
  '《',
  '》',
  '「',
  '」',
  '；',
  '：',
],);

/**
 * Trailing characters a run sheds, since sentence punctuation follows a link
 * more often than it belongs to one.
 */
const RUN_TRAILERS: ReadonlySet<string> = new Set([
  '.',
  ',',
  ';',
  ':',
  '!',
  '?',
],);

/**
 * What the check found on both sides.
 *
 * @example
 * ```ts
 * const check: DestinationCheck = droppedDestinations({ sourceText, pageText, },);
 * ```
 */
export type DestinationCheck = {
  /**
   * Distinct destinations the source carries, in first-seen order.
   */
  readonly source: readonly string[];

  /**
   * Distinct destinations the page carries, in first-seen order.
   */
  readonly page: readonly string[];

  /**
   * Source destinations the page does not carry.
   */
  readonly dropped: readonly string[];

  /**
   * Telemetry in scorecard-stable wording, empty unless the strict grammar
   * downgraded a side to plain markdown.
   */
  readonly findings: readonly string[];
};

/**
 * Position of the nearest scheme at or after `from`, or positive infinity when
 * none remains.
 *
 * @param text - text scanned
 *
 * @param from - offset to scan from
 *
 * @returns Offset of the scheme that starts first
 *
 * @example
 * ```ts
 * const at = nearestScheme({ text, from: 0, },);
 * ```
 */
function nearestScheme(
  {
    text,
    from,
  }: {
    readonly text: string;
    readonly from: number;
  },
): number {
  return SCHEMES
    .map(function positionOf(scheme,): number {
      return text.indexOf(
        scheme,
        from,
      );
    },)
    .filter(function present(at,): boolean {
      return at >= 0;
    },)
    .reduce(
      function earliest(
        best,
        at,
      ): number {
        return (at < best) ? at : best;
      },
      Number.POSITIVE_INFINITY,
    );
}

/**
 * Bare web addresses in the text, as one linear pass.
 *
 * COVERS WHAT THE TREE CANNOT: front matter and HTML attributes. A Markdown
 * destination shows up here too, because its
 * address starts with a scheme like any other; the union dedupes it.
 *
 * @param text - text scanned
 *
 * @returns Runs in the order found, repeats kept
 *
 * @example
 * ```ts
 * const runs = scanUrlRuns({ text: 'see https://example.org/a, then https://example.org/b', },);
 * ```
 */
export function scanUrlRuns({ text, }: { readonly text: string; },): readonly string[] {
  /**
   * Runs found so far.
   */
  const runs: string[] = [];

  /**
   * Cursor, advanced past every run or scheme examined.
   */
  let at = 0;
  while (at < text.length) {
    /**
     * Where the next run starts, infinite when no scheme remains.
     */
    const start = nearestScheme({
      text,
      from: at,
    },);
    if (!Number.isFinite(start,))
      break;

    /**
     * End of the run, exclusive: the first stopper after the scheme.
     */
    let end = start;
    while ((end < text.length) && (!RUN_STOPPERS.has(text.charAt(end,),)))
      end += 1;

    runs.push(trimDestination({ url: text.slice(
      start,
      end,
    ), },),);
    at = (end > start) ? end : start + 1;
  }
  return runs;
}

/**
 * Destination as a reader would follow it: cut at the first stopper, trailing
 * sentence punctuation shed.
 *
 * A GFM autolink literal runs until whitespace, so in Chinese prose it swallows
 * the full-width comma or stop after the address; the scanner never does, and
 * the two readers must agree on the address or the union counts one link twice.
 *
 * @param url - destination as the tree or the scan produced it
 *
 * @returns Destination ending where a reader's address ends
 *
 * @example
 * ```ts
 * const clean = trimDestination({ url: 'https://example.org/a\uff0c', },);
 * ```
 */
function trimDestination({ url, }: { readonly url: string; },): string {
  /**
   * End of the address, exclusive: the first stopper.
   */
  let end = 0;
  while ((end < url.length) && (!RUN_STOPPERS.has(url.charAt(end,),)))
    end += 1;

  /**
   * Address with its trailing sentence punctuation shed.
   */
  let run = url.slice(
    0,
    end,
  );
  while ((run.length > 0) && RUN_TRAILERS.has(run.at(-1,) ?? '',))
    run = run.slice(
      0,
      -1,
    );
  return run;
}

/**
 * Link, image and definition destinations off the tree the pipeline parses.
 *
 * @param text - page or source text, front matter included
 *
 * @returns Destinations in document order, and the downgrade finding when the
 * strict grammar refused the body
 *
 * @example
 * ```ts
 * const { urls, findings, } = markdownDestinations({ text, },);
 * ```
 */
export function markdownDestinations(
  { text, }: { readonly text: string; },
): {
  readonly urls: readonly string[];
  readonly findings: readonly string[];
} {
  /**
   * Front matter and body apart, as `parseDocument` splits them.
   */
  const split = splitFrontMatter({ text, },);

  /**
   * Body with the lines that show nothing masked, as `parseDocument` does.
   */
  const { masked: unwelded, } = maskInvisibleLines({ text: split.body, },);

  /**
   * Body with HTML comments masked to whitespace, as `parseDocument` does.
   */
  const { masked, } = maskHtmlComments({ text: unwelded, },);

  /**
   * Tree and any downgrade finding, under the pipeline's own grammar.
   */
  const parsed = parseBodyTolerant({
    body: masked,
    bodyOffset: split.bodyOffset,
  },);

  /**
   * Parsed body, read-only.
   */
  const root: ReadonlyMdastRoot = parsed.root;

  /**
   * Destinations in document order.
   */
  const urls: string[] = [];

  /**
   * Nodes still to visit, top of the stack first, so the walk is document order.
   */
  const pending: ReadonlyMdastContent[] = [...root.children,].toReversed();
  while (pending.length > 0) {
    /**
     * Node under visit.
     */
    const node = pending.pop();
    if (node === undefined)
      break;
    if ((node.type === 'link')
      || (node.type === 'image')
      || (node.type === 'definition'))
      urls.push(trimDestination({ url: node.url, },),);
    if ('children' in node) {
      /**
       * Children in document order, pushed reversed so the first is visited first.
       */
      const children = [...node.children,];
      pending.push(...children.toReversed(),);
    }
  }
  return {
    urls,
    findings: parsed
      .findings
      .map(function named(finding,): string {
        return `destinations-${finding.kind}`;
      },),
  };
}

/**
 * Address with a trailing slash shed, so two spellings of one address compare
 * equal.
 *
 * @param url - address as written
 *
 * @returns Address without a trailing slash
 *
 * @example
 * ```ts
 * const same = sameAddress({ url: 'https://example.org/a/', },) === sameAddress({ url: 'https://example.org/a', },);
 * ```
 */
function sameAddress({ url, }: { readonly url: string; },): string {
  return url.endsWith('/',) ? url.slice(
    0,
    -1,
  ) : url;
}

/**
 * Every destination a text carries, from both readers, deduped in first-seen
 * order.
 *
 * @param text - page or source text
 *
 * @param side - which side, for the finding when the strict grammar downgraded
 *
 * @returns Destinations and any finding
 *
 * @example
 * ```ts
 * const { urls, findings, } = collectDestinations({ text, side: 'source', },);
 * ```
 */
export function collectDestinations(
  {
    text,
    side,
  }: {
    readonly text: string;
    readonly side: 'source' | 'page';
  },
): {
  readonly urls: readonly string[];
  readonly findings: readonly string[];
} {
  /**
   * Tree destinations and any downgrade finding.
   */
  const parsed = markdownDestinations({ text, },);

  /**
   * Both readers' output, tree first so a definition precedes its bare run.
   */
  const combined = [
    ...parsed.urls,
    ...scanUrlRuns({ text, },),
  ];

  /**
   * Addresses already kept, compared with the trailing slash shed.
   */
  const seen = new Set<string>();

  /**
   * Distinct destinations in first-seen order.
   */
  const urls = combined.filter(function firstSeen(url,): boolean {
    /**
     * Address compared, trailing slash shed.
     */
    const key = sameAddress({ url, },);
    if (seen.has(key,))
      return false;
    seen.add(key,);
    return true;
  },);

  return {
    urls,
    findings: parsed
      .findings
      .map(function sided(finding,): string {
        return `${finding} (${side})`;
      },),
  };
}

/**
 * Source destinations the published page does not carry.
 *
 * @param sourceText - whole source page
 *
 * @param pageText - whole published page
 *
 * @returns Both sides' destinations, the dropped ones, and any finding
 *
 * @example
 * ```ts
 * const check = droppedDestinations({ sourceText, pageText, },);
 * if (check.dropped.length > 0) l.warn(`${String(check.dropped.length,)} destinations dropped`,);
 * ```
 */
export function droppedDestinations(
  {
    sourceText,
    pageText,
  }: {
    readonly sourceText: string;
    readonly pageText: string;
  },
): DestinationCheck {
  /**
   * What the source carries.
   */
  const source = collectDestinations({
    text: sourceText,
    side: 'source',
  },);

  /**
   * What the page carries.
   */
  const page = collectDestinations({
    text: pageText,
    side: 'page',
  },);

  /**
   * Page addresses, compared with the trailing slash shed.
   */
  const carried = new Set(page
    .urls
    .map(function key(url,): string {
      return sameAddress({ url, },);
    },),);

  return {
    source: source.urls,
    page: page.urls,
    dropped: source
      .urls
      .filter(function absentFromPage(url,): boolean {
        return !carried.has(sameAddress({ url, },),);
      },),
    findings: [
      ...source.findings,
      ...page.findings,
    ],
  };
}

//endregion Dropped destinations
