import type {
  GradableRepair,
  GradableRepairRegion,
  GradingCandidate,
} from './sample-grading.ts';

//region Repair grading sheet
// The SECOND sheet: whether the text the pipeline wrote actually fixes the
// defect, graded apart from whether the defect was real.
//
// A separate sheet, not a second box on the detection sheet, and that is a
// measurement decision rather than a layout one. Showing a grader the proposed
// correction makes the alleged defect more salient, which moves the answer to
// "is this a real defect". Round two's precision was measured by a sheet that
// showed no repair, so folding repair text into round three's sheet would
// compare two rounds through two different instruments and quietly credit the
// change of instrument to the pipeline. The detection sheet is therefore left
// exactly as it was, and this one is graded AFTER it.
//
// Grading order matters and the header says so. An item graded N for detection
// has no meaningful repair grade: there was no defect to fix, so "did it fix
// it" has no answer, and a harmful edit to a false positive is a different
// question that this sheet does not ask.
//
// The sheet also never shows the checker verdict. Checkers confirmed 98.1% of
// repairs in the round-two artifacts, so revealing that would anchor the human
// toward agreement on precisely the population the human is there to audit.

/**
 * Disposition meaning a repair reached the returned document, which is the only
 * one that carries a grade box.
 */
const SHIPPED_DISPOSITION = 'shipped';

/**
 * Plain-language reading of each disposition, so a grader is told why an item
 * carries no grade box instead of finding one missing.
 */
const DISPOSITION_NOTES: Readonly<Record<string, string>> = {
  shipped: 'a targeted repair reached the returned translation',
  'not-selected':
    'a repair was written but the unchanged text won its slice, so nothing reached the reader',
  withdrawn:
    'a repair was written but the whole page was blocked as non-translation, so the original was returned',
  'no-region':
    'no targeted repair exists: the issue anchored no editable region, or no proposed edit survived the apply gate',
};

/**
 * Renders one replaced region, disclosing when the same edit serves other
 * accepted issues so a shared replacement is never read as this issue's own.
 *
 * @param region - replaced region
 *
 * @param issueId - issue this sheet item is about
 *
 * @returns Markdown lines for the region
 */
function renderRegion(
  {
    region,
    issueId,
  }: {
    readonly region: GradableRepairRegion;
    readonly issueId: string;
  },
): string {
  /**
   * Other accepted issues the same replacement was cut for.
   */
  const siblings = region.issueIds
    .filter(function isOther(candidate,) {
      return candidate !== issueId;
    },);

  return [
    `- before: ${region.before === '' ? '(nothing: text was inserted here)' : `“${region.before}”`}`,
    `- after: “${region.editorAfter}”`,
    ...(siblings.length === 0
      ? []
      : [
        `- SHARED: this one edit was also written for ${
          String(siblings.length,)
        } other accepted issue(s) (${
          siblings.join(', ',)
        }), so judge it against THIS item's claim only`,
      ]),
  ].join('\n',);
}

/**
 * Renders the repair evidence and, when a repair actually shipped, its grade
 * box.
 *
 * @param repair - repair provenance for this issue
 *
 * @param issueId - issue this sheet item is about
 *
 * @returns Markdown lines for the repair block
 */
function renderRepair(
  {
    repair,
    issueId,
  }: {
    readonly repair: GradableRepair;
    readonly issueId: string;
  },
): string {
  /**
   * Why this item does or does not carry a grade box.
   */
  const note = DISPOSITION_NOTES[repair.disposition]
    ?? 'unrecognized disposition; report this rather than grading it';

  return [
    `- outcome: ${repair.disposition} (${note})`,
    ...repair.regions
      .map(function renderOne(region,) {
        return renderRegion({
          region,
          issueId,
        },);
      },),
    ...(repair.refined
      ? [
        '- NOTE: a later naturalness pass rewrote this paragraph, so the wording above is not final.',
        `- final paragraph as returned: “${repair.finalSliceText ?? ''}”`,
        '- grade the FINAL wording, using the edit above only to see what was attempted.',
      ]
      : []),
    ...(repair.disposition === SHIPPED_DISPOSITION
      ? ['- repair grade: [ ]  (Y = fully fixes this defect and breaks nothing nearby · N = it does not)',]
      : ['- not graded: no targeted repair reached the reader, which counts against coverage, not against repair quality',]),
  ].join('\n',);
}

/**
 * Renders one candidate as a repair-sheet block.
 *
 * @param candidate - sampled candidate
 *
 * @param index - 1-based position, matching the detection sheet exactly
 *
 * @returns Markdown lines for the candidate
 */
function renderCandidate(
  {
    candidate,
    index,
  }: {
    readonly candidate: GradingCandidate;
    readonly index: number;
  },
): string {
  /**
   * Repair block, or the reason this run cannot answer the question at all.
   */
  const body = candidate.repair === undefined
    ? [
      '- NOT GRADABLE: this run predates repair recording, so nothing states what was written.',
      '- leave this item blank; it belongs in no repair denominator.',
    ]
      .join('\n',)
    : renderRepair({
      repair: candidate.repair,
      issueId: candidate.issueId,
    },);

  return [
    `### ${String(index,)}. ${candidate.entryId} · ${candidate.band}`,
    `- claim: ${candidate.summary}`,
    `- original translation said: ${
      candidate.targetQuotes
        .length
        === 0
        ? '(nothing quoted; the claim is that something was missing)'
        : candidate.targetQuotes
          .map(function quoted(text,) {
            return `“${text}”`;
          },)
          .join(' · ',)
    }`,
    body,
  ].join('\n',);
}

/**
 * Renders the repair grading sheet: the same sample in the same order as the
 * detection sheet, graded on whether the pipeline's text fixes the defect. The
 * sheet quotes UNLICENSED corpus text, so callers write it OUTSIDE the repo.
 *
 * @param sample - drawn candidates, in draw order
 *
 * @param seed - seed the sample was drawn under, recorded for reproduction
 *
 * @param corpusSha - pinned corpus commit artifacts were produced against
 *
 * @returns Repair grading sheet as markdown text
 *
 * @example
 * ```ts
 * const sheet = formatRepairSheet({
 *   sample,
 *   seed: DEFAULT_SAMPLE_SEED,
 *   corpusSha: 'a41fc60',
 * },);
 * ```
 */
export function formatRepairSheet(
  {
    sample,
    seed,
    corpusSha,
  }: {
    readonly sample: readonly GradingCandidate[];
    readonly seed: string;
    readonly corpusSha: string;
  },
): string {
  /**
   * Header stating the grading order, what the grade means, and the pin.
   */
  const header = [
    '# Repair grading sheet',
    '',
    'GRADE THE DETECTION SHEET FIRST, and do not read this one until it is done.',
    'Seeing a correction makes an alleged defect look more real, which would move',
    'the detection grades and break comparison with earlier rounds.',
    '',
    'Then, for every item you graded `Y` there (a real defect), grade below whether',
    'the text the pipeline produced actually fixes it. `Y` means the returned wording',
    'fully resolves this defect and introduces no new error nearby; `N` means it does',
    'not. Leave items you graded `N` for detection blank: there was no defect to fix.',
    '',
    'Item numbers match the detection sheet exactly.',
    '',
    `Draw seed: ${seed}`,
    `Corpus pin: ${corpusSha}`,
    `Sample size: ${String(sample.length,)}`,
    '',
    '---',
    '',
  ].join('\n',);

  return `${header}${
    sample
      .map(function renderAt(
        candidate,
        position,
      ) {
        return renderCandidate({
          candidate,
          index: position + 1,
        },);
      },)
      .join('\n\n',)
  }\n`;
}

//endregion Repair grading sheet
