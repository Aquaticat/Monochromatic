import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { sampleBenchSlices, } from './bench-sample.ts';
import { widthControlHolds, } from './editor-width-control.ts';
import { gatherWidthInput, } from './editor-width-input.ts';
import type {
  WidthDraw,
  WidthRow,
} from './editor-width-model.ts';
import { writeWidthReport, } from './editor-width-report.ts';
import { runWidthSlice, } from './editor-width-slice.ts';
import {
  createRunClient,
  readHeadSha,
  RUN_MODELS,
  RUN_ROSTER,
} from './run-config.ts';

//region Editor width probe
// `#186`: does seating more EDITORS buy a better repair, with the judging panel
// held fixed.
//
// NEITHER WIDTH IS WRITTEN HERE. The narrow arm is whatever `RUN_MODELS` seats
// as editors today and the wide arm is the whole roster, so the probe keeps
// answering the right question when the configuration moves. The owner's
// standing instruction against hardcoding a four or a six is satisfied by
// deriving both ends rather than by picking a better number.
//
// THE CONTROL RUNS FIRST and the draw is abandoned if it fails. An instrument
// that cannot prefer intact text over the same text with a sentence removed
// cannot see the finer difference the draw asks about, and spending an hour to
// collect unreadable numbers is worse than spending a few calls to find out.
//
// SPENDS QUOTA. Point `TRANSLATION_REPAIR_RUNS_DIR` at a throwaway directory.

/**
 * Slices drawn when the caller names no count.
 *
 * The sample is HALVED into two disjoint draws, so this is the size of the
 * whole sample rather than of the draw that runs.
 */
const DEFAULT_SLICES = 18;

/**
 * Half of the sample spent when the caller names no draw.
 */
const DEFAULT_DRAW: WidthDraw = 'a';

/**
 * Position within the sample each draw takes.
 *
 * Alternate positions rather than a front and back half, so both draws stay as
 * evenly spread across the corpus as the whole sample was.
 */
const DRAW_POSITIONS: Readonly<Record<WidthDraw, number>> = {
  a: 0,
  b: 1,
};

/**
 * Runs the whole probe and writes its report.
 *
 * @throws Error when the panel fails the positive control, since every number
 * the draw would produce is unreadable once that happens
 *
 * @throws Error when the named draw is neither half, rather than quietly
 * spending draw A and reporting it under whatever was asked for
 *
 * @example
 * ```ts
 * await main();
 * ```
 */
async function main(): Promise<void> {
  /**
   * Logger for the probe.
   */
  const l = tagged({ tag: 'editor-width', },);

  /**
   * Client every call goes through.
   */
  const client = createRunClient();

  /**
   * Cancellation shared by every call, never fired: the probe runs to the end
   * or dies with the process.
   */
  const { signal, } = new AbortController();

  /**
   * Seats in the narrow arm, read off the configuration rather than written
   * here.
   */
  const narrowEditorIds = RUN_MODELS.editorModelIds;

  /**
   * Every model, which is the widest the roster can go.
   */
  const wideEditorIds = RUN_ROSTER;

  /**
   * Panel, held fixed so a difference between the arms is about the seats.
   */
  const judgeModelIds = RUN_ROSTER;

  console.log(
    `WIDTH narrow ${String(narrowEditorIds.length,)} against wide ${
      String(wideEditorIds.length,)
    }, panel of ${String(judgeModelIds.length,)} held fixed`,
  );

  /**
   * Slices asked for on the command line, or the default.
   */
  const wanted = Number(
    process.argv[2]
      ?? String(DEFAULT_SLICES,),
  );

  /**
   * Half of the sample this run spends, named on the command line.
   */
  const asked = process.argv[3] ?? DEFAULT_DRAW;

  if ((asked !== 'a') && (asked !== 'b'))
    throw new Error(
      `editor width probe refused: draw must be 'a' or 'b', not '${asked}'; spending draw A `
        + 'under another name would burn the held-back half of the sample without saying so',
    );

  /**
   * That name, narrowed to the two draws that exist.
   */
  const draw: WidthDraw = asked;

  /**
   * Whole sample, spread across the corpus.
   */
  const sample = await sampleBenchSlices({ count: wanted, },);

  /**
   * Positions this draw takes out of the sample.
   *
   * SPLIT RATHER THAN REDRAWN, so the other half exists already if this one
   * lands near its own null band. Taking alternate positions out of one spread
   * sample keeps both halves as evenly spread as the whole.
   */
  const wantedPosition = DRAW_POSITIONS[draw];

  /**
   * Slices this run spends, leaving the other half untouched.
   */
  const drawn = sample.filter(function inThisDraw(
    _slice,
    at,
  ) {
    return (at % 2) === wantedPosition;
  },);

  console.log(
    `WIDTH sample ${String(sample.length,)}, draw ${draw.toUpperCase()} ${
      String(drawn.length,)
    }, other half held back`,
  );

  /**
   * Whether the panel can tell a deleted sentence from an intact passage.
   */
  const controlHeld = await widthControlHolds({
    client,
    slices: sample,
    judgeModelIds,
    signal,
    l,
  },);

  if (!controlHeld)
    throw new Error(
      'editor width probe refused: the panel did not prefer intact text over the same '
        + 'text with a sentence removed, so it cannot read the finer difference this draw '
        + 'asks about and the draw was not spent',
    );

  console.log(`WIDTH control held; running draw ${draw.toUpperCase()}`,);

  /**
   * Rows accumulated as they finish, so a killed run still has a report.
   */
  const rows: WidthRow[] = [];

  /**
   * Slices that carried no work, counted by the wall they hit.
   */
  const skipped: Record<string, number> = {};

  for (const slice of drawn) {
    /**
     * Work the critics and panel found in this slice.
     */
    // oxlint-disable-next-line eslint/no-await-in-loop -- sequential by design: every arm of every slice must meet the same provider conditions, which fanning the draw out would destroy, and the run is bounded by quota rather than by wall time
    const outcome = await gatherWidthInput({
      client,
      slice,
      signal,
      l,
    },);

    if (outcome.kind === 'skipped') {
      skipped[outcome.refusal] = (skipped[outcome.refusal] ?? 0) + 1;
      console.log(
        `WIDTH ${outcome.entryId} slice ${String(outcome.chunkIndex,)}: ${outcome.refusal}`,
      );
      continue;
    }

    /**
     * That slice run at both widths, with the null band beside it.
     */
    // oxlint-disable-next-line eslint/no-await-in-loop -- sequential for the same reason the gather above is
    const row = await runWidthSlice({
      client,
      input: outcome.input,
      narrowEditorIds,
      wideEditorIds,
      judgeModelIds,
      signal,
      l,
    },);

    rows.push(row,);
    console.log(
      `WIDTH ${row.entryId} slice ${String(row.chunkIndex,)}: ${row.comparison}, repeat ${
        row.narrowRepeatAgreed ? 'agreed' : 'FLIPPED'
      }, ${row.verdict}`,
    );
  }

  /**
   * Pipeline commit these rows were produced by.
   */
  const headSha = await readHeadSha();

  /**
   * Where the report landed.
   */
  const path = await writeWidthReport({
    rows,
    skipped,
    headSha,
    narrowEditorIds,
    wideEditorIds,
    judgeModelIds,
    controlHeld,
    draw,
  },);

  console.log(`WIDTH wrote ${path}`,);
}

await main();

//endregion Editor width probe
