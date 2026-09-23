import type { ChunkPair, } from '../chunk-document.ts';
import { isHanOnly, } from '../han-only-text.ts';
import type { SliceReplacement, } from '../splice-slices.ts';
import { withoutComments, } from '../translate-address-drop.ts';
import {
  pageTextBySlice,
  slicesInOrder,
  withRewrittenText,
} from './assembly-page-text.ts';
import { headingTitles, } from './heading-title-lines.ts';
import {
  type LocatedTitle,
  locateTitleRendering,
} from './title-reference-locate.ts';

//region Title reference unify
// CLASS ONE HUNDRED (XingZ630, 2026-09-23). The original heads a section
// 笼中之鸟 and credits the song as 《[笼中之鸟](…)》; it heads another
// 零重祈愿, credits it as 《零重祈愿》 and points a footnote at 「零重祈愿」篇.
// The settled page headed "Bird in a Cage" over the link "The Caged Bird"
// and "Zero-Layer Prayer" over the footnote's "Zero-Degree Prayer";
// XingZ629 had headed "The Bird in the Cage" over the link "Bird in a
// Cage". Every slice is judged alone and no judge sees the heading beside
// the reference. THE PAGE DECIDES ONCE, HERE, where every heading is in
// view: a reference to a section title takes the heading's rendering,
// found in the referencing slice by the link's destination, by the Han
// gloss after the English, by title brackets or by quotes; a slice that
// offers two spans of one shape is reported, not guessed at.

/**
 Marks the original may bracket a title in, opening then closing.
 */
const REFERENCE_MARKS: readonly (readonly [
  string,
  string,
])[] = [
  [
    '《',
    '》',
  ],
  [
    '《[',
    '](',
  ],
  [
    '「',
    '」',
  ],
  [
    '『',
    '』',
  ],
  [
    '“',
    '”',
  ],
  [
    '"',
    '"',
  ],
];

/**
 Punctuation a quoted span may end with, kept outside the rewrite.
 */
const TRAILING_MARKS: ReadonlySet<string> = new Set([
  ',',
  '.',
  '!',
  '?',
],);

/**
 Words a glossed run may exceed the heading's rendering by and still be
 read as the title alone.
 */
const RUN_SLACK = 2;

/**
 Opening parenthesis of a gloss.
 */
const GLOSS_OPEN = '(';

/**
 Closing parenthesis of a gloss.
 */
const GLOSS_CLOSE = ')';

/**
 One section heading as the page renders it.
 */
type RenderedHeading = {
  /**
   Slice whose text carries the heading.
   */
  readonly sliceIndex: number;

  /**
   Title as the original writes it.
   */
  readonly title: string;

  /**
   Title as the page renders it, any Han gloss stripped.
   */
  readonly rendering: string;
};

/**
 Outcome of a rewrite: the text rewritten with what changed, already the
 heading's, or a run that cannot be read as the title alone.
 */
type RewriteOutcome = {
  readonly kind: 'same';
} | {
  readonly kind: 'ambiguous';
} | {
  readonly kind: 'rewritten';
  readonly text: string;
  readonly before: string;
  readonly after: string;
};

/**
 Rendering with a trailing Han gloss of the title stripped.

 @param rendering - heading title as the page renders it

 @param title - Han title

 @returns Rendering without ` (title)` at its end

 @example
 ```ts
 withoutTitleGloss({ rendering: 'Cat (猫)', title: '猫', },); // 'Cat'
 ```
 */
function withoutTitleGloss(
  {
    rendering,
    title,
  }: {
    readonly rendering: string;
    readonly title: string;
  },
): string {
  /**
   Gloss the rendering may end with.
   */
  const gloss = `${GLOSS_OPEN}${title}${GLOSS_CLOSE}`;
  if (!rendering.endsWith(gloss,))
    return rendering;
  return rendering.slice(
    0,
    rendering.length - gloss.length,
  )
    .trim();
}

/**
 Every Han section heading the page renders in English, by title, where
 the page carries as many heading lines as the original for the slice; a
 title two headings share is dropped as ambiguous.

 @param slices - prepared pairs in order

 @param pageText - page text per slice

 @returns Rendered headings by original title

 @example
 ```ts
 const headings = renderedHeadings({ slices, pageText, },);
 ```
 */
function renderedHeadings(
  {
    slices,
    pageText,
  }: {
    readonly slices: readonly ChunkPair[];
    readonly pageText: ReadonlyMap<number, string>;
  },
): ReadonlyMap<string, RenderedHeading> {
  /**
   Headings read so far.
   */
  const headings = new Map<string, RenderedHeading>();
  /**
   Titles two headings share.
   */
  const shared = new Set<string>();
  for (const slice of slices) {
    /**
     Index of this slice.
     */
    const { sliceIndex, } = slice.target;
    /**
     Titles the original heads here.
     */
    const titles = headingTitles({ text: slice.source
      .text, },);
    /**
     Titles the page heads here.
     */
    const rendered = headingTitles({ text: pageText.get(sliceIndex,) ?? '', },);
    if (titles.length !== rendered.length)
      continue;
    titles.forEach(function pairWith(
      title,
      at,
    ): void {
      if (!isHanOnly({ text: title, },))
        return;
      /**
       Rendering without its gloss.
       */
      const rendering = withoutTitleGloss({
        rendering: rendered[at] ?? '',
        title,
      },);
      if ((rendering === '') || (rendering === title))
        return;
      if (isHanOnly({ text: rendering, },))
        return;
      if (headings.has(title,))
        shared.add(title,);
      headings.set(
        title,
        {
          sliceIndex,
          title,
          rendering,
        },
      );
    },);
  }
  for (const title of shared)
    headings.delete(title,);
  return headings;
}

/**
 Whether an original references a title inside any bracketing marks.

 @param sourceText - original text, comments cut

 @param title - Han title

 @returns True when the title stands bracketed

 @example
 ```ts
 referencesTitle({ sourceText: '见「猫」篇', title: '猫', },); // true
 ```
 */
function referencesTitle(
  {
    sourceText,
    title,
  }: {
    readonly sourceText: string;
    readonly title: string;
  },
): boolean {
  return REFERENCE_MARKS.some(function wraps([
    open,
    close,
  ],): boolean {
    return sourceText.includes(`${open}${title}${close}`,);
  },);
}

/**
 Count of words in a run.

 @param text - run of words

 @returns Words separated by spaces

 @example
 ```ts
 wordCount({ text: 'Cat in a Cage', },); // 4
 ```
 */
function wordCount({ text, }: { readonly text: string; },): number {
  /**
   Words of the run.
   */
  const words = text.split(' ',)
    .filter(function nonEmpty(word,): boolean {
      return word !== '';
    },);
  return words.length;
}

/**
 Page text with the located rendering rewritten to the heading's, undefined
 where it already is the heading's or cannot be read as the title alone.

 @param text - page text of the slice

 @param located - where the rendering stands

 @param heading - heading the reference points at

 @returns Rewritten text with what changed, `same` or `ambiguous`

 @example
 ```ts
 const outcome = rewriteLocated({ text, located, heading, },);
 ```
 */
function rewriteLocated(
  {
    text,
    located,
    heading,
  }: {
    readonly text: string;
    readonly located: LocatedTitle;
    readonly heading: RenderedHeading;
  },
): RewriteOutcome {
  /**
   Rendering as the slice wrote it.
   */
  const current = text.slice(
    located.start,
    located.end,
  );
  /**
   Trailing punctuation a quoted span keeps.
   */
  const trailing = TRAILING_MARKS.has(current.slice(-1,),) ? current.slice(-1,) : '';
  /**
   Rendering without the trailing punctuation.
   */
  const core = current.slice(
    0,
    current.length - trailing.length,
  );
  if ((core === heading.rendering) || core.endsWith(heading.rendering,))
    return { kind: 'same', };
  if ((located.kind === 'gloss') && (wordCount({ text: core, },) > (wordCount({ text: heading.rendering, },) + RUN_SLACK)))
    return { kind: 'ambiguous', };
  /**
   Rendering as the heading has it, punctuation kept.
   */
  const after = `${heading.rendering}${trailing}`;
  return {
    kind: 'rewritten',
    text: `${text.slice(
      0,
      located.start,
    )}${after}${text.slice(located.end,)}`,
    before: core,
    after: heading.rendering,
  };
}

/**
 Unifies every reference to a section title with the heading's rendering,
 across the replaced slices.

 @param slices - prepared pairs, whose original names the headings and the
 references

 @param replacements - what the page would write per slice

 @returns Replacements with the references unified, the rewritten rows
 alone, and one finding per reference read

 @example
 ```ts
 const unified = unifyTitleReferences({ slices, replacements, },);
 ```
 */
export function unifyTitleReferences(
  {
    slices,
    replacements,
  }: {
    readonly slices: readonly ChunkPair[];
    readonly replacements: readonly SliceReplacement[];
  },
): {
  readonly replacements: readonly SliceReplacement[];
  readonly restored: readonly SliceReplacement[];
  readonly findings: readonly string[];
} {
  /**
   Page text per slice.
   */
  const pageText = pageTextBySlice({
    slices,
    replacements,
  },);
  /**
   Slices in order.
   */
  const ordered = slicesInOrder({ slices, },);
  /**
   Section headings the page renders in English.
   */
  const headings = renderedHeadings({
    slices: ordered,
    pageText,
  },);
  /**
   Slices a replacement covers.
   */
  const replaced = new Set(replacements.map(function indexOf(replacement,): number {
    return replacement.sliceIndex;
  },),);
  /**
   Page text per slice after the rewrites.
   */
  const rewritten = new Map<number, string>();
  /**
   One finding per reference read.
   */
  const findings: string[] = [];
  for (const slice of ordered) {
    /**
     Index of this slice.
     */
    const { sliceIndex, } = slice.target;
    if (!replaced.has(sliceIndex,))
      continue;
    /**
     Original text of this slice, comments cut.
     */
    const sourceText = withoutComments({ text: slice.source
      .text, },);
    for (const heading of headings.values()) {
      if (heading.sliceIndex === sliceIndex)
        continue;
      if (!referencesTitle({
        sourceText,
        title: heading.title,
      },))
        continue;
      /**
       Page text of this slice as it stands after earlier rewrites.
       */
      const text = rewritten.get(sliceIndex,)
        ?? pageText.get(sliceIndex,)
        ?? '';
      /**
       Where this slice renders the title.
       */
      const located = locateTitleRendering({
        sourceText,
        pageText: text,
        title: heading.title,
      },);
      /**
       Whose rendering the reference takes, for the findings.
       */
      const whose = `「${heading.title}」 rendered by the heading of slice ${String(heading.sliceIndex,)} as "${heading.rendering}"`;
      if (located.kind === 'none') {
        findings.push(`title-reference-unplaced (slice ${String(sliceIndex,)}: ${whose}, no linked, glossed, bracketed or quoted span found)`,);
        continue;
      }
      if (located.kind === 'ambiguous') {
        findings.push(`title-reference-ambiguous (slice ${String(sliceIndex,)}: ${whose}, but the slice offers more than one span to read)`,);
        continue;
      }
      /**
       Rewrite of the located rendering.
       */
      const outcome = rewriteLocated({
        text,
        located,
        heading,
      },);
      if (outcome.kind === 'same')
        continue;
      if (outcome.kind === 'ambiguous') {
        findings.push(`title-reference-ambiguous (slice ${String(sliceIndex,)}: ${whose}, but the glossed run reads as more than the title)`,);
        continue;
      }
      rewritten.set(
        sliceIndex,
        outcome.text,
      );
      findings.push(
        `title-reference-unified (slice ${String(sliceIndex,)}: "${outcome.before}" to "${outcome.after}"; ${whose})`,
      );
    }
  }
  /**
   Replacements with the rewritten slices folded in.
   */
  const folded = withRewrittenText({
    replacements,
    rewritten,
  },);
  return {
    ...folded,
    findings,
  };
}

//endregion Title reference unify
