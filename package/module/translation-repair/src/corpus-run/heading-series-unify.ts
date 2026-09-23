import type { ChunkPair, } from '../chunk-document.ts';
import type { SliceReplacement, } from '../splice-slices.ts';
import {
  colonAt,
  isHeadingLine,
  pageTextBySlice,
  slicesInOrder,
  splitHeading,
  withRewrittenText,
} from './assembly-page-text.ts';
import {
  NO_NUMBER,
  type OrdinalStyle,
  readHanNumeral,
  readOrdinalStyle,
  renderOrdinal,
  styleKey,
} from './ordinal-style.ts';

//region Heading series unify
// CLASS SIXTY-EIGHT (XingZ616, 2026-09-19). The original's ten section
// headings `其一：伊良子` to `其十：锦心` reached the settled page in seven
// ordinal styles: "One:", none, "Three:", "IV:", "The Fifth:", "Part Six:",
// none, none, "IX:", "Ten:". Every slice floor passed its own heading and
// no judge sees two of them at once, so a parallel series has no one style.
// THE PAGE DECIDES ONCE, HERE, where every heading is in view: a series of
// numbered headings takes the style most of its renderings took, the
// earliest style on a tie, and drops the ordinals where most renderings
// dropped them, which is the archive's own convention on this page.
//
// CLASS EIGHTY-NINE (XingZ624, 2026-09-23). The plurality moved run to run:
// XingZ622 shipped "Part One:" to "Part Ten:" on a plurality of "part
// cardinal" renderings and XingZ624 dropped every ordinal on a plurality of
// three bare headings, both over the same archive, which heads the sections
// by name alone. Where the archive renders the series itself (two or more
// of its headings, all in one style) the page takes the archive's style; the
// renderings' plurality decides only where the archive never headed the
// series.

/**
 Mark the original's numbered headings open with.
 */
const SERIES_MARK = '其';

/**
 One heading of the series as the page carries it.
 */
type SeriesHeading = {
  /**
   Slice whose text carries the heading.
   */
  readonly sliceIndex: number;

  /**
   Line of that slice's page text the heading sits on.
   */
  readonly line: number;

  /**
   Number the original gives the heading.
   */
  readonly value: number;

  /**
   Heading marks.
   */
  readonly marks: string;

  /**
   Title after the number, as rendered.
   */
  readonly rest: string;

  /**
   Style the rendering took, `NO_NUMBER` where it carries no number.
   */
  readonly style: OrdinalStyle;
};

/**
 Numbers of the original's numbered headings in one slice, in heading
 order, zero for a heading that is not numbered.

 @param text - original text of the slice

 @returns One value per heading line

 @example
 ```ts
 seriesValues({ text: '### 其三：猫\n\n猫。', },); // [3]
 ```
 */
function seriesValues({ text, }: { readonly text: string; },): readonly number[] {
  return text.split('\n',)
    .filter(function heading(line,): boolean {
      return isHeadingLine({ line, },);
    },)
    .map(function valueOf(line,): number {
      /**
       Title of the heading.
       */
      const { title, } = splitHeading({ line, },);
      if (!title.startsWith(SERIES_MARK,))
        return 0;
      /**
       Where the number ends.
       */
      const colon = colonAt({ title, },);
      if (colon === (-1))
        return 0;
      return readHanNumeral({ text: title.slice(
        SERIES_MARK.length,
        colon,
      ), },);
    },);
}

/**
 Reads one rendered heading of the series.

 @param line - rendered heading line

 @returns Marks, the title after any number, and the style the number took

 @example
 ```ts
 readRendered({ line: '### Part Six: Mikä', },);
 ```
 */
function readRendered({ line, }: { readonly line: string; },): Pick<SeriesHeading, 'marks' | 'rest' | 'style'> {
  /**
   Marks and title.
   */
  const {
    marks,
    title,
  } = splitHeading({ line, },);
  /**
   Where a number would end.
   */
  const colon = colonAt({ title, },);
  if (colon === (-1))
    return {
      marks,
      rest: title,
      style: NO_NUMBER,
    };
  /**
   Text before the colon.
   */
  const prefix = title.slice(
    0,
    colon,
  )
    .trim();
  /**
   Style of the text before the colon.
   */
  const style = readOrdinalStyle({ prefix, },);
  if (style.form === 'none')
    return {
      marks,
      rest: title,
      style,
    };
  /**
   Title after the colon.
   */
  const rest = title.slice(colon + 1,)
    .trim();
  return {
    marks,
    rest,
    style,
  };
}

/**
 What the archive says about the series' style: one style, or nothing to
 read.
 */
type ArchiveSeriesStyle =
  | {
    readonly rendered: true;

    /**
     Style every archive heading of the series shares.
     */
    readonly style: OrdinalStyle;
  }
  | { readonly rendered: false; };

/**
 The archive heads fewer than two of the series, or in more than one style.
 */
const ARCHIVE_SILENT: ArchiveSeriesStyle = { rendered: false, };

/**
 Style the archive renders the series in: the one style shared by every
 archive heading standing where the original numbers one; silent where the
 archive heads fewer than two of them or heads them in more than one style.

 @param slices - prepared pairs in slice order

 @returns The archive's style, or that there is none to read

 @example
 ```ts
 const archived = archiveStyle({ slices, },);
 ```
 */
function archiveStyle({ slices, }: { readonly slices: readonly ChunkPair[]; },): ArchiveSeriesStyle {
  /**
   Style of every archive heading at a numbered position.
   */
  const styles: OrdinalStyle[] = [];
  for (const slice of slices) {
    /**
     Numbers of the original's headings here, in heading order.
     */
    const values = seriesValues({ text: slice.source
      .text, },);
    if (values.every(function unnumbered(value,): boolean {
      return value === 0;
    },))
      continue;
    /**
     Archive heading lines of this slice, in order.
     */
    const lines = slice.target
      .text
      .split('\n',)
      .filter(function heading(line,): boolean {
        return isHeadingLine({ line, },);
      },);
    values.forEach(function readArchive(
      value,
      at,
    ): void {
      /**
       Archive heading at this position, if the archive carries one.
       */
      const line = lines[at];
      if ((value === 0) || (line === undefined))
        return;
      /**
       Archive heading as rendered.
       */
      const { style, } = readRendered({ line, },);
      styles.push(style,);
    },);
  }
  /**
   Earliest archive style, if the archive heads the series at all.
   */
  const [first,] = styles;
  if ((styles.length < 2) || (first === undefined))
    return ARCHIVE_SILENT;
  /**
   Distinct style keys the archive used.
   */
  const keys = new Set(styles.map(function keyOf(style,): string {
    return styleKey({ style, },);
  },),);
  return (keys.size === 1)
    ? {
      rendered: true,
      style: first,
    }
    : ARCHIVE_SILENT;
}

/**
 Style most headings took, the earliest on a tie; `NO_NUMBER` when most
 carry no number.

 @param headings - series as rendered

 @returns Winning style

 @example
 ```ts
 const style = majorityStyle({ headings, },);
 ```
 */
function majorityStyle({ headings, }: { readonly headings: readonly SeriesHeading[]; },): OrdinalStyle {
  /**
   Count per style key, "none" for no number.
   */
  const counts = new Map<string, number>();
  for (const heading of headings) {
    /**
     Key of this heading's style.
     */
    const key = styleKey({ style: heading.style, },);
    counts.set(
      key,
      (counts.get(key,) ?? 0) + 1,
    );
  }
  /**
   Largest count.
   */
  const most = Math.max(...counts.values(),);
  /**
   Earliest heading whose style drew the largest count.
   */
  const earliest = headings.find(function leads(heading,): boolean {
    /**
     Key of this heading's style.
     */
    const key = styleKey({ style: heading.style, },);
    return counts.get(key,) === most;
  },);
  return (earliest === undefined) ? NO_NUMBER : earliest.style;
}

/**
 Renders every numbered heading of the original's series in one style.

 @param slices - prepared pairs, whose original names the series

 @param replacements - what the page would write per slice

 @returns Replacements with the series unified, the rewritten rows alone,
 and one finding per rewritten heading

 @example
 ```ts
 const unified = unifyHeadingSeries({ slices, replacements, },);
 ```
 */
export function unifyHeadingSeries(
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
   Every numbered heading as the page renders it.
   */
  const headings: SeriesHeading[] = [];
  for (const slice of slicesInOrder({ slices, },)) {
    /**
     Index of this slice.
     */
    const { sliceIndex, } = slice.target;
    /**
     Numbers of the original's headings here, in heading order.
     */
    const values = seriesValues({ text: slice.source
      .text, },);
    if (values.every(function unnumbered(value,): boolean {
      return value === 0;
    },))
      continue;
    /**
     Page lines of this slice.
     */
    const lines = (pageText.get(sliceIndex,) ?? '').split('\n',);
    /**
     Headings met so far in the page text.
     */
    let met = 0;
    lines.forEach(function readLine(
      line,
      at,
    ): void {
      if (!isHeadingLine({ line, },))
        return;
      /**
       Number of the original's heading at this position, zero if none.
       */
      const value = values[met] ?? 0;
      met += 1;
      if (value === 0)
        return;
      headings.push({
        sliceIndex,
        line: at,
        value,
        ...readRendered({ line, },),
      },);
    },);
  }
  if (headings.length < 2)
    return {
      replacements,
      restored: [],
      findings: [],
    };
  /**
   Style the archive renders the series in, if it renders it.
   */
  const archived = archiveStyle({ slices: slicesInOrder({ slices, },), },);
  /**
   Style the series takes: the archive's, else most renderings'.
   */
  const style = archived.rendered ? archived.style : majorityStyle({ headings, },);
  /**
   Whose style it is, for the finding.
   */
  const whose = archived.rendered ? 'the archive\'s own style' : 'most renderings\' style';
  /**
   Page text per slice after the rewrites.
   */
  const rewritten = new Map<number, string>();
  /**
   One finding per rewritten heading.
   */
  const findings: string[] = [];
  for (const heading of headings) {
    /**
     Heading as the series style spells it.
     */
    const unified = (style.form === 'none')
      ? `${heading.marks} ${heading.rest}`
      : `${heading.marks} ${renderOrdinal({
        value: heading.value,
        style,
      },)}: ${heading.rest}`;
    /**
     Slice lines as they stand after earlier rewrites.
     */
    const current = rewritten.get(heading.sliceIndex,)
      ?? pageText.get(heading.sliceIndex,)
      ?? '';
    /**
     Those lines.
     */
    const lines = current.split('\n',);
    /**
     Heading line as the page had it.
     */
    const before = lines[heading.line] ?? '';
    if (before === unified)
      continue;
    lines[heading.line] = unified;
    rewritten.set(
      heading.sliceIndex,
      lines.join('\n',),
    );
    findings.push(
      `heading-series-unified (slice ${String(heading.sliceIndex,)}: "${before}" to "${unified}"; `
        + `${String(headings.length,)} numbered headings in the style of "${styleKey({ style, },)}", ${whose})`,
    );
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

//endregion Heading series unify
