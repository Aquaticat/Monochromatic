/**
 Tests caught entry errors map to operational tally and scheduler state.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { EveryProviderDryError, } from '@monochromatic-dev/translation-repair-provider';
import { modelDarkRefusal, } from '@monochromatic-dev/translation-repair-provider/ts/model-dark-refusal.test-fixture.ts';
import { TranslationRepairInterruptedError, } from '@monochromatic-dev/translation-repair-translate-stage';
import { PromptPayloadStoreError, } from '@monochromatic-dev/translation-repair-stage';
import {
  NaturalnessCompletenessError,
  NaturalnessRepairInterruptedError,
} from '@monochromatic-dev/translation-repair-adjudication';
import {
  DroppedDestinationError,
  FrontMatterCompletenessError,
  PublishedPageDisagreesError,
  UnansweredContestSliceError,
  UnparseablePageError,
} from '@monochromatic-dev/translation-repair-page-check';
import {
  CollapsedHeadingError,
  ContributorCompletenessError,
  SliceSpliceError,
} from '@monochromatic-dev/translation-repair-page-pass';
import {
  entryErrorOutcome,
  tallyCaughtEntry,
  VisualEvidenceInterruptedError,
} from '../../dist/final/node/index.mjs';
import { relayingConsoleLog, } from '@monochromatic-dev/translation-repair-test-fixture/ts/corpus-run/console-log-capture.test-fixture.ts';

await describe({
  name: '',
  children: [
    describe({
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
          new UnansweredContestSliceError({ sliceIndex: 3, },),
          new SliceSpliceError({ message: 'two replacements name one slice', },),
        // Every provider dry ends the run at the owner's instruction: a whole-entry retry meets the same dry router.
          new EveryProviderDryError({ measured: 'meters read every provider dry', },),
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
          name: 'MAPS A MODEL-DARK REFUSAL to resumable ERROR like any operational failure, since a model whose own '
            + 'providers are dry costs one seat its voice and does not stop the run',
          fn: async () => {
            expect(entryErrorOutcome({ error: modelDarkRefusal({ modelId: 'glm-5.3', },), },),).toEqual({
              status: 'ERROR',
              outcome: { kind: 'resumable-failure', },
            },);
          },
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
    },),

    describe({
      name: tallyCaughtEntry.name,
      children: [
        it({
          name: 'TELLS THE RUN OF THE REFUSAL THAT ENDED THE ENTRY, once and before the entry is filed, prints the entry as '
            + 'INCOMPLETE, and tells it nothing for a failure that does not end the run',
          fn: async (ctx) => {
            using printed = relayingConsoleLog({ sinon: ctx.sinon, },);
          /**
           What the run was told, in order.
           */
            const told: unknown[] = [];
          /**
           The refusal the router raised for the entry.
           */
            const dry = new EveryProviderDryError({ measured: 'every meter dry', },);
            expect(tallyCaughtEntry({
              entryId: 'Cat',
              error: dry,
              durationMs: 5,
              aborted: true,
              endRun: function endRun({ error, },): void {
                told.push(error,);
              },
            },),).toEqual({ kind: 'stopped', },);
            expect(told,).toEqual([dry,],);
            expect(printed.lines.some(function incomplete(line,): boolean {
              return line.startsWith('TALLY Cat status=INCOMPLETE',);
            },),).toBe(true,);

            expect(tallyCaughtEntry({
              entryId: 'Cat',
              error: new Error('transport failed',),
              durationMs: 5,
              aborted: false,
              endRun: function endRun({ error, },): void {
                told.push(error,);
              },
            },),).toEqual({ kind: 'resumable-failure', },);
            expect(told,).toEqual([dry,],);
          },
        },),

        it({
          name: 'FILES THE REFUSAL ALL THE SAME when the run gave no hook to tell',
          fn: async (ctx) => {
            using printed = relayingConsoleLog({ sinon: ctx.sinon, },);
            expect(tallyCaughtEntry({
              entryId: 'Cat',
              error: new EveryProviderDryError({ measured: 'every meter dry', },),
              durationMs: 5,
              aborted: false,
            },),).toEqual({ kind: 'stopped', },);
            expect(printed.lines.length,).toBe(1,);
          },
        },),
      ],
    },),
  ],
},);
