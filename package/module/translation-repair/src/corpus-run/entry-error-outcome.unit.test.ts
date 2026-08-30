/**
 * Tests caught entry errors map to operational tally and scheduler state.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  ContributorCompletenessError,
  entryErrorOutcome,
  FrontMatterCompletenessError,
  NaturalnessCompletenessError,
  NaturalnessRepairInterruptedError,
  PromptPayloadStoreError,
  TranslationRepairInterruptedError,
  UnfilledPageError,
  UnsettledFinalSelectionError,
  VisualEvidenceInterruptedError,
} from '../../dist/final/node/index.mjs';

await describe({
  name: entryErrorOutcome.name,
  children: [
    ...([
      new ContributorCompletenessError({ entryId: 'Cat', droppedCount: 1, }),
      new FrontMatterCompletenessError({ entryId: 'Cat', reason: 'missing-slice', }),
      new NaturalnessRepairInterruptedError({ reason: 'quorum-not-met', }),
      new NaturalnessCompletenessError({ sliceIndex: 1, }),
      new PromptPayloadStoreError({
        promptDigest: 'fixture-digest',
        operation: 'read',
      },),
      new TranslationRepairInterruptedError({
        reason: 'production-cycle',
        findings: [],
      },),
      new UnfilledPageError({
        entryId: 'Cat',
        unfilled: [{
          sliceIndex: 1,
          reason: 'not-corroborated',
          findings: [],
        },],
      },),
      new UnsettledFinalSelectionError({
        entryId: 'Cat',
        sliceIndices: [1,],
      },),
      new VisualEvidenceInterruptedError({ unavailableCount: 1, }),
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
