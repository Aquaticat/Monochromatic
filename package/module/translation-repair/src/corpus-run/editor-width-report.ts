import { writeFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import type { SyntheticModelId, } from '../synthetic-catalog.ts';
import {
  summarizeWidths,
  type WidthRow,
} from './editor-width-model.ts';
import { resolveRunsDir, } from './run-config.ts';

//region Editor width report
// What the draw is allowed to say, written where the run's other artifacts go.
//
// NO PASSAGE TEXT, EVER. The corpus is unlicensed and this file is the durable
// output, so rows carry entry ids, slice indices, counts and model ids. What
// each arm actually wrote stays in the process that wrote it.
//
// NO RATES EITHER. Every number here is a count over a draw of a dozen or so
// slices, and rendering four of eleven as a percentage invites reading three
// decimal places into a sample that cannot carry one. The reader can divide.

/**
 * Name the report is written under.
 */
const REPORT_NAME = 'editor-width.md';

/**
 * Renders one row as a line of counts.
 *
 * @param row - one slice's comparison
 *
 * @returns Line naming the slice and what it contributed
 *
 * @example
 * ```ts
 * const line = renderRow(row,);
 * ```
 */
function renderRow(row: WidthRow,): string {
  return [
    `-   \`${row.entryId}\` slice ${String(row.chunkIndex,)}`,
    `issues ${String(row.acceptedIssues,)}`,
    `heard ${String(row.heardNarrow,)}/${String(row.heardWide,)}`,
    row.comparison,
    `repeat ${row.narrowRepeatAgreed ? 'agreed' : 'FLIPPED'}`,
    `${row.verdict} on ${String(row.usableBallots,)} ballots`,
  ].join(', ',);
}

/**
 * Writes the draw's report.
 *
 * @param rows - every slice that reached a comparison
 *
 * @param skipped - slices that carried no work, by refusal
 *
 * @param headSha - pipeline commit these rows were produced by
 *
 * @param narrowEditorIds - seats in the narrow arm
 *
 * @param wideEditorIds - seats in the wide arm
 *
 * @param judgeModelIds - panel held fixed across both arms
 *
 * @param controlHeld - whether the positive control preferred intact text
 *
 * @returns Path written, so the caller can name it
 *
 * @example
 * ```ts
 * const path = await writeWidthReport({ rows, skipped, headSha, narrowEditorIds, wideEditorIds, judgeModelIds, controlHeld, },);
 * ```
 */
export async function writeWidthReport(
  {
    rows,
    skipped,
    headSha,
    narrowEditorIds,
    wideEditorIds,
    judgeModelIds,
    controlHeld,
  }: {
    readonly rows: readonly WidthRow[];
    readonly skipped: Readonly<Record<string, number>>;
    readonly headSha: string;
    readonly narrowEditorIds: readonly SyntheticModelId[];
    readonly wideEditorIds: readonly SyntheticModelId[];
    readonly judgeModelIds: readonly SyntheticModelId[];
    readonly controlHeld: boolean;
  },
): Promise<string> {
  /**
   * Counts the decision reads.
   */
  const summary = summarizeWidths({ rows, },);

  /**
   * Directory this run may write to.
   */
  const runsDir = await resolveRunsDir();

  /**
   * Where the report lands.
   */
  const path = join(
    runsDir,
    REPORT_NAME,
  );

  await writeFile(
    path,
    [
      '# Editor width: does seating more editors buy a better repair',
      '',
      `Pipeline commit \`${headSha}\`.`,
      '',
      `Narrow arm seats ${String(narrowEditorIds.length,)}: ${narrowEditorIds.join(', ',)}.`,
      `Wide arm seats ${String(wideEditorIds.length,)}: ${wideEditorIds.join(', ',)}.`,
      `Panel is held fixed at ${String(judgeModelIds.length,)}: ${judgeModelIds.join(', ',)}.`,
      '',
      '## Positive control',
      '',
      controlHeld
        ? 'The panel preferred intact text over the same text with a sentence removed, '
          + 'so it can tell damage from repair and the numbers below are worth reading.'
        : 'THE PANEL DID NOT PREFER INTACT TEXT over the same text with a sentence '
          + 'removed. Everything below is unreadable: an instrument that cannot see a '
          + 'deleted sentence cannot see the finer difference this draw is asking about.',
      '',
      '## Counts',
      '',
      `-   slices that reached a comparison: ${String(summary.slices,)}`,
      `-   shipped text moved when the editors widened: ${String(summary.moved,)}`,
      `-   NULL BAND, narrow arm run twice shipped different text: ${String(summary.churned,)}`,
      `-   head-to-head, wide preferred in both orders: ${String(summary.wideWins,)}`,
      `-   head-to-head, narrow preferred in both orders: ${String(summary.narrowWins,)}`,
      `-   head-to-head, the seat decided rather than the text: ${String(summary.positionDecided,)}`,
      `-   head-to-head, the panel would not separate them: ${String(summary.tied,)}`,
      '',
      'READ THE MOVE COUNT AGAINST THE NULL BAND, never on its own.',
      'The band is the same arm run twice, so it already contains every reason the',
      'shipped text changes that has nothing to do with width.',
      'A move count inside it is not evidence that widening did anything.',
      '',
      '## Slices that carried no work',
      '',
      ...Object.entries(skipped,)
        .map(function toLine([refusal, count,],) {
          return `-   ${refusal}: ${String(count,)}`;
        },),
      '',
      '## Rows',
      '',
      ...rows.map(renderRow,),
      '',
    ].join('\n',),
    'utf8',
  );

  return path;
}

//endregion Editor width report
