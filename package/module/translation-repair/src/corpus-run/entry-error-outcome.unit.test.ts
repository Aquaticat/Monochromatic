/**
 Tests caught entry errors map to operational tally and scheduler state.
 
 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  CollapsedHeadingError,
  ContributorCompletenessError,
  DroppedDestinationError,
  entryErrorOutcome,
  FrontMatterCompletenessError,
  NaturalnessCompletenessError,
  NaturalnessRepairInterruptedError,
  PromptPayloadStoreError,
  PublishedPageDisagreesError,
  SliceSpliceError,
  TranslationRepairInterruptedError,
  UnansweredContestSliceError,
  UnparseablePageError,
  VisualEvidenceInterruptedError,
} from '../../dist/final/node/index.mjs';

await describe({
  name: entryErrorOutcome.name,
  children: [
    ...([
      new ContributorCompletenessError({ entryId: 'Cat', droppedCount: 1, }),
      new DroppedDestinationError({
        entryId: 'Cat',
        droppedCount: 1,
        traces: [{
          sourceSlices: [2,],
          archiveSlices: [],
          shippedSlices: [],
        },],
      }),
      new FrontMatterCompletenessError({ entryId: 'Cat', reason: 'missing-slice', }),
      new NaturalnessRepairInterruptedError({ reason: 'contributor-structure', }),
      new NaturalnessCompletenessError({ sliceIndex: 1, }),
      new PromptPayloadStoreError({
        promptDigest: 'fixture-digest',
        operation: 'read',
        reason: 'the record is not JSON',
      },),
      new TranslationRepairInterruptedError({
        reason: 'provider-unavailable',
        findings: [],
      },),
      new VisualEvidenceInterruptedError({ unavailableCount: 1, }),
      // Ledger A7: deterministic page and artifact refusals, which a retry
      // resuming the same cached slices reproduces exactly.
      new CollapsedHeadingError({ entryId: 'Cat', sourceDistinct: 2, pageDistinct: 1, }),
      new UnparseablePageError({ entryId: 'Cat', refusal: 'at 3:12 (mdx-jsx)', }),
      new PublishedPageDisagreesError({
        entryId: 'Cat',
        disagreement: {
          kind: 'weight-off',
          actual: 10,
          expected: 12,
          exact: true,
        },
      },),
      new UnansweredContestSliceError({ message: 'slice 3 differs across lanes and the contest names it nowhere', },),
      new SliceSpliceError({ message: 'two replacements name one slice', },),
    ] as const).map(function stoppedError(error,) {
      return it({
        name: `MAPS ${error.name} to INCOMPLETE stopped work`,
        fn: async () => {
          expect(entryErrorOutcome({ error, },),).toEqual({
            status: 'INCOMPLETE',
            outcome: { kind: 'stopped', },
          },);
        },
      },);
    },),

    it({
      name: 'MAPS ORDINARY OPERATIONAL ERROR to resumable ERROR',
      fn: async () => {
        expect(entryErrorOutcome({ error: new Error('transport failed',), },),).toEqual({
          status: 'ERROR',
          outcome: { kind: 'resumable-failure', },
        },);
      },
    },),
  ],
},);
