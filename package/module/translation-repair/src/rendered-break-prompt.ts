import type { SliceSyntax, } from './chunk-document.ts';
import { readSliceSkeleton, } from './translate-skeleton.ts';

//region Rendered line structure at model boundaries
// One contract reaches both producers and selectors. The old verse boolean
// describes blank-separated units; it cannot express explicit breaks in a
// single paragraph. Source and candidate bytes remain verbatim in their fences.

/**
 * Text whose label is the one its receiving sheet actually displays.
 *
 * @example
 * ```ts
 * const rendering: BreakRendering = { label: 'Candidate 2', text: candidateText };
 * ```
 */
export type BreakRendering = {
  /**
   * Anonymous ballot position or established lane label, never producer identity.
   */
  readonly label: string;
  /**
   * Exact wording the model sees and may choose.
   */
  readonly text: string;
};

/**
 * Same preventive instruction for writing and judging source-only passages.
 * Counts establish a minimum, not positional or semantic correctness.
 */
const RENDERED_BREAK_CONTRACT = `RENDERED LINE STRUCTURE (formatting evidence, not content to translate)
The ORIGINAL uses explicit visible line breaks inside its blocks, even if it is only one paragraph or blockquote. No archive wording supplies another layout here.
Preserve the source's rendered line boundaries, the wording grouped on each line, line order, and attribution separation. English may expand; an extra break elsewhere does not repair a merged line.
Markdown soft newlines render as spaces. A physical newline alone is not a visible line break. Write intended breaks visibly as <br/>, or use valid Markdown hard breaks (two trailing spaces or a backslash before a newline). Preserve ordinary soft wrapping elsewhere.
When judging, a candidate that flattens these boundaries cannot beat a faithful candidate that preserves them merely for more lyrical wording. The per-block counts below reveal shortfalls; meeting a count alone does not prove correct placement or faithful wording. These explicit rendered boundaries, not physical newline counts, govern this passage.`;

/**
 * Names each rendering's measured breaks without exposing its producer.
 *
 * @param rendering - exact displayed candidate label and wording
 *
 * @returns One parse-qualified line of formatting evidence
 *
 * @example
 * ```ts
 * const evidence = renderingBreakLine({ label: 'Candidate 1', text: candidateText });
 * ```
 */
function renderingBreakLine(rendering: BreakRendering,): string {
  /**
   * Shared strict syntax reading, not a scan of spaces inside code or comments.
   */
  const read = readSliceSkeleton({ text: rendering.text, },);
  /**
   * A failed parse is unknown evidence, never a manufactured zero count.
   */
  const counts = read.kind === 'read'
    ? JSON.stringify(read.skeleton
      .explicitBreaks,)
    : 'unreadable under the Markdown grammar';
  return `${JSON.stringify(rendering.label,)} explicit breaks by top-level block: ${counts}`;
}

/**
 * Supplies rendered-structure facts before a model generates or selects text.
 * Empty canonical archive text is the source-only interface contract used by
 * these sheets. Callers pass the actual archive, never a generated standing or
 * an eligibility-filtered fallback. Nonempty or whitespace-only archive inputs
 * stay outside this rule, even if parsing would yield no blocks.
 *
 * @param sourceText - exact source slice before supplemental picture/context text
 *
 * @param archiveText - canonical archive slice, empty only where it has no wording
 *
 * @param renderings - texts in the actual displayed anonymous order
 *
 * @param syntax - metadata uses a different grammar and never gets this body rule
 *
 * @returns Shared instructions and measured facts, or no extra prompt text
 *
 * @example
 * ```ts
 * const note = renderedBreakPrompt({ sourceText, archiveText: '', renderings: [] });
 * ```
 */
export function renderedBreakPrompt(
  {
    sourceText,
    archiveText,
    renderings = [],
    syntax,
  }: {
    readonly sourceText: string;
    readonly archiveText: string;
    readonly renderings?: readonly BreakRendering[];
    readonly syntax?: SliceSyntax;
  },
): string {
  if ((archiveText !== '') || (syntax === 'front-matter'))
    return '';
  /**
   * Source-only authored structure, independent of the verse heuristic.
   */
  const source = readSliceSkeleton({ text: sourceText, },);
  if (source.kind !== 'read')
    return '';
  /**
   * One count per source block, reused without repeating the syntax traversal.
   */
  const { explicitBreaks, } = source.skeleton;
  if (!explicitBreaks.some(function hasBreak(count,): boolean {
    return count > 0;
  },))
    return '';
  return [
    RENDERED_BREAK_CONTRACT,
    `ORIGINAL explicit breaks by top-level block: ${JSON.stringify(explicitBreaks,)}`,
    ...renderings.map(renderingBreakLine,),
  ].join('\n',);
}

//endregion Rendered line structure at model boundaries
