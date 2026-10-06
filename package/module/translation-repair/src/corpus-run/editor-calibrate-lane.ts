import { tagged, } from '@monochromatic-dev/module-logger/ts';

import type { SyntheticClient, } from '../chat-contract.ts';
import { repairChunk, } from '../repair-chunk.ts';
import { settleRefinedSlice, } from '../refine-slice-settle.ts';
import {
  EDITOR_ROUND_STAGES,
  REFINER_ROUND_STAGES,
  selectionRoundsFor,
} from '../repair-selection-rounds.ts';
import type { BenchSlice, } from './bench-sample.ts';
import {
  shippedAuthors,
  type SliceRounds,
} from './editor-calibrate-slice.ts';
import {
  RUN_PER_CALL_TIMEOUT_MS,
  RUN_ROSTER,
} from './run-config.ts';

//region Editor calibrate lane
// ONE SLICE THROUGH THE WHOLE REPAIR LANE, every model editing and every model
// judging, as the editor calibration measures it (`editor-calibrate-run.ts`
// holds the module note that says why the lane is driven rather than replayed,
// why checkers self-certify here and why the refiner seat is run too).

/**
 Runs one slice through the whole repair lane, every model editing and
 every model judging.

 @param slice - passage to repair, with the archive text it stands against

 @param client - client every slice of the run shares

 @returns Rounds that slice produced, split by seat

 @example
 ```ts
 const rounds = await runEditorLane({ slice, client, },);
 ```
 */
export async function runEditorLane(
  {
    slice,
    client,
  }: {
    readonly slice: BenchSlice;
    readonly client: SyntheticClient;
  },
): Promise<SliceRounds> {
  /**
   Logger tagged for this slice.
   */
  const l = tagged({ tag: `editor-calibrate-${slice.entryId}-${String(slice.index,)}`, },);

  /**
   Abort signal for the whole slice.
   */
  const { signal, } = new AbortController();

  /**
   Every seat filled by every model, matching the module note.
   */
  const models = {
    criticModelIds: RUN_ROSTER,
    panelModelIds: RUN_ROSTER,
    editorModelIds: RUN_ROSTER,
    judgeModelIds: RUN_ROSTER,
    refinerModelIds: RUN_ROSTER,
    checkerModelIds: RUN_ROSTER,
    // See the module note: a full editor roster leaves nobody independent,
    // and checking runs after the ballots a standing reads.
    checkerSelfCertificationPermitted: true,
  };

  /**
   Everything the accuracy lane decided about this passage.
   */
  const outcome = await repairChunk({
    client,
    sliceIndex: slice.index,
    sourceText: slice.sourceText,
    targetText: slice.incumbentText,
    lineStructured: slice.lineStructured,
    models,
    declaredNames: [],
    signal,
    perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
    l,
  },);

  /**
   Same slice after the naturalness lane, whose rounds land on the outcome
   beside the accuracy lane's own.
   */
  const refined = await settleRefinedSlice({
    client,
    outcome,
    sourceText: slice.sourceText,
    incumbentText: slice.incumbentText,
    // See the module note: a drawn slice carries no document glossary.
    definitions: '',
    models,
    refinerModelIds: RUN_ROSTER,
    declaredNames: [],
    signal,
    perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
    l,
  },);

  return {
    editor: selectionRoundsFor({
      rounds: refined.outcome
        .rounds,
      stages: EDITOR_ROUND_STAGES,
    },),
    refiner: selectionRoundsFor({
      rounds: refined.outcome
        .rounds,
      stages: REFINER_ROUND_STAGES,
    },),
    refineAsked: refined.asked,
    editorShipped: shippedAuthors({ authorship: outcome.authorship, },),
    refinerShipped: refined.refinedBy,
    refinerHeard: refined.refinersHeard,
  };
}

//endregion Editor calibrate lane
